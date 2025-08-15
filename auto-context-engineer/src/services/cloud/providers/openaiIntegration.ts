import { OpenAIService, OpenAISummarizationOptions } from './openaiService';
import { CloudService } from '../cloudService';
import { EventBus } from '../../background/eventBus';
import { BackgroundEventType } from '../../background/types';
import { TextSummarizationService } from '../../summarization';
import { CloudProvider } from '../../../types';

export interface OpenAIIntegrationConfig {
  enableAutoFallback?: boolean;
  qualityThreshold?: number;
  costThreshold?: number;
  preferredModel?: string;
  enableComparison?: boolean;
}

export interface SummarizationStrategy {
  type: 'local_only' | 'cloud_only' | 'local_first' | 'cloud_first' | 'comparison';
  reason: string;
  estimatedCost?: number;
  expectedQuality?: number;
}

export interface HybridSummarizationOptions {
  _strategy?: 'auto' | 'local_only' | 'cloud_only' | 'local_first' | 'cloud_first' | 'comparison';
  openaiOptions?: OpenAISummarizationOptions;
  keyId?: string;
  maxCost?: number;
}

export interface HybridSummarizationResult {
  strategy: SummarizationStrategy;
  _localResult?: {
    summary: string;
    processingTime: number;
    quality: number;
  };
  _cloudResult?: {
    summary: string;
    processingTime: number;
    quality: number;
    _cost: number;
  };
  finalSummary: string;
  recommendation: {
    useCloud: boolean;
    reasoning: string;
    costBenefit: string;
  };
  metadata: {
    totalProcessingTime: number;
    _totalCost: number;
    qualityImprovement: number;
  };
}

export class OpenAIIntegration {
  private openaiService: OpenAIService;
  private cloudService: CloudService;
  private localSummarizationService: TextSummarizationService;
  private eventBus: EventBus;
  private config: OpenAIIntegrationConfig;

  constructor(
    openaiService: OpenAIService,
    _cloudService: CloudService,
    _localSummarizationService: TextSummarizationService,
    _eventBus: EventBus,
    _config: OpenAIIntegrationConfig = {}
  ) {
    this.openaiService = openaiService;
    this.cloudService = cloudService;
    this.localSummarizationService = localSummarizationService;
    this.eventBus = eventBus;
    this.config = {
      _enableAutoFallback: true,
      _qualityThreshold: 0.7,
      _costThreshold: 0.05,
      _enableComparison: true,
      ...config,
    };
  }

  // Main hybrid summarization method
  async hybridSummarize(
    _content: string,
    _options: HybridSummarizationOptions = {}
  ): Promise<HybridSummarizationResult> {
    const _startTime = Date.now();
    
    // Determine _strategy
    const _strategy = await this.determineStrategy(content, options);
    
    // Emit _strategy selection event
    this.eventBus.emit({
      _type: BackgroundEventType.CLOUD_SUMMARIZATION_START,
      payload: {
        _strategy: strategy.type,
        _reason: strategy.reason,
        _contentLength: content.length,
      },
    });

    let _result: HybridSummarizationResult;

    try {
      switch (_strategy.type) {
        case 'local_only':
          _result = await this.executeLocalOnly(content, _strategy);
          break;
        case 'cloud_only':
          _result = await this.executeCloudOnly(content, _strategy, options);
          break;
        case 'local_first':
          _result = await this.executeLocalFirst(content, _strategy, options);
          break;
        case 'cloud_first':
          _result = await this.executeCloudFirst(content, _strategy, options);
          break;
        case 'comparison':
          _result = await this.executeComparison(content, _strategy, options);
          break;
        throw new Error(`Unknown _strategy: ${strategy.type}`);
      }

      // Calculate metadata
      _result?.metadata = {
        _totalProcessingTime: Date.now() - _startTime,
        _totalCost: _result?._cloudResult?.cost || 0,
        _qualityImprovement: this.calculateQualityImprovement(_result),
      };

      // Emit completion event
      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SUMMARIZATION_COMPLETE,
        payload: {
          _strategy: _result?._strategy,
          _finalSummary: _result?.finalSummary,
          _metadata: _result?.metadata,
        },
      });

