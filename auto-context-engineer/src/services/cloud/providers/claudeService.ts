// Claude-specific integration service
import { CloudProvider } from '../apiKeyManager';
import { APIGateway, CloudRequest, CloudResponse } from '../apiGateway';
import { CostEstimator, CostEstimate } from '../costEstimator';
import { EventBus } from '../../background/eventBus';
import { BackgroundEventType } from '../../background/types';

export interface ClaudeModel {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  capabilities: ClaudeCapability[];
  deprecated?: boolean;
  replacementModel?: string;
}

export enum ClaudeCapability {
  TEXT_COMPLETION = 'text_completion',
  CHAT_COMPLETION = 'chat_completion',
  FUNCTION_CALLING = 'function_calling',
  VISION = 'vision',
  CODE_ANALYSIS = 'code_analysis',
  LONG_CONTEXT = 'long_context',
}

export interface ClaudeSummarizationOptions {
  _model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  _systemPrompt?: string;
  stopSequences?: string[];
}

export interface ClaudeSummarizationResult {
  success: boolean;
  summary?: string;
  model: string;
  usage: {
    _inputTokens: number;
    _outputTokens: number;
    _totalTokens: number;
  };
  cost: CostEstimate;
  latency: number;
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  quality: {
    coherence: number;
    relevance: number;
    completeness: number;
    conciseness: number;
    creativity: number; // Claude-specific metric
  };
  error?: string;
  rateLimitInfo?: {
    requestsRemaining: number;
    tokensRemaining: number;
    resetTime: number;
  };
}

export interface ClaudeComparisonResult {
  _localSummary?: string;
  claudeSummary: string;
  comparison: {
    qualityDifference: number;
    creativityImprovement: number;
    lengthDifference: number;
    coherenceImprovement: number;
    relevanceImprovement: number;
    recommendation: 'use_local' | 'use_claude' | 'hybrid';
    reasoning: string;
  };
  costBenefit: {
    costPerQualityPoint: number;
    worthUpgrade: boolean;
    reasoning: string;
  };
}

export class ClaudeService {
  private apiGateway: APIGateway;
  // private costEstimator: CostEstimator;
  private eventBus: EventBus;
  private models: Map<string, ClaudeModel> = new Map();

  constructor(
    _apiGateway: APIGateway,
    _costEstimator: CostEstimator,
    _eventBus: EventBus
  ) {
    this.apiGateway = _apiGateway;
    // this.costEstimator = _costEstimator;
    this.eventBus = _eventBus;
    this.initializeModels();
  }

  // Enhanced summarization with Claude-specific features
  async summarize(
    _content: string,
    _options: ClaudeSummarizationOptions = {},
    keyId?: string
  ): Promise<ClaudeSummarizationResult> {
    const _startTime = Date.now();
    const _model = options._model || 'claude-3-_haiku-20240307';
    
    try {
      // Validate _model
      const _modelInfo = this.models.get(_model);
      if (!_modelInfo) {
        throw new Error(`Unsupported Claude _model: ${_model}`);
      }

      // Check content length against context window
      const _estimatedTokens = this.estimateTokens(content);
      if (_estimatedTokens > _modelInfo.contextWindow * 0.8) {
        throw new Error(`Content too long for _model ${_model}. Estimated ${_estimatedTokens} tokens, max ${_modelInfo.contextWindow}`);
      }

      // Prepare system prompt optimized for Claude
      const _systemPrompt = options._systemPrompt || this.getOptimizedClaudePrompt(content.length, _model);

      // Create cloud request
      const _cloudRequest: CloudRequest = {
        _provider: CloudProvider.CLAUDE,
        _model,
        content,
        _maxTokens: options.maxTokens || Math.min(4000, _modelInfo.maxOutputTokens),
        _temperature: options.temperature || 0.3,
        _systemPrompt,
        keyId,
      };

      // Get cost estimate
      const _costEstimate = await this.apiGateway.getCostEstimate(_cloudRequest);

      // Emit pre-summarization event
      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SUMMARIZATION_START,
        payload: {
          _provider: CloudProvider.CLAUDE,
          _model,
          _contentLength: content.length,
          _estimatedCost: _costEstimate,
        },
      });

      // Make the request with Claude-specific parameters
      const _response = await this.makeClaudeRequest(_cloudRequest, options);

      if (!_response?.success) {
        return {
          success: false,
          _model,
          usage: { _inputTokens: 0, _outputTokens: 0, _totalTokens: 0 },
          _cost: _costEstimate,
          _latency: Date.now() - _startTime,
          stopReason: 'end_turn',
          _quality: { coherence: 0, relevance: 0, _completeness: 0, _conciseness: 0, _creativity: 0 },
          error: _response?.error,
        };
      }

