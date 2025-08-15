// Gemini-specific integration service
import { CloudProvider } from '../apiKeyManager';
import { APIGateway, CloudRequest, CloudResponse } from '../apiGateway';
import { CostEstimator, CostEstimate } from '../costEstimator';
import { EventBus } from '../../background/eventBus';
import { BackgroundEventType } from '../../background/types';

export interface GeminiModel {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  capabilities: GeminiCapability[];
  deprecated?: boolean;
  replacementModel?: string;
}

export enum GeminiCapability {
  TEXT_COMPLETION = 'text_completion',
  CHAT_COMPLETION = 'chat_completion',
  VISION = 'vision',
  CODE_GENERATION = 'code_generation',
  MULTIMODAL = 'multimodal',
  FUNCTION_CALLING = 'function_calling',
}

export interface GeminiSummarizationOptions {
  _model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  _systemPrompt?: string;
  candidateCount?: number;
  stopSequences?: string[];
  safetySettings?: GeminiSafetySettings[];
}

export interface GeminiSafetySettings {
  category: 'HARM_CATEGORY_HARASSMENT' | 'HARM_CATEGORY_HATE_SPEECH' | 'HARM_CATEGORY_SEXUALLY_EXPLICIT' | 'HARM_CATEGORY_DANGEROUS_CONTENT';
  threshold: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
}

export interface GeminiSummarizationResult {
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
  finishReason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
  quality: {
    coherence: number;
    relevance: number;
    completeness: number;
    conciseness: number;
    factualAccuracy: number; // Gemini-specific metric
  };
  safetyRatings?: GeminiSafetyRating[];
  error?: string;
  rateLimitInfo?: {
    requestsRemaining: number;
    tokensRemaining: number;
    resetTime: number;
  };
}

export interface GeminiSafetyRating {
  category: string;
  probability: 'NEGLIGIBLE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface GeminiComparisonResult {
  _localSummary?: string;
  geminiSummary: string;
  comparison: {
    qualityDifference: number;
    factualAccuracyImprovement: number;
    lengthDifference: number;
    coherenceImprovement: number;
    relevanceImprovement: number;
    recommendation: 'use_local' | 'use_gemini' | 'hybrid';
    reasoning: string;
  };
  costBenefit: {
    costPerQualityPoint: number;
    worthUpgrade: boolean;
    reasoning: string;
  };
}

export class GeminiService {
  private apiGateway: APIGateway;
  // private costEstimator: CostEstimator;
  private eventBus: EventBus;
  private models: Map<string, GeminiModel> = new Map();

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

  // Enhanced summarization with Gemini-specific features
  async summarize(
    _content: string,
    _options: GeminiSummarizationOptions = {},
    keyId?: string
  ): Promise<GeminiSummarizationResult> {
    const _startTime = Date.now();
    const _model = _options._model || 'gemini-pro';
    
    try {
      // Validate _model
      const _modelInfo = this.models.get(_model);
      if (!_modelInfo) {
        throw new Error(`Unsupported Gemini _model: ${_model}`);
      }

      // Check content length against context window
      const _estimatedTokens = this.estimateTokens(content);
      if (_estimatedTokens > _modelInfo.contextWindow * 0.8) {
        throw new Error(`Content too long for _model ${_model}. Estimated ${_estimatedTokens} tokens, max ${_modelInfo.contextWindow}`);
      }

      // Prepare system prompt optimized for Gemini
      const _systemPrompt = options._systemPrompt || this.getOptimizedGeminiPrompt(content.length, _model);

      // Create cloud request
      const _cloudRequest: CloudRequest = {
        _provider: CloudProvider.GEMINI,
        _model,
        content,
        _maxTokens: options.maxTokens || Math.min(2048, _modelInfo.maxOutputTokens),
        _temperature: options.temperature || 0.4,
        _systemPrompt,
        keyId,
      };

      // Get cost estimate
      const _costEstimate = await this.apiGateway.getCostEstimate(_cloudRequest);

      // Emit pre-summarization event
      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SUMMARIZATION_START,
        payload: {
          _provider: CloudProvider.GEMINI,
          _model,
          _contentLength: content.length,
          _estimatedCost: _costEstimate,
        },
      });

      // Make the request with Gemini-specific parameters
      const _response = await this.makeGeminiRequest(_cloudRequest, options);

