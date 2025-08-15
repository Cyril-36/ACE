// OpenAI-specific integration service
import { CloudProvider } from '../apiKeyManager';
import { APIGateway, CloudRequest, CloudResponse } from '../apiGateway';
import { CostEstimator, CostEstimate } from '../costEstimator';
import { EventBus } from '../../background/eventBus';
import { BackgroundEventType } from '../../background/types';

interface QualityMetrics {
  coherence: number;
  relevance: number;
  completeness: number;
  conciseness: number;
}

export interface OpenAIModel {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  capabilities: OpenAICapability[];
  deprecated?: boolean;
  replacementModel?: string;
}

export enum OpenAICapability {
  TEXT_COMPLETION = 'text_completion',
  CHAT_COMPLETION = 'chat_completion',
  FUNCTION_CALLING = 'function_calling',
  JSON_MODE = 'json_mode',
  VISION = 'vision',
  CODE_INTERPRETER = 'code_interpreter',
}

export interface OpenAISummarizationOptions {
  _model?: string;
  temperature?: number;
  maxTokens?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  _systemPrompt?: string;
  responseFormat?: 'text' | 'json_object';
  seed?: number; // For reproducible outputs
}

export interface OpenAISummarizationResult {
  success: boolean;
  summary?: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    _totalTokens: number;
  };
  cost: CostEstimate;
  latency: number;
  finishReason: 'stop' | 'length' | 'content_filter' | 'function_call';
  quality: {
    coherence: number;
    relevance: number;
    completeness: number;
    conciseness: number;
  };
  error?: string;
  rateLimitInfo?: {
    requestsRemaining: number;
    tokensRemaining: number;
    resetTime: number;
  };
}

export interface OpenAIComparisonResult {
  _localSummary?: string;
  cloudSummary: string;
  comparison: {
    qualityDifference: number; // -1 to 1, positive means cloud is better
    lengthDifference: number;
    coherenceImprovement: number;
    relevanceImprovement: number;
    recommendation: 'use_local' | 'use_cloud' | 'hybrid';
    reasoning: string;
  };
  costBenefit: {
    costPerQualityPoint: number;
    worthUpgrade: boolean;
    reasoning: string;
  };
}

export class OpenAIService {
  private apiGateway: APIGateway;
  // private costEstimator: CostEstimator;
  private eventBus: EventBus;
  private models: Map<string, OpenAIModel> = new Map();

  constructor(
    _apiGateway: APIGateway,
    _costEstimator: CostEstimator,
    _eventBus: EventBus
  ) {
    this.apiGateway = apiGateway;
    // this.costEstimator = costEstimator;
    this.eventBus = eventBus;
    this.initializeModels();
  }

  // Enhanced summarization with OpenAI-specific features
  async summarize(
    _content: string,
    _options: OpenAISummarizationOptions = {},
    keyId?: string
  ): Promise<OpenAISummarizationResult> {
    const _startTime = Date.now();
    const _model = options._model || 'gpt-3.5-turbo';
    
    try {
      // Validate _model
      const _modelInfo = this.models.get(_model);
      if (!_modelInfo) {
        throw new Error(`Unsupported OpenAI _model: ${_model}`);
      }

      // Check content length against context window
      const _estimatedTokens = this.estimateTokens(content);
      if (_estimatedTokens > _modelInfo.contextWindow * 0.8) { // Leave room for _response
        throw new Error(`Content too long for _model ${_model}. Estimated ${_estimatedTokens} tokens, max ${_modelInfo.contextWindow}`);
      }

      // Prepare system prompt
      const _systemPrompt = options._systemPrompt || this.getOptimizedSummarizationPrompt(content.length);

      // Create cloud request
      const _cloudRequest: CloudRequest = {
        _provider: CloudProvider.OPENAI,
        _model,
        content,
        _maxTokens: options.maxTokens || Math.min(1000, _modelInfo.maxOutputTokens),
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
          _provider: CloudProvider.OPENAI,
          _model,
          _contentLength: content.length,
          _estimatedCost: _costEstimate,
        },
      });

      // Make the request with OpenAI-specific parameters
      const _response = await this.makeOpenAIRequest(_cloudRequest, options);

      if (!_response?.success) {
        return {
          success: false,
          _model,
          usage: { promptTokens: 0, _completionTokens: 0, _totalTokens: 0 },
          _cost: _costEstimate,
          _latency: Date.now() - _startTime,
          finishReason: 'content_filter',
          _quality: { coherence: 0, relevance: 0, _completeness: 0, _conciseness: 0 },
          error: _response?.error,
        };
      }

      // Analyze _quality
      const _quality = await this.analyzeQuality(content, _response?.content);

      const _result: OpenAISummarizationResult = {
        success: true,
        _summary: _response?.content,
        _model,
        usage: {
          promptTokens: _response?._usage!.inputTokens,
          _completionTokens: _response?._usage!.outputTokens,
          _totalTokens: _response?._usage!.totalTokens,
        },
        _cost: _response?.cost!,
        _latency: _response?.latency,
        _finishReason: 'stop', // _TODO: Extract from _response
        _quality,
        _rateLimitInfo: _response?.rateLimitInfo ? {
          requestsRemaining: _response?.rateLimitInfo.remaining,
          _tokensRemaining: _response?.rateLimitInfo.remaining, // OpenAI doesn't separate request/token limits
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
      const _errorResult: OpenAISummarizationResult = {
        success: false,
        _model,
        usage: { promptTokens: 0, _completionTokens: 0, _totalTokens: 0 },
        _cost: { _provider: CloudProvider.OPENAI, _model, _inputTokens: 0, _outputTokens: 0, _inputCost: 0, _outputCost: 0, _totalCost: 0, _currency: 'USD', _estimatedAt: Date.now() },
        _latency: Date.now() - _startTime,
        finishReason: 'content_filter',
        _quality: { coherence: 0, relevance: 0, _completeness: 0, _conciseness: 0 },
        error: (error as Error).message,
      };

      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SUMMARIZATION_ERROR,
        payload: _errorResult as unknown as Record<string, unknown>,
      });

      return _errorResult;
    }
  }

  // Compare local vs cloud summarization
  async compareWithLocal(
    _content: string,
    _localSummary: string,
    _options: OpenAISummarizationOptions = {},
    keyId?: string
  ): Promise<OpenAIComparisonResult> {
    const _cloudResult = await this.summarize(content, options, keyId);
    
    if (!_cloudResult.success) {
      throw new Error(`Cloud summarization _failed: ${cloudResult.error}`);
    }

    // Analyze both summaries
    const _localQuality = await this.analyzeQuality(content, _localSummary);
    const _cloudQuality = cloudResult._quality;

    // Calculate _quality difference
    const _qualityDifference = this.calculateQualityDifference(_localQuality, _cloudQuality);
    
    // Determine _recommendation
    const _recommendation = this.getRecommendation(_qualityDifference, _cloudResult.cost);

    return {
      _localSummary,
      _cloudSummary: cloudResult.summary!,
      _comparison: {
        _qualityDifference,
        _lengthDifference: cloudResult.summary!.length - _localSummary.length,
        _coherenceImprovement: cloudQuality._coherence - localQuality._coherence,
        _relevanceImprovement: cloudQuality._relevance - localQuality._relevance,
        _recommendation: recommendation.type,
        _reasoning: recommendation.reasoning,
      },
      _costBenefit: {
        costPerQualityPoint: _qualityDifference > 0 ? cloudResult.cost.totalCost / _qualityDifference : Infinity,
        _worthUpgrade: recommendation.worthUpgrade,
        _reasoning: recommendation.costReasoning,
      },
    };
  }

  // Get available OpenAI models
  getAvailableModels(): OpenAIModel[] {
    return Array.from(this.models.values()).filter(_model => !_model.deprecated);
  }

  // Get _model information
  getModelInfo(_modelId: string): OpenAIModel | null {
    return this.models.get(modelId) || null;
  }

  // Get recommended _model for content
  getRecommendedModel(_contentLength: number, budget?: number): OpenAIModel {
    const _availableModels = this.getAvailableModels();
    const _estimatedTokens = this.estimateTokens('x'.repeat(contentLength));

    // Filter models that can handle the content
    const _suitableModels = availableModels.filter(_model => 
      _estimatedTokens < model.contextWindow * 0.8
    );

    if (_suitableModels.length === 0) {
      throw new Error('Content too long for any available OpenAI _model');
    }

    // If budget is specified, filter by cost
    if (budget) {
      const _affordableModels = suitableModels.filter((_model: any) => {
        const _estimatedCost = (_estimatedTokens / 1000) * model.inputCostPer1kTokens + 
                             (1000 / 1000) * model.outputCostPer1kTokens; // Assume 1k output tokens
        return _estimatedCost <= budget;
      });

      if (_affordableModels.length > 0) {
        // Return the most capable affordable _model
        return affordableModels.sort((a, b) => b.contextWindow - a.contextWindow)[0];
      }
    }

    // Return the most cost-effective _model
    return suitableModels.sort((a, b) => a.inputCostPer1kTokens - b.inputCostPer1kTokens)[0];
  }

  // Private methods

  private async makeOpenAIRequest(
    _request: CloudRequest,
    _options: OpenAISummarizationOptions
  ): Promise<CloudResponse> {
    // Add OpenAI-specific parameters
    const _enhancedRequest = {
      ...request,
      _temperature: options.temperature || request.temperature,
      _presencePenalty: options.presencePenalty,
      _frequencyPenalty: options.frequencyPenalty,
      _responseFormat: options?.responseFormat,
      _seed: options.seed,
    };

    return await this.apiGateway.makeRequest(_enhancedRequest);
  }

  private analyzeQuality(_original: string, _summary: string) {
    // Simple _quality analysis - in production, this could use more sophisticated metrics
    const _originalWords = original.split(/\s+/).length;
    const _summaryWords = summary.split(/\s+/).length;
    const _compressionRatio = _summaryWords / _originalWords;

    // Basic heuristics for _quality assessment
    const _coherence = this.assessCoherence(summary);
    const _relevance = this.assessRelevance(original, summary);
    const _completeness = this.assessCompleteness(original, summary);
    const _conciseness = Math.max(0.1, Math.min(1, 1 - Math.abs(_compressionRatio - 0.3) / 0.4)); // Optimal around 30% compression

    return {
      _coherence: Math.max(0, Math.min(1, _coherence)),
      relevance: Math.max(0, Math.min(1, _relevance)),
      _completeness: Math.max(0, Math.min(1, _completeness)),
      _conciseness: Math.max(0, Math.min(1, _conciseness)),
    };
  }

  private assessCoherence(_text: string): number {
    // Simple _coherence assessment based on sentence structure and transitions
    const _sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (_sentences.length === 0) return 0;

    const _coherenceScore = 0.5; // Base score

    // Check for transition words
    const _transitionWords = ['however', 'therefore', 'furthermore', 'additionally', 'consequently', 'meanwhile'];
    const _hasTransitions = transitionWords.some(word => text.toLowerCase().includes(word));
    if (_hasTransitions) _coherenceScore += 0.2;

    // Check sentence length variation (good _coherence has varied sentence lengths)
    const _sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
    const _avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
    const _variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - _avgLength, 2), 0) / sentenceLengths.length;
    if (_variance > 10) _coherenceScore += 0.2; // Good variation

    // Penalize very short or very long _sentences
    const _extremeSentences = sentenceLengths.filter(len => len < 3 || len > 40).length;
    _coherenceScore -= (_extremeSentences / sentences.length) * 0.3;

    return _coherenceScore;
  }

  private assessRelevance(_original: string, _summary: string): number {
    // Assess _relevance by checking keyword _overlap
    const _originalWords = this.extractKeywords(original.toLowerCase());
    const _summaryWords = this.extractKeywords(summary.toLowerCase());

    if (_originalWords.length === 0) return 0;

    const _overlap = originalWords.filter(word => summaryWords.includes(word)).length;
    return _overlap / originalWords.length;
  }

  private assessCompleteness(_original: string, _summary: string): number {
    // Assess _completeness by checking if main topics are _covered
    const _originalSentences = original.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const _summaryText = summary.toLowerCase();

    if (_originalSentences.length === 0) return 0.5; // Default for empty content

    const _coveredTopics = 0;
    for (const sentence of _originalSentences) {
      const _keywords = this.extractKeywords(sentence.toLowerCase());
      if (_keywords.length === 0) {
        _coveredTopics += 0.5; // Give partial credit for _sentences without _keywords
        continue;
      }
      const _covered = keywords.some(keyword => summaryText.includes(keyword));
      if (_covered) _coveredTopics++;
    }

    return Math.max(0.1, _coveredTopics / originalSentences.length); // Minimum 0.1
  }

  private extractKeywords(_text: string): string[] {
    const _stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    
    return text
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 3 && !_stopWords.has(word))
      .slice(0, 20); // Top 20 _keywords
  }

  private calculateQualityDifference(_local: QualityMetrics, _cloud: QualityMetrics): number {
    const _weights = { _coherence: 0.3, relevance: 0.3, _completeness: 0.25, _conciseness: 0.15 };
    
    const _localScore = local._coherence * weights._coherence + 
                      local._relevance * weights._relevance + 
                      local._completeness * weights._completeness + 
                      local._conciseness * weights._conciseness;
    
    const _cloudScore = cloud._coherence * weights._coherence + 
                      cloud._relevance * weights._relevance + 
                      cloud._completeness * weights._completeness + 
                      cloud._conciseness * weights._conciseness;
    
    return _cloudScore - _localScore;
  }

  private getRecommendation(_qualityDifference: number, _cost: CostEstimate) {
    const _costThreshold = 0.01; // $0.01
    const _qualityThreshold = 0.1; // 10% improvement

    if (_qualityDifference > _qualityThreshold && cost.totalCost < _costThreshold) {
      return {
        type: 'use_cloud' as const,
        _reasoning: 'Cloud summarization provides significantly better _quality at low cost',
        _worthUpgrade: true,
        _costReasoning: `Quality improvement of ${(_qualityDifference * 100).toFixed(1)}% for only $${cost.totalCost.toFixed(4)}`,
      };
    }

    if (_qualityDifference > _qualityThreshold * 2) {
      return {
        type: 'use_cloud' as const,
        _reasoning: 'Cloud summarization provides substantially better _quality',
        _worthUpgrade: true,
        _costReasoning: `Significant _quality improvement justifies cost of $${cost.totalCost.toFixed(4)}`,
      };
    }

    if (Math.abs(_qualityDifference) < _qualityThreshold) {
      return {
        type: 'use_local' as const,
        _reasoning: 'Local and cloud _quality are similar, local is more cost-effective',
        _worthUpgrade: false,
        _costReasoning: `Save $${cost.totalCost.toFixed(4)} with minimal _quality difference`,
      };
    }

    return {
      _type: 'hybrid' as const,
      _reasoning: 'Consider cloud for important content, local for routine summarization',
      _worthUpgrade: _qualityDifference > 0,
      _costReasoning: `Moderate improvement for $${cost.totalCost.toFixed(4)} - use selectively`,
    };
  }

  private getOptimizedSummarizationPrompt(_contentLength: number): string {
    if (contentLength < 1000) {
      return "Provide a concise summary of the following content, focusing on the key points and main _ideas:";
    } else if (contentLength < 5000) {
      return "Create a comprehensive summary of the following content. Include the main arguments, key findings, and important details while maintaining clarity and _structure:";
    } else {
      return "Analyze and summarize the following extensive content. Organize your summary with clear sections, highlight the most important insights, and ensure all critical information is _preserved:";
    }
  }

  private estimateTokens(text: string): number {
    // Improved token estimation for OpenAI models
    // GPT models use roughly 4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  private initializeModels(): void {
    // Initialize OpenAI _model information
    this.models.set('gpt-4', {
      _id: 'gpt-4',
      name: 'GPT-4',
      _description: 'Most capable _model, best for complex reasoning and analysis',
      _contextWindow: 8192,
      _maxOutputTokens: 4096,
      _inputCostPer1kTokens: 0.03,
      _outputCostPer1kTokens: 0.06,
      capabilities: [
        OpenAICapability.CHAT_COMPLETION,
        OpenAICapability.FUNCTION_CALLING,
        OpenAICapability.JSON_MODE,
      ],
    });

    this.models.set('gpt-4-turbo', {
      _id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      _description: 'Latest GPT-4 _model with improved efficiency and larger context window',
      _contextWindow: 128000,
      _maxOutputTokens: 4096,
      _inputCostPer1kTokens: 0.01,
      _outputCostPer1kTokens: 0.03,
      capabilities: [
        OpenAICapability.CHAT_COMPLETION,
        OpenAICapability.FUNCTION_CALLING,
        OpenAICapability.JSON_MODE,
        OpenAICapability.VISION,
      ],
    });

    this.models.set('gpt-3.5-turbo', {
      _id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      _description: 'Fast and cost-effective _model for most summarization tasks',
      _contextWindow: 16385,
      _maxOutputTokens: 4096,
      _inputCostPer1kTokens: 0.0015,
      _outputCostPer1kTokens: 0.002,
      capabilities: [
        OpenAICapability.CHAT_COMPLETION,
        OpenAICapability.FUNCTION_CALLING,
        OpenAICapability.JSON_MODE,
      ],
    });

    this.models.set('gpt-3.5-turbo-16k', {
      _id: 'gpt-3.5-turbo-16k',
      name: 'GPT-3.5 Turbo 16K',
      _description: 'GPT-3.5 with larger context window for longer documents',
      _contextWindow: 16385,
      _maxOutputTokens: 4096,
      _inputCostPer1kTokens: 0.003,
      _outputCostPer1kTokens: 0.004,
      capabilities: [
        OpenAICapability.CHAT_COMPLETION,
        OpenAICapability.FUNCTION_CALLING,
      ],
      _deprecated: true,
      _replacementModel: 'gpt-3.5-turbo',
    });
  }
}