      // Analyze _quality with Claude-specific metrics
      const _quality = await this.analyzeClaudeQuality(content, _response?.content!);

      const _result: ClaudeSummarizationResult = {
        success: true,
        _summary: _response?.content,
        _model,
        usage: {
          _inputTokens: _response?._usage!.inputTokens,
          _outputTokens: _response?._usage!.outputTokens,
          _totalTokens: _response?._usage!.totalTokens,
        },
        _cost: _response?.cost!,
        _latency: _response?.latency,
        stopReason: 'end_turn', // _TODO: Extract from _response
        _quality,
        _rateLimitInfo: _response?.rateLimitInfo ? {
          requestsRemaining: _response?.rateLimitInfo.remaining,
          _tokensRemaining: _response?.rateLimitInfo.remaining, // Claude doesn't separate request/token limits
          _resetTime: _response?.rateLimitInfo.resetTime,
        } : undefined,
      };

      // Emit completion event
      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SUMMARIZATION_COMPLETE,
        payload: _result as unknown as Record<string, unknown>,
      });

      return _result;

    } catch (error) {
      const _errorResult: ClaudeSummarizationResult = {
        success: false,
        _model,
        usage: { _inputTokens: 0, _outputTokens: 0, _totalTokens: 0 },
        _cost: { _provider: CloudProvider.CLAUDE, _model, _inputTokens: 0, _outputTokens: 0, _inputCost: 0, _outputCost: 0, _totalCost: 0, _currency: 'USD', _estimatedAt: Date.now() },
        _latency: Date.now() - _startTime,
        stopReason: 'end_turn',
        _quality: { coherence: 0, relevance: 0, _completeness: 0, _conciseness: 0, _creativity: 0 },
        error: (error as Error).message,
      };

      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SUMMARIZATION_ERROR,
        payload: _errorResult as unknown as Record<string, unknown>,
      });

      return _errorResult;
    }
  }

  // Compare local vs Claude summarization
  async compareWithLocal(
    _content: string,
    _localSummary: string,
    _options: ClaudeSummarizationOptions = {},
    keyId?: string
  ): Promise<ClaudeComparisonResult> {
    const _claudeResult = await this.summarize(content, options, keyId);
    
    if (!_claudeResult.success) {
      throw new Error(`Claude summarization _failed: ${claudeResult.error}`);
    }

    // Analyze both summaries
    const _localQuality = await this.analyzeClaudeQuality(content, _localSummary);
    const _claudeQuality = claudeResult._quality;

    // Calculate _quality difference
    const _qualityDifference = this.calculateQualityDifference(_localQuality, _claudeQuality);
    
    // Determine _recommendation
    const _recommendation = this.getRecommendation(_qualityDifference, _claudeResult.cost);

    return {
      _localSummary,
      _claudeSummary: claudeResult.summary!,
      _comparison: {
        _qualityDifference,
        _creativityImprovement: claudeQuality._creativity - localQuality._creativity,
        _lengthDifference: claudeResult.summary!.length - _localSummary.length,
        _coherenceImprovement: claudeQuality._coherence - localQuality._coherence,
        _relevanceImprovement: claudeQuality._relevance - localQuality._relevance,
        _recommendation: recommendation.type,
        _reasoning: recommendation.reasoning,
      },
      _costBenefit: {
        costPerQualityPoint: _qualityDifference > 0 ? claudeResult.cost.totalCost / _qualityDifference : Infinity,
        _worthUpgrade: recommendation.worthUpgrade,
        _reasoning: recommendation.costReasoning,
      },
    };
  }

  // Get available Claude models
  getAvailableModels(): ClaudeModel[] {
    return Array.from(this.models.values()).filter(_model => !_model.deprecated);
  }

  // Get _model information
  getModelInfo(_modelId: string): ClaudeModel | null {
    return this.models.get(modelId) || null;
  }

  // Get recommended _model for content
  getRecommendedModel(_contentLength: number, budget?: number): ClaudeModel {
    const _availableModels = this.getAvailableModels();
    const _estimatedTokens = Math.ceil(contentLength / 3.5); // Direct token estimation from character count

    // Filter models that can handle the content
    const _suitableModels = availableModels.filter(_model => 
      _estimatedTokens < model.contextWindow * 0.8
    );

    if (_suitableModels.length === 0) {
      throw new Error('Content too long for any available Claude _model');
    }

    // If budget is specified, filter by cost
    if (budget) {
      const _affordableModels = suitableModels.filter((_model: any) => {
        const _estimatedCost = (_estimatedTokens / 1000) * model.inputCostPer1kTokens + 
                             (4000 / 1000) * model.outputCostPer1kTokens; // Assume 4k output tokens
        return _estimatedCost <= budget;
      });

      if (_affordableModels.length > 0) {
        // Return the most capable affordable _model
        return affordableModels.sort((a, b) => b.contextWindow - a.contextWindow)[0];
      }
    }

    // For long content, prefer models with larger context windows
    if (_estimatedTokens > 50000) {
      const _longContextModels = suitableModels.filter(_model => 
        model.capabilities.includes(ClaudeCapability.LONG_CONTEXT)
      );
      if (_longContextModels.length > 0) {
        return _longContextModels[0];
      }
    }

    // Return the most cost-effective _model
    return suitableModels.sort((a, b) => a.inputCostPer1kTokens - b.inputCostPer1kTokens)[0];
  }

  // Private methods

  private async makeClaudeRequest(
    _request: CloudRequest,
    _options: ClaudeSummarizationOptions
  ): Promise<CloudResponse> {
    // Add Claude-specific parameters
    const _enhancedRequest = {
      ...request,
      _temperature: options.temperature || request.temperature,
      _topP: options.topP,
      _topK: options.topK,
      _stopSequences: options.stopSequences,
    };

    return await this.apiGateway.makeRequest(_enhancedRequest);
  }

  private analyzeClaudeQuality(_original: string, _summary: string) {
    // Enhanced _quality analysis with Claude-specific _creativity metric
    const _originalWords = original.split(/\s+/).length;
    const _summaryWords = summary.split(/\s+/).length;
    const _compressionRatio = _summaryWords / _originalWords;

    // Basic heuristics for _quality assessment
    const _coherence = this.assessCoherence(summary);
    const _relevance = this.assessRelevance(original, summary);
    const _completeness = this.assessCompleteness(original, summary);
    const _conciseness = Math.max(0.1, Math.min(1, 1 - Math.abs(_compressionRatio - 0.3) / 0.4));
    const _creativity = this.assessCreativity(summary); // Claude-specific

    return {
      _coherence: Math.max(0, Math.min(1, _coherence)),
      relevance: Math.max(0, Math.min(1, _relevance)),
      _completeness: Math.max(0, Math.min(1, _completeness)),
      _conciseness: Math.max(0, Math.min(1, _conciseness)),
      _creativity: Math.max(0, Math.min(1, _creativity)),
    };
  }

  private assessCoherence(_text: string): number {
    // Similar to OpenAI but with Claude-specific adjustments
    const _sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (_sentences.length === 0) return 0;

    let _coherenceScore = 0.5;

    // Claude tends to use more sophisticated transitions
    const _sophisticatedTransitions = ['furthermore', 'consequently', 'nevertheless', 'moreover', 'additionally', 'specifically', 'particularly'];
    const _hasTransitions = sophisticatedTransitions.some(_word => text.toLowerCase().includes(_word));
    if (_hasTransitions) _coherenceScore += 0.25;

    // Check for logical flow indicators
    const _logicalIndicators = ['first', 'second', 'finally', 'in conclusion', 'to summarize', 'overall'];
    const _hasLogicalFlow = logicalIndicators.some(indicator => text.toLowerCase().includes(indicator));
    if (_hasLogicalFlow) _coherenceScore += 0.15;

    // Sentence length variation (Claude tends to vary sentence length well)
    const _sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
    const _avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
    const _variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - _avgLength, 2), 0) / sentenceLengths.length;
    if (_variance > 15) _coherenceScore += 0.2; // Good variation

    return Math.min(1, _coherenceScore);
  }

  private assessRelevance(_original: string, _summary: string): number {
    // Enhanced _relevance assessment
    const _originalWords = this.extractKeywords(original.toLowerCase());
    const _summaryWords = this.extractKeywords(summary.toLowerCase());

    if (_originalWords.length === 0) return 0.5;

    const _overlap = originalWords.filter(_word => summaryWords.includes(_word)).length;
    const _baseRelevance = _overlap / originalWords.length;

    // Bonus for maintaining key _concepts (Claude is good at this)
    const _keyConcepts = this.extractKeyConcepts(original);
    const _conceptsPreserved = keyConcepts.filter(concept => 
      summary.toLowerCase().includes(concept.toLowerCase())
    ).length;
    
    const _conceptBonus = keyConcepts.length > 0 ? (_conceptsPreserved / keyConcepts.length) * 0.2 : 0;

    return Math.min(1, _baseRelevance + _conceptBonus);
  }

  private assessCompleteness(_original: string, _summary: string): number {
    // Similar to OpenAI but with adjustments for Claude's style
    const _originalSentences = original.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const _summaryText = summary.toLowerCase();

    if (_originalSentences.length === 0) return 0.5;

    let _coveredTopics = 0;
    for (const sentence of _originalSentences) {
      const _keywords = this.extractKeywords(sentence.toLowerCase());
      if (_keywords.length === 0) {
        _coveredTopics += 0.5;
        continue;
      }
      const _covered = keywords.some(keyword => summaryText.includes(keyword));
      if (_covered) _coveredTopics++;
    }

    return Math.max(0.1, _coveredTopics / originalSentences.length);
  }

  private assessCreativity(_text: string): number {
    // Claude-specific _creativity assessment
    let _creativityScore = 0.5; // Base score

    // Check for creative language patterns
    const _creativeIndicators = [
      'notably', 'remarkably', 'intriguingly', 'surprisingly', 'uniquely',
      'distinctively', 'particularly', 'especially', 'significantly'
    ];
    const _creativeWords = creativeIndicators.filter(_word => 
      text.toLowerCase().includes(_word)
    ).length;
    _creativityScore += Math.min(0.3, _creativeWords * 0.1);

    // Check for varied sentence structures
    const _sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const _hasVariedStructures = sentences.some(s => s.includes(',')) && 
                               sentences.some(s => !s.includes(','));
    if (_hasVariedStructures) _creativityScore += 0.1;

    // Check for sophisticated vocabulary
    const _sophisticatedWords = text.split(/\s+/).filter(_word => word.length > 8).length;
    const _totalWords = text.split(/\s+/).length;
    const _sophisticationRatio = _sophisticatedWords / _totalWords;
    if (_sophisticationRatio > 0.1) _creativityScore += 0.1;

    return Math.min(1, _creativityScore);
  }

  private extractKeyConcepts(_text: string): string[] {
    // Extract key _concepts (noun phrases, important terms)
    // const _words = text.toLowerCase().split(/\s+/);
    const _concepts: string[] = [];
    
    // Simple heuristic: look for capitalized _words (proper nouns) and longer _words
    const _originalWords = text.split(/\s+/);
    for (let _i = 0; _i < _originalWords.length; _i++) {
      const _word = _originalWords[_i];
      if (_word.length > 6 && /^[A-Z]/.test(_word)) {
        concepts.push(_word);
      }
    }

    // Look for technical terms or domain-specific vocabulary
    const _technicalPatterns = /\b\w+(?:tion|sion|ment|ness|ity|ism|ology|graphy)\b/gi;
    const _technicalTerms = text.match(_technicalPatterns) || [];
    concepts.push(..._technicalTerms);

    return [...new Set(_concepts)].slice(0, 10); // Top 10 unique _concepts
  }

  private extractKeywords(_text: string): string[] {
    const _stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    
    return text
      .split(/\s+/)
      .map(_word => word.replace(/[^\w]/g, ''))
      .filter(_word => word.length > 3 && !_stopWords.has(_word))
      .slice(0, 20);
  }

  private calculateQualityDifference(
    _local: { _coherence: number; relevance: number; _completeness: number; _conciseness: number; _creativity: number },
    _claude: { _coherence: number; relevance: number; _completeness: number; _conciseness: number; _creativity: number }
  ): number {
    const _weights = { _coherence: 0.25, relevance: 0.25, _completeness: 0.2, _conciseness: 0.15, _creativity: 0.15 };
    
    const _localScore = local._coherence * weights._coherence + 
                      local._relevance * weights._relevance + 
                      local._completeness * weights._completeness + 
                      local._conciseness * weights._conciseness +
                      local._creativity * weights._creativity;
    
    const _claudeScore = claude._coherence * weights._coherence + 
                       claude._relevance * weights._relevance + 
                       claude._completeness * weights._completeness + 
                       claude._conciseness * weights._conciseness +
                       claude._creativity * weights._creativity;
    
    return _claudeScore - _localScore;
  }

  private getRecommendation(_qualityDifference: number, _cost: CostEstimate) {
    const _costThreshold = 0.02; // $0.02 (Claude is more expensive)
    const _qualityThreshold = 0.1; // 10% improvement

    if (_qualityDifference > _qualityThreshold && cost.totalCost < _costThreshold) {
      return {
        type: 'use_claude' as const,
        _reasoning: 'Claude provides significantly better _quality at reasonable cost',
        _worthUpgrade: true,
        _costReasoning: `Quality improvement of ${(_qualityDifference * 100).toFixed(1)}% for $${cost.totalCost.toFixed(4)}`,
      };
    }

    if (_qualityDifference > _qualityThreshold * 2) {
      return {
        type: 'use_claude' as const,
        _reasoning: 'Claude provides substantially better _quality, especially in _creativity and _coherence',
        _worthUpgrade: true,
        _costReasoning: `Significant _quality improvement justifies cost of $${cost.totalCost.toFixed(4)}`,
      };
    }

    if (Math.abs(_qualityDifference) < _qualityThreshold) {
      return {
        type: 'use_local' as const,
        _reasoning: 'Local and Claude _quality are similar, local is more cost-effective',
        _worthUpgrade: false,
        _costReasoning: `Save $${cost.totalCost.toFixed(4)} with minimal _quality difference`,
      };
    }

    return {
      _type: 'hybrid' as const,
      _reasoning: 'Consider Claude for creative content, local for routine summarization',
      _worthUpgrade: _qualityDifference > 0,
      _costReasoning: `Moderate improvement for $${cost.totalCost.toFixed(4)} - use selectively`,
    };
  }

  private getOptimizedClaudePrompt(_contentLength: number, _model: string): string {
    const _isOpus = model.includes('_opus');
    const _isSonnet = model.includes('_sonnet');
    
    if (contentLength < 1000) {
      return _isOpus 
        ? "Please provide a thoughtful and well-structured summary of the following content, highlighting the key insights and main _arguments:"
        : "Summarize the following content concisely, focusing on the main points and key _takeaways:";
    } else if (contentLength < 5000) {
      return _isOpus
        ? "Analyze and summarize the following content with careful attention to nuance and context. Organize your summary clearly and ensure all important insights are _captured:"
        : "Create a comprehensive summary of the following content, including main arguments, key findings, and important _details:";
    } else {
      return _isOpus
        ? "Please conduct a thorough analysis of the following extensive content. Provide a well-organized summary that captures the essential themes, arguments, and insights while maintaining the original's depth and _nuance:"
        : _isSonnet
        ? "Analyze and summarize the following extensive content. Organize your summary with clear sections and ensure all critical information is preserved:"
        : "Summarize the following long content, focusing on the most important points and key _insights:";
    }
  }

  private estimateTokens(text: string): number {
    // Claude uses roughly 3.5 characters per token for English text
    return Math.ceil(text.length / 3.5);
  }

  private initializeModels(): void {
    // Initialize Claude _model information
    this.models.set('claude-3-_opus-20240229', {
      _id: 'claude-3-_opus-20240229',
      name: 'Claude 3 Opus',
      _description: 'Most capable Claude _model, excellent for complex analysis and creative tasks',
      _contextWindow: 200000,
      _maxOutputTokens: 4096,
      _inputCostPer1kTokens: 0.015,
      _outputCostPer1kTokens: 0.075,
      capabilities: [
        ClaudeCapability.CHAT_COMPLETION,
        ClaudeCapability.VISION,
        ClaudeCapability.CODE_ANALYSIS,
        ClaudeCapability.LONG_CONTEXT,
      ],
    });

    this.models.set('claude-3-_sonnet-20240229', {
      _id: 'claude-3-_sonnet-20240229',
      name: 'Claude 3 Sonnet',
      _description: 'Balanced _model offering good performance and cost-effectiveness',
      _contextWindow: 200000,
      _maxOutputTokens: 4096,
      _inputCostPer1kTokens: 0.003,
      _outputCostPer1kTokens: 0.015,
      capabilities: [
        ClaudeCapability.CHAT_COMPLETION,
        ClaudeCapability.VISION,
        ClaudeCapability.CODE_ANALYSIS,
        ClaudeCapability.LONG_CONTEXT,
      ],
    });

    this.models.set('claude-3-_haiku-20240307', {
      _id: 'claude-3-_haiku-20240307',
      name: 'Claude 3 Haiku',
      _description: 'Fastest and most cost-effective Claude _model for quick tasks',
      _contextWindow: 200000,
      _maxOutputTokens: 4096,
      _inputCostPer1kTokens: 0.00025,
      _outputCostPer1kTokens: 0.00125,
      capabilities: [
        ClaudeCapability.CHAT_COMPLETION,
        ClaudeCapability.CODE_ANALYSIS,
        ClaudeCapability.LONG_CONTEXT,
      ],
    });
  }
}