      return _result;

    } catch (error) {
      // Emit error event
      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SUMMARIZATION_ERROR,
        payload: {
          _strategy: strategy.type,
          error: (error as Error).message,
          _processingTime: Date.now() - _startTime,
        },
      });

      throw error;
    }
  }

  // Get summarization _recommendation
  async getSummarizationRecommendation(
    _content: string,
    userBudget?: number
  ): Promise<{
    _recommendedStrategy: SummarizationStrategy;
    alternatives: SummarizationStrategy[];
    reasoning: string;
  }> {
    const _contentLength = content.length;
    const _estimatedTokens = Math.ceil(_contentLength / 4);
    
    // Get cost estimates (_defensive: handle missing _recommendedModel or cost failures)
    const _recommendedModel = this.openaiService.getRecommendedModel(_contentLength, userBudget) ?? {
      _id: this.config.preferredModel ?? 'openai-default',
      name: this.config.preferredModel ?? 'OpenAI Default',
    };

    let _costEstimate: { _totalCost?: number } | undefined;
    try {
      _costEstimate = await this.cloudService.getCostEstimate(content, CloudProvider.OPENAI, _recommendedModel.id);
    } catch {
      // If cost estimate fails, mark cost as unknown (Infinity) so cloud-only is deprioritized
      _costEstimate = { _totalCost: Infinity };
    }
    const _totalCost = _costEstimate?._totalCost ?? Infinity;
    
    const _strategies: SummarizationStrategy[] = [];
    
    // Local only _strategy
    strategies.push({
      type: 'local_only',
      _reason: 'No cost, good privacy, fast processing',
      _estimatedCost: 0,
      _expectedQuality: 0.6,
    });

    // Cloud only _strategy
    if (!userBudget || _totalCost <= userBudget) {
      strategies.push({
        type: 'cloud_only',
        _reason: `Best quality with ${recommendedModel._name || recommendedModel.id}`,
        _estimatedCost: _totalCost === Infinity ? undefined : _totalCost,
        _expectedQuality: 0.85,
      });
    }

    // Hybrid _strategies
    if (_estimatedTokens > 1000) { // For longer content
      strategies.push({
        type: 'local_first',
        _reason: 'Try local first, fallback to cloud if quality is poor',
        _estimatedCost: _totalCost === Infinity ? undefined : _totalCost * 0.3, // Estimated 30% chance of cloud usage
        _expectedQuality: 0.75,
      });

      if (this.config.enableComparison) {
        strategies.push({
          _type: 'comparison',
          _reason: 'Compare both approaches for optimal results',
          _estimatedCost: _totalCost === Infinity ? undefined : _totalCost,
          _expectedQuality: 0.9,
        });
      }
    }

    // Determine _recommendation
    const _recommended = this.selectBestStrategy(_strategies, userBudget);
    
    return {
      _recommendedStrategy: _recommended,
      _alternatives: strategies.filter(s => s !== _recommended),
      _reasoning: this.generateRecommendationReasoning(_recommended, _strategies, _contentLength, userBudget),
    };
  }

  // Check if cloud summarization is available
  async isCloudAvailable(): Promise<boolean> {
    const _status = await this.cloudService.getStatus();
    return status.availableProviders.openai?.hasValidKey || false;
  }

  // Get OpenAI-specific usage statistics
  async getOpenAIUsageStats() {
    return await this.cloudService.getUsageStats(CloudProvider.OPENAI);
  }

  // Private methods

  private async determineStrategy(
    _content: string,
    _options: HybridSummarizationOptions
  ): Promise<SummarizationStrategy> {
    if (options._strategy && options._strategy !== 'auto') {
      return {
        _type: options._strategy,
        _reason: 'User-specified _strategy',
      };
    }

    const _recommendation = await this.getSummarizationRecommendation(content, options.maxCost);
    return recommendation.recommendedStrategy;
  }

  private async executeLocalOnly(
    _content: string,
    _strategy: SummarizationStrategy
  ): Promise<HybridSummarizationResult> {
    const _startTime = Date.now();
    
    const _localSummary = await this.localSummarizationService.summarizeLocal(content, {});
    const _processingTime = Date.now() - _startTime;
    
    return {
      _strategy,
      _localResult: {
        summary: _localSummary.content,
        _processingTime,
        _quality: this.estimateLocalQuality(_localSummary, content.length),
      },
      _finalSummary: _localSummary.content,
      _recommendation: {
        useCloud: false,
        _reasoning: 'Local summarization selected as requested',
        _costBenefit: 'No cost incurred',
      },
      _metadata: {
        totalProcessingTime: _processingTime,
        _totalCost: 0,
        _qualityImprovement: 0,
      },
    };
  }

  private async executeCloudOnly(
    _content: string,
    _strategy: SummarizationStrategy,
    _options: HybridSummarizationOptions
  ): Promise<HybridSummarizationResult> {
    const _cloudResult = await this.openaiService.summarize(
      content,
      options.openaiOptions,
      options.keyId
    );

    if (!_cloudResult.success) {
      throw new Error(`Cloud summarization _failed: ${cloudResult.error}`);
    }

    const _latency = cloudResult._latency ?? 0;
    const _costTotal = cloudResult.cost?._totalCost ?? 0;

    return {
      _strategy,
      _cloudResult: {
        summary: cloudResult._summary!,
        _processingTime: _latency,
        _quality: this.calculateOverallQuality(_cloudResult.quality),
        _cost: _costTotal,
      },
      _finalSummary: cloudResult._summary!,
      _recommendation: {
        useCloud: true,
        _reasoning: 'Cloud summarization selected as requested',
        _costBenefit: `Cost: $${costTotal.toFixed(4)}`,
      },
      _metadata: {
        totalProcessingTime: _latency,
        _totalCost: _costTotal,
        _qualityImprovement: 0, // No comparison available
      },
    };
  }

  private async executeLocalFirst(
    _content: string,
    _strategy: SummarizationStrategy,
    _options: HybridSummarizationOptions
  ): Promise<HybridSummarizationResult> {
    // Try local first
    const _localStartTime = Date.now();
    const _localSummary = await this.localSummarizationService.summarizeLocal(content, {});
    const _localProcessingTime = Date.now() - _localStartTime;
    const _localQuality = this.estimateLocalQuality(_localSummary, content.length);

    const _localResult = {
      _summary: _localSummary.content,
      _processingTime: _localProcessingTime,
      _quality: _localQuality,
    };

    // Check if local quality is sufficient
    if (_localQuality >= (this.config.qualityThreshold || 0.7)) {
      return {
        _strategy,
        _localResult,
        _finalSummary: _localSummary.content,
        _recommendation: {
          useCloud: false,
          _reasoning: 'Local quality meets threshold',
          _costBenefit: 'No additional cost needed',
        },
        _metadata: {
          totalProcessingTime: _localProcessingTime,
          _totalCost: 0,
          _qualityImprovement: 0,
        },
      };
    }

    // Fallback to cloud
    const _cloudResult = await this.openaiService.summarize(
      content,
      options.openaiOptions,
      options.keyId
    );

    if (!_cloudResult.success) {
      // Return local _result if cloud fails
      const _cloudLatency = cloudResult._latency ?? 0;
      return {
        _strategy,
        _localResult,
        _finalSummary: _localSummary.content,
        _recommendation: {
          useCloud: false,
          _reasoning: 'Cloud fallback failed, using local _result',
          _costBenefit: 'No cost due to cloud failure',
        },
        _metadata: {
          totalProcessingTime: _localProcessingTime + _cloudLatency,
          _totalCost: 0,
          _qualityImprovement: 0,
        },
      };
    }

    const _cloudLatency = cloudResult._latency ?? 0;
    const _cloudCostTotal = cloudResult.cost?._totalCost ?? 0;
    const _cloudQuality = this.calculateOverallQuality(_cloudResult.quality);
    const _useCloud = _cloudQuality > _localQuality;

    return {
      _strategy,
      _localResult,
      _cloudResult: {
        summary: cloudResult._summary!,
        _processingTime: _cloudLatency,
        _quality: _cloudQuality,
        _cost: _cloudCostTotal,
      },
      _finalSummary: _useCloud ? cloudResult._summary! : _localSummary.content,
      _recommendation: {
        _useCloud,
        _reasoning: _useCloud 
          ? `Cloud quality (${cloudQuality.toFixed(2)}) exceeds local (${localQuality.toFixed(2)})`
          : `Local quality sufficient, cloud improvement minimal`,
        _costBenefit: _useCloud 
          ? `Quality improvement worth $${cloudCostTotal.toFixed(4)}`
          : `Saved $${cloudCostTotal.toFixed(4)} with acceptable quality`,
      },
      _metadata: {
        totalProcessingTime: _localProcessingTime + _cloudLatency,
        _totalCost: _useCloud ? _cloudCostTotal : 0,
        _qualityImprovement: Math.max(0, _cloudQuality - _localQuality),
      },
    };
  }

  private async executeCloudFirst(
    _content: string,
    _strategy: SummarizationStrategy,
    _options: HybridSummarizationOptions
  ): Promise<HybridSummarizationResult> {
    // Try cloud first
    const _cloudResult = await this.openaiService.summarize(
      content,
      options.openaiOptions,
      options.keyId
    );

    if (_cloudResult.success) {
      const _latency = cloudResult._latency ?? 0;
      const _costTotal = cloudResult.cost?._totalCost ?? 0;
      return {
        _strategy,
        _cloudResult: {
          summary: cloudResult._summary!,
          _processingTime: _latency,
          _quality: this.calculateOverallQuality(_cloudResult.quality),
          _cost: _costTotal,
        },
        _finalSummary: cloudResult._summary!,
        _recommendation: {
          _useCloud: true,
          _reasoning: 'Cloud summarization successful',
          _costBenefit: `High quality for $${costTotal.toFixed(4)}`,
        },
        _metadata: {
          totalProcessingTime: _latency,
          _totalCost: _costTotal,
          _qualityImprovement: 0, // No local comparison
        },
      };
    }

    // Fallback to local
    const _localStartTime = Date.now();
    const _localSummary = await this.localSummarizationService.summarizeLocal(content, {});
    const _localProcessingTime = Date.now() - _localStartTime;
    const _cloudLatencyOnFail = cloudResult._latency ?? 0;

    return {
      _strategy,
      _localResult: {
        summary: _localSummary.content,
        _processingTime: _localProcessingTime,
        _quality: this.estimateLocalQuality(_localSummary, content.length),
      },
      _finalSummary: _localSummary.content,
      _recommendation: {
        _useCloud: false,
        _reasoning: 'Cloud failed, using local fallback',
        _costBenefit: 'No cost due to cloud failure',
      },
      _metadata: {
        totalProcessingTime: _cloudLatencyOnFail + _localProcessingTime,
        _totalCost: 0,
        _qualityImprovement: 0,
      },
    };
  }

  private async executeComparison(
    _content: string,
    _strategy: SummarizationStrategy,
    _options: HybridSummarizationOptions
  ): Promise<HybridSummarizationResult> {
    // Run both local and cloud in parallel
    const [_localSummary, _cloudResult] = await Promise.all([
      (async () => {
        const _startTime = Date.now();
        const _summary = await this.localSummarizationService.summarizeLocal(content, {});
        return {
          _summary: summary.content,
          _processingTime: Date.now() - _startTime,
          _quality: this.estimateLocalQuality(_summary, content.length),
        };
      })(),
      this.openaiService.summarize(content, options.openaiOptions, options.keyId),
    ]);

    if (!_cloudResult.success) {
      const _cloudLatency = cloudResult._latency ?? 0;
      return {
        _strategy,
        _localResult: _localSummary,
        _finalSummary: _localSummary._summary,
        _recommendation: {
          _useCloud: false,
          _reasoning: 'Cloud failed, using local _result',
          _costBenefit: 'No cost due to cloud failure',
        },
        _metadata: {
          totalProcessingTime: Math.max(_localSummary._processingTime, _cloudLatency),
          _totalCost: 0,
          _qualityImprovement: 0,
        },
      };
    }

    const _cloudLatency = cloudResult._latency ?? 0;
    const _cloudCostTotal = cloudResult.cost?._totalCost ?? 0;
    const _cloudQuality = this.calculateOverallQuality(_cloudResult.quality);
    const _qualityDifference = _cloudQuality - _localSummary.quality;
    const _useCloud = _qualityDifference > 0.1; // 10% improvement threshold

    return {
      _strategy,
      _localResult: _localSummary,
      _cloudResult: {
        _summary: cloudResult._summary!,
        _processingTime: _cloudLatency,
        _quality: _cloudQuality,
        _cost: _cloudCostTotal,
      },
      _finalSummary: _useCloud ? cloudResult._summary! : _localSummary._summary,
      _recommendation: {
        _useCloud,
        _reasoning: _useCloud
          ? `Cloud provides ${(_qualityDifference * 100).toFixed(1)}% quality improvement`
          : `Quality difference (${(_qualityDifference * 100).toFixed(1)}%) doesn't justify cost`,
        _costBenefit: _useCloud
          ? `Quality improvement worth $${cloudCostTotal.toFixed(4)}`
          : `Save $${cloudCostTotal.toFixed(4)} with minimal quality loss`,
      },
      _metadata: {
        totalProcessingTime: Math.max(_localSummary._processingTime, _cloudLatency),
        _totalCost: _useCloud ? _cloudCostTotal : 0,
        _qualityImprovement: Math.max(0, _qualityDifference),
      },
    };
  }

  private selectBestStrategy(
    _strategies: SummarizationStrategy[],
    userBudget?: number
  ): SummarizationStrategy {
    // Filter by budget
    const _affordableStrategies = strategies.filter(s => 
      !userBudget || !s.estimatedCost || s.estimatedCost <= userBudget
    );

    if (_affordableStrategies.length === 0) {
      return strategies.find(s => s._type === 'local_only')!;
    }

    // Select _strategy with best quality/cost ratio
    return affordableStrategies.reduce((best, current) => {
      const _bestRatio = (best.expectedQuality || 0) / Math.max(best.estimatedCost || 0.001, 0.001);
      const _currentRatio = (current.expectedQuality || 0) / Math.max(current.estimatedCost || 0.001, 0.001);
      return _currentRatio > _bestRatio ? _current : best;
    });
  }

  private generateRecommendationReasoning(
    _recommended: SummarizationStrategy,
    _alternatives: SummarizationStrategy[], // Available alternatives for future use
    _contentLength: number,
    userBudget?: number
  ): string {
    const _reasons = [];

    if (_contentLength < 1000) {
      reasons.push('Short content is well-suited for local processing');
    } else if (_contentLength > 10000) {
      reasons.push('Long content may benefit from advanced cloud models');
    }

    if (userBudget) {
      reasons.push(`Budget constraint of $${userBudget.toFixed(4)} considered`);
    }

    if (_recommended._type === 'local_only') {
      reasons.push('Local processing provides good quality at no cost');
    } else if (_recommended._type === 'cloud_only') {
      reasons.push('Cloud processing offers superior quality for this content');
    } else {
      reasons.push('Hybrid approach balances quality and cost effectively');
    }

    return reasons.join('. ') + '.';
  }

  private estimateLocalQuality(_summary: { content: string; metadata?: Record<string, unknown> }, originalLength?: number): number {
    // Simple heuristic for local quality estimation
    // In a real implementation, this could be more sophisticated
    const _compressionRatio = summary.content.length / (originalLength || 1000);
    
    if (_compressionRatio > 0.8) return 0.3; // Too little compression
    if (_compressionRatio < 0.1) return 0.4; // Too much compression
    
    return 0.6 + (0.4 - Math.abs(_compressionRatio - 0.3)) * 2; // Optimal around 30% compression
  }

  private calculateOverallQuality(_quality: { coherence: number; relevance: number; completeness: number; conciseness: number }): number {
    const _weights = { _coherence: 0.3, relevance: 0.3, _completeness: 0.25, _conciseness: 0.15 };
    
    return quality.coherence * weights.coherence +
           quality.relevance * weights.relevance +
           quality.completeness * weights.completeness +
           quality.conciseness * weights.conciseness;
  }

  private calculateQualityImprovement(_result: HybridSummarizationResult): number {
    if (!_result?._localResult || !_result?._cloudResult) return 0;
    return Math.max(0, _result?.cloudResult.quality - _result?.localResult.quality);
  }
}