      if (!_response?.success) {
        return {
          success: false,
          _model,
          usage: { _inputTokens: 0, _outputTokens: 0, _totalTokens: 0 },
          _cost: _costEstimate,
          _latency: Date.now() - _startTime,
          _finishReason: 'OTHER',
          _quality: { coherence: 0, relevance: 0, _completeness: 0, _conciseness: 0, _factualAccuracy: 0 },
          error: _response?.error,
        };
      }

      // Analyze _quality with Gemini-specific metrics
      const _quality = await this.analyzeGeminiQuality(content, _response?.content!);

      const _result: GeminiSummarizationResult = {
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
        _finishReason: 'STOP', // _TODO: Extract from _response
        _quality,
        _rateLimitInfo: _response?.rateLimitInfo ? {
          requestsRemaining: _response?.rateLimitInfo.remaining,
          _tokensRemaining: _response?.rateLimitInfo.remaining, // Gemini doesn't separate request/token limits
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
      const _errorResult: GeminiSummarizationResult = {
        success: false,
        _model,
        usage: { _inputTokens: 0, _outputTokens: 0, _totalTokens: 0 },
        _cost: { _provider: CloudProvider.GEMINI, _model, _inputTokens: 0, _outputTokens: 0, _inputCost: 0, _outputCost: 0, _totalCost: 0, _currency: 'USD', _estimatedAt: Date.now() },
        _latency: Date.now() - _startTime,
        _finishReason: 'OTHER',
        _quality: { coherence: 0, relevance: 0, _completeness: 0, _conciseness: 0, _factualAccuracy: 0 },
        error: (error as Error).message,
      };

      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SUMMARIZATION_ERROR,
        payload: _errorResult as unknown as Record<string, unknown>,
      });

      return _errorResult;
    }
  }

  // Compare local vs Gemini summarization
  async compareWithLocal(
    _content: string,
    _localSummary: string,
    _options: GeminiSummarizationOptions = {},
    keyId?: string
  ): Promise<GeminiComparisonResult> {
    const _geminiResult = await this.summarize(content, options, keyId);
    
    if (!_geminiResult.success) {
      throw new Error(`Gemini summarization _failed: ${geminiResult.error}`);
    }

    // Analyze both summaries
    const _localQuality = await this.analyzeGeminiQuality(content, _localSummary);
    const _geminiQuality = geminiResult._quality;

    // Calculate _quality difference
    const _qualityDifference = this.calculateQualityDifference(_localQuality, _geminiQuality);
    
    // Determine _recommendation
    const _recommendation = this.getRecommendation(_qualityDifference, _geminiResult.cost);

    return {
      _localSummary,
      _geminiSummary: geminiResult.summary!,
      _comparison: {
        _qualityDifference,
        _factualAccuracyImprovement: geminiQuality._factualAccuracy - localQuality._factualAccuracy,
        _lengthDifference: geminiResult.summary!.length - _localSummary.length,
        _coherenceImprovement: geminiQuality._coherence - localQuality._coherence,
        _relevanceImprovement: geminiQuality._relevance - localQuality._relevance,
        _recommendation: recommendation.type,
        _reasoning: recommendation.reasoning,
      },
      _costBenefit: {
        costPerQualityPoint: _qualityDifference > 0 ? geminiResult.cost.totalCost / _qualityDifference : Infinity,
        _worthUpgrade: recommendation.worthUpgrade,
        _reasoning: recommendation.costReasoning,
      },
    };
  }

  // Get available Gemini models
  getAvailableModels(): GeminiModel[] {
    return Array.from(this.models.values()).filter(_model => !_model.deprecated);
  }

  // Get _model information
  getModelInfo(_modelId: string): GeminiModel | null {
    return this.models.get(modelId) || null;
  }

  // Get recommended _model for content
  getRecommendedModel(_contentLength: number, budget?: number): GeminiModel {
    const _availableModels = this.getAvailableModels();
    const _estimatedTokens = this.estimateTokens(String(contentLength));

    // Filter models that can handle the content
    const _suitableModels = availableModels.filter(_model => 
      _estimatedTokens < model.contextWindow * 0.8
    );

    if (_suitableModels.length === 0) {
      throw new Error('Content too long for any available Gemini _model');
    }

    // If budget is specified, filter by cost
    if (budget) {
      const _affordableModels = suitableModels.filter((_model: any) => {
        const _estimatedCost = (_estimatedTokens / 1000) * model.inputCostPer1kTokens + 
                             (2000 / 1000) * model.outputCostPer1kTokens; // Assume 2k output tokens
        return _estimatedCost <= budget;
      });

      if (_affordableModels.length > 0) {
        // Return the most capable affordable _model
        return affordableModels.sort((a, b) => b.contextWindow - a.contextWindow)[0];
      }
    }

    // For vision content, prefer vision-capable models
    if (this.containsVisualReferences(String(contentLength))) {
      const _visionModels = suitableModels.filter(_model => 
        model.capabilities.includes(GeminiCapability.VISION)
      );
      if (_visionModels.length > 0) {
        return _visionModels[0];
      }
    }

    // Return the most cost-effective _model (Gemini is generally very affordable)
    return suitableModels.sort((a, b) => a.inputCostPer1kTokens - b.inputCostPer1kTokens)[0];
  }

  // Private methods

  private async makeGeminiRequest(
    _request: CloudRequest,
    _options: GeminiSummarizationOptions
  ): Promise<CloudResponse> {
    // Add Gemini-specific parameters
    const _enhancedRequest = {
      ...request,
      _temperature: options.temperature || request.temperature,
      _topP: options.topP,
      _topK: options.topK,
      _candidateCount: options.candidateCount || 1,
      _stopSequences: options.stopSequences,
      _safetySettings: options.safetySettings,
    };

    return await this.apiGateway.makeRequest(_enhancedRequest);
  }

  private analyzeGeminiQuality(_original: string, _summary: string) {
    // Enhanced _quality analysis with Gemini-specific factual accuracy metric
    const _originalWords = original.split(/\s+/).length;
    const _summaryWords = summary.split(/\s+/).length;
    const _compressionRatio = _summaryWords / _originalWords;

    // Basic heuristics for _quality assessment
    const _coherence = this.assessCoherence(summary);
    const _relevance = this.assessRelevance(original, summary);
    const _completeness = this.assessCompleteness(original, summary);
    const _conciseness = Math.max(0.1, Math.min(1, 1 - Math.abs(_compressionRatio - 0.3) / 0.4));
    const _factualAccuracy = this.assessFactualAccuracy(original, summary); // Gemini-specific

    return {
      _coherence: Math.max(0, Math.min(1, _coherence)),
      relevance: Math.max(0, Math.min(1, _relevance)),
      _completeness: Math.max(0, Math.min(1, _completeness)),
      _conciseness: Math.max(0, Math.min(1, _conciseness)),
      _factualAccuracy: Math.max(0, Math.min(1, _factualAccuracy)),
    };
  }

  private assessCoherence(_text: string): number {
    // Gemini-optimized _coherence assessment
    const _sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (_sentences.length === 0) return 0;

    let _coherenceScore = 0.5;

    // Gemini tends to use clear, structured language
    const _structuralIndicators = ['first', 'second', 'third', 'next', 'then', 'finally', 'in summary', 'overall', 'in conclusion'];
    const _hasStructure = structuralIndicators.some(indicator => text.toLowerCase().includes(indicator));
    if (_hasStructure) _coherenceScore += 0.2;

    // Check for logical connectors
    const _logicalConnectors = ['because', 'therefore', 'however', 'although', 'while', 'since', 'as a _result'];
    const _hasLogic = logicalConnectors.some(connector => text.toLowerCase().includes(connector));
    if (_hasLogic) _coherenceScore += 0.2;

    // Gemini tends to maintain consistent terminology
    const _words = text.toLowerCase().split(/\s+/);
    const _uniqueWords = new Set(_words);
    const _repetitionRatio = words.length / uniqueWords.size;
    if (_repetitionRatio > 1.2 && _repetitionRatio < 2.0) _coherenceScore += 0.1; // Good repetition for consistency

    return Math.min(1, _coherenceScore);
  }

  private assessRelevance(_original: string, _summary: string): number {
    // Enhanced _relevance assessment for Gemini
    const _originalWords = this.extractKeywords(original.toLowerCase());
    const _summaryWords = this.extractKeywords(summary.toLowerCase());

    if (_originalWords.length === 0) return 0.5;

    const _overlap = originalWords.filter(_word => summaryWords.includes(_word)).length;
    const _baseRelevance = _overlap / originalWords.length;

    // Bonus for maintaining numerical data (Gemini is good with facts/figures)
    const _originalNumbers = this.extractNumbers(original);
    const _summaryNumbers = this.extractNumbers(summary);
    const _numberOverlap = originalNumbers.filter(num => summaryNumbers.includes(num)).length;
    const _numberBonus = originalNumbers.length > 0 ? (_numberOverlap / originalNumbers.length) * 0.15 : 0;

    return Math.min(1, _baseRelevance + _numberBonus);
  }

  private assessCompleteness(_original: string, _summary: string): number {
    // Similar to other providers but with Gemini-specific adjustments
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

  private assessFactualAccuracy(_original: string, _summary: string): number {
    // Gemini-specific factual accuracy assessment
    let _accuracyScore = 0.7; // Base score (Gemini is generally accurate)

    // Check for preservation of numbers and dates
    const _originalNumbers = this.extractNumbers(original);
    const _summaryNumbers = this.extractNumbers(summary);
    
    if (_originalNumbers.length > 0) {
      const _numberAccuracy = summaryNumbers.filter(num => originalNumbers.includes(num)).length / originalNumbers.length;
      _accuracyScore = _accuracyScore * 0.7 + _numberAccuracy * 0.3;
    }

    // Check for preservation of proper nouns (names, places, etc.)
    const _originalProperNouns = this.extractProperNouns(original);
    const _summaryProperNouns = this.extractProperNouns(summary);
    
    if (_originalProperNouns.length > 0) {
      const _nounAccuracy = summaryProperNouns.filter(noun => 
        originalProperNouns.some(orig => orig.toLowerCase() === noun.toLowerCase())
      ).length / originalProperNouns.length;
      _accuracyScore = _accuracyScore * 0.8 + _nounAccuracy * 0.2;
    }

    // Penalty for contradictory statements
    const _hasContradictions = this.detectContradictions(original, summary);
    if (_hasContradictions) _accuracyScore *= 0.7;

    return Math.min(1, _accuracyScore);
  }

  private extractNumbers(_text: string): string[] {
    const _numberPattern = /\b\d+(?:\.\d+)?(?:%|k|m|b|billion|million|thousand)?\b/gi;
    return text.match(_numberPattern) || [];
  }

  private extractProperNouns(_text: string): string[] {
    // Simple _heuristic: _words that start with capital letters and aren't at sentence beginnings
    const _words = text.split(/\s+/);
    const _properNouns: string[] = [];
    
    for (let _i = 0; _i < _words.length; _i++) {
      const _word = _words[_i].replace(/[^\w]/g, '');
      const _prevWord = _i > 0 ? _words[_i - 1] : '';
      
      if (_word.length > 1 && /^[A-Z]/.test(_word) && !/[.!?]$/.test(_prevWord)) {
        properNouns.push(_word);
      }
    }
    
    return [...new Set(_properNouns)];
  }

  private detectContradictions(_original: string, _summary: string): boolean {
    // Simple contradiction detection
    const _negationWords = ['not', 'no', 'never', 'none', 'nothing', 'nobody'];
    const _originalNegations = negationWords.filter(_word => original.toLowerCase().includes(_word));
    const _summaryNegations = negationWords.filter(_word => summary.toLowerCase().includes(_word));
    
    // If there's a significant difference in negation usage, there might be contradictions
    return Math.abs(_originalNegations.length - summaryNegations.length) > 2;
  }

  private containsVisualReferences(_content: string): boolean {
    const _visualKeywords = ['image', 'picture', 'photo', 'diagram', 'chart', 'graph', 'figure', 'visual', 'screenshot'];
    return visualKeywords.some(keyword => content.toLowerCase().includes(keyword));
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
    _local: { _coherence: number; relevance: number; _completeness: number; _conciseness: number; _factualAccuracy: number },
    _gemini: { _coherence: number; relevance: number; _completeness: number; _conciseness: number; _factualAccuracy: number }
  ): number {
    const _weights = { _coherence: 0.2, relevance: 0.25, _completeness: 0.2, _conciseness: 0.15, _factualAccuracy: 0.2 };
    
    const _localScore = local._coherence * weights._coherence + 
                      local._relevance * weights._relevance + 
                      local._completeness * weights._completeness + 
                      local._conciseness * weights._conciseness +
                      local._factualAccuracy * weights._factualAccuracy;
    
    const _geminiScore = gemini._coherence * weights._coherence + 
                       gemini._relevance * weights._relevance + 
                       gemini._completeness * weights._completeness + 
                       gemini._conciseness * weights._conciseness +
                       gemini._factualAccuracy * weights._factualAccuracy;
    
    return _geminiScore - _localScore;
  }

  private getRecommendation(_qualityDifference: number, _cost: CostEstimate) {
    const _costThreshold = 0.005; // $0.005 (Gemini is very affordable)
    const _qualityThreshold = 0.1; // 10% improvement

    if (_qualityDifference > _qualityThreshold && cost.totalCost < _costThreshold) {
      return {
        type: 'use_gemini' as const,
        _reasoning: 'Gemini provides better _quality at very low cost',
        _worthUpgrade: true,
        _costReasoning: `Quality improvement of ${(_qualityDifference * 100).toFixed(1)}% for only $${cost.totalCost.toFixed(4)}`,
      };
    }

    if (_qualityDifference > _qualityThreshold * 1.5) {
      return {
        type: 'use_gemini' as const,
        _reasoning: 'Gemini provides significantly better _quality, especially in factual accuracy',
        _worthUpgrade: true,
        _costReasoning: `Good _quality improvement for minimal cost of $${cost.totalCost.toFixed(4)}`,
      };
    }

    if (Math.abs(_qualityDifference) < _qualityThreshold) {
      return {
        type: 'use_local' as const,
        _reasoning: 'Local and Gemini _quality are similar, local saves cost',
        _worthUpgrade: false,
        _costReasoning: `Save $${cost.totalCost.toFixed(4)} with minimal _quality difference`,
      };
    }

    return {
      _type: 'hybrid' as const,
      _reasoning: 'Consider Gemini for factual content, local for general summarization',
      _worthUpgrade: _qualityDifference > 0,
      _costReasoning: `Moderate improvement for very low cost of $${cost.totalCost.toFixed(4)}`,
    };
  }

  private getOptimizedGeminiPrompt(_contentLength: number, _model: string): string {
    const _isVisionModel = model.includes('vision');
    
    if (contentLength < 1000) {
      return _isVisionModel
        ? "Analyze and summarize the following content, paying attention to any visual elements or references. Provide a clear and accurate _summary:"
        : "Provide a clear and accurate summary of the following content, focusing on the key facts and main _points:";
    } else if (contentLength < 5000) {
      return "Create a comprehensive summary of the following content. Ensure accuracy and include all important facts, figures, and key _insights:";
    } else {
      return "Analyze the following extensive content and provide a well-structured summary. Maintain factual accuracy and organize the information clearly with proper emphasis on key findings and conclusions:";
    }
  }

  private estimateTokens(text: string): number {
    // Gemini uses roughly 4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  private initializeModels(): void {
    // Initialize Gemini _model information
    this.models.set('gemini-pro', {
      _id: 'gemini-pro',
      name: 'Gemini Pro',
      _description: 'Google\'s most capable text _model, excellent for reasoning and analysis',
      _contextWindow: 32768,
      _maxOutputTokens: 8192,
      _inputCostPer1kTokens: 0.0005,
      _outputCostPer1kTokens: 0.0015,
      capabilities: [
        GeminiCapability.CHAT_COMPLETION,
        GeminiCapability.CODE_GENERATION,
        GeminiCapability.FUNCTION_CALLING,
      ],
    });

    this.models.set('gemini-pro-vision', {
      _id: 'gemini-pro-vision',
      name: 'Gemini Pro Vision',
      _description: 'Multimodal _model capable of understanding both text and images',
      _contextWindow: 16384,
      _maxOutputTokens: 2048,
      _inputCostPer1kTokens: 0.0005,
      _outputCostPer1kTokens: 0.0015,
      capabilities: [
        GeminiCapability.CHAT_COMPLETION,
        GeminiCapability.VISION,
        GeminiCapability.MULTIMODAL,
      ],
    });

    // _Note: Gemini 1.5 models would be added here when available
    this.models.set('gemini-1.5-pro', {
      _id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      _description: 'Next-generation Gemini with improved capabilities and larger context',
      _contextWindow: 1000000, // 1M token context window
      _maxOutputTokens: 8192,
      _inputCostPer1kTokens: 0.0035,
      _outputCostPer1kTokens: 0.0105,
      capabilities: [
        GeminiCapability.CHAT_COMPLETION,
        GeminiCapability.VISION,
        GeminiCapability.CODE_GENERATION,
        GeminiCapability.MULTIMODAL,
        GeminiCapability.FUNCTION_CALLING,
      ],
    });
  }
}