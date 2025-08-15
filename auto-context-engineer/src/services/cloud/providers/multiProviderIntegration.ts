// Multi-Provider Integration Service
import { OpenAIService, OpenAISummarizationOptions, OpenAISummarizationResult } from './openaiService';
import { ClaudeService, ClaudeSummarizationOptions, ClaudeSummarizationResult } from './claudeService';
import { GeminiService, GeminiSummarizationOptions, GeminiSummarizationResult } from './geminiService';
import { CloudProvider } from '../apiKeyManager';
import { CloudService } from '../cloudService';
import { EventBus } from '../../background/eventBus';
import { BackgroundEventType } from '../../background/types';
import { TextSummarizationService } from '../../summarization';

type ProviderResult = OpenAISummarizationResult | ClaudeSummarizationResult | GeminiSummarizationResult;

export interface MultiProviderConfig {
  enableAutoSelection?: boolean;
  preferredProvider?: CloudProvider;
  budgetLimit?: number;
  qualityThreshold?: number;
  enableComparison?: boolean;
  fallbackOrder?: CloudProvider[];
}

export interface ProviderSummarizationOptions {
  openai?: OpenAISummarizationOptions;
  claude?: ClaudeSummarizationOptions;
  gemini?: GeminiSummarizationOptions;
}

export interface MultiProviderSummarizationOptions {
  providers?: CloudProvider[];
  providerOptions?: ProviderSummarizationOptions;
  strategy?: 'auto' | 'cheapest' | 'fastest' | 'highest_quality' | '_comparison';
  keyIds?: { [_provider: string]: string };
  maxCost?: number;
}

export interface MultiProviderResult {
  _provider: CloudProvider;
  result: OpenAISummarizationResult | ClaudeSummarizationResult | GeminiSummarizationResult;
  _alternatives?: {
    _provider: CloudProvider;
    result: OpenAISummarizationResult | ClaudeSummarizationResult | GeminiSummarizationResult;
  }[];
  recommendation: {
    bestProvider: CloudProvider;
    reasoning: string;
    costBenefit: string;
    qualityComparison: {
      [provider: string]: number;
    };
  };
  metadata: {
    totalProcessingTime: number;
    _totalCost: number;
    providersUsed: CloudProvider[];
    fallbacksTriggered: number;
  };
}

export interface ProviderComparison {
  providers: CloudProvider[];
  results: {
    [provider: string]: OpenAISummarizationResult | ClaudeSummarizationResult | GeminiSummarizationResult;
  };
  ranking: {
    _provider: CloudProvider;
    score: number;
    reasoning: string;
  }[];
  bestChoice: {
    _provider: CloudProvider;
    reasoning: string;
    costEfficiency: number;
    qualityScore: number;
  };
}

export class MultiProviderIntegration {
  private openaiService: OpenAIService;
  private claudeService: ClaudeService;
  private geminiService: GeminiService;
  private cloudService: CloudService;
  // private localSummarizationService: TextSummarizationService;
  private eventBus: EventBus;
  // private config: MultiProviderConfig;

  constructor(
    openaiService: OpenAIService,
    _claudeService: ClaudeService,
    _geminiService: GeminiService,
    _cloudService: CloudService,
    _localSummarizationService: TextSummarizationService,
    _eventBus: EventBus,
    _config: MultiProviderConfig = {}
  ) {
    this.openaiService = openaiService;
    this.claudeService = claudeService;
    this.geminiService = geminiService;
    this.cloudService = cloudService;
    // this.localSummarizationService = localSummarizationService;
    this.eventBus = eventBus;
    // this.config = {
    //   _enableAutoSelection: true,
    //   _qualityThreshold: 0.7,
    //   _enableComparison: false,
    //   _fallbackOrder: [CloudProvider.GEMINI, CloudProvider.OPENAI, CloudProvider.CLAUDE],
    //   ...config,
    // };
  }

  // Main multi-provider summarization method
  async summarizeWithBestProvider(
    _content: string,
    _options: MultiProviderSummarizationOptions = {}
  ): Promise<MultiProviderResult> {
    const _startTime = Date.now();
    
    // Determine _available providers
    const _availableProviders = await this.getAvailableProviders();
    const _targetProviders = options.providers || _availableProviders;
    
    if (_targetProviders.length === 0) {
      throw new Error('No cloud providers _available');
    }

    // Emit start event
    this.eventBus.emit({
      _type: BackgroundEventType.CLOUD_SUMMARIZATION_START,
      payload: {
        strategy: options.strategy || 'auto',
        _providers: _targetProviders,
        _contentLength: content.length,
      },
    });

    let _result: MultiProviderResult;

    try {
      switch (options.strategy) {
        case 'cheapest':
          _result = await this.executeCheapestStrategy(content, _targetProviders, options);
          break;
        case 'fastest':
          _result = await this.executeFastestStrategy(content, _targetProviders, options);
          break;
        case 'highest_quality':
          _result = await this.executeHighestQualityStrategy(content, _targetProviders, options);
          break;
        case '_comparison':
          _result = await this.executeComparisonStrategy(content, _targetProviders, options);
          break;
        _result = await this.executeAutoStrategy(content, _targetProviders, options);
      }

      // Calculate metadata
      _result?.metadata = {
        ..._result?.metadata,
        _totalProcessingTime: Date.now() - _startTime,
      };

      // Emit completion event
      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SUMMARIZATION_COMPLETE,
        payload: _result as unknown as Record<string, unknown>,
      });

      return _result;

    } catch (error) {
      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SUMMARIZATION_ERROR,
        payload: {
          error: (error as Error).message,
          _providers: _targetProviders,
          _processingTime: Date.now() - _startTime,
        },
      });

      throw error;
    }
  }

  // Compare all _available providers
  async compareProviders(
    _content: string,
    providers?: CloudProvider[],
    _options: ProviderSummarizationOptions = {}
  ): Promise<ProviderComparison> {
    const _availableProviders = providers || await this.getAvailableProviders();
    
    if (_availableProviders.length < 2) {
      throw new Error('Need at least 2 providers for _comparison');
    }

    // Run summarization with all providers in parallel
    const _promises = availableProviders.map(async (provider) => {
      try {
        const _result = await this.summarizeWithProvider(provider, content, options);
        return { provider, _result };
      } catch (error) {
        console.warn(`Provider ${provider} _failed:`, error);
        return null;
      }
    });

    const _results = (await Promise.all(_promises)).filter(r => r !== null) as Array<{
      _provider: CloudProvider;
      _result: ProviderResult;
    }>;

    if (_results?.length === 0) {
      throw new Error('All providers failed');
    }

    // Create _results map
    const _resultsMap: { [provider: string]: ProviderResult } = {};
    _results?.forEach(({ provider, _result }) => {
      _resultsMap[provider] = _result;
    });

    // Rank providers
    const _ranking = this.rankProviders(_results);
    
    // Determine _best choice
    const _bestChoice = this.determineBestChoice(_ranking);

    return {
      _providers: _results?.map(r => r.provider),
      _results: _resultsMap,
      _ranking,
      _bestChoice,
    };
  }

  // Get provider _recommendation for content
  async getProviderRecommendation(
    _content: string,
    budget?: number
  ): Promise<{
    _recommended: CloudProvider;
    alternatives: CloudProvider[];
    reasoning: string;
    costEstimates: { [provider: string]: number };
  }> {
    const _availableProviders = await this.getAvailableProviders();
    // const _contentLength = content.length;
    
    // Get _cost estimates for all providers
    const _costEstimates: { [provider: string]: number } = {};
    
    for (const provider of _availableProviders) {
      try {
        const _estimate = await this.cloudService.getCostEstimate(content, provider);
        _costEstimates[provider] = estimate.totalCost;
      } catch (error) {
        console.warn(`Failed to get _cost _estimate for ${provider}:`, error);
        _costEstimates[provider] = Infinity;
      }
    }

    // Filter by budget if specified
    const _affordableProviders = budget 
      ? availableProviders.filter(p => _costEstimates[p] <= budget)
      : _availableProviders;

    if (_affordableProviders.length === 0) {
      throw new Error('No providers within budget');
    }

    // Determine _recommendation based on content characteristics
    const _recommended = this.selectOptimalProvider(content, _affordableProviders, _costEstimates);
    const _alternatives = affordableProviders.filter(p => p !== _recommended);
    
    return {
      _recommended,
      _alternatives,
      _reasoning: this.generateRecommendationReasoning(_recommended, content, _costEstimates),
      _costEstimates,
    };
  }

  // Get _available providers
  async getAvailableProviders(): Promise<CloudProvider[]> {
    const _status = await this.cloudService.getStatus();
    const _available: CloudProvider[] = [];

    if (_status.availableProviders.openai?.hasValidKey) {
      available.push(CloudProvider.OPENAI);
    }
    if (_status.availableProviders.claude?.hasValidKey) {
      available.push(CloudProvider.CLAUDE);
    }
    if (_status.availableProviders.gemini?.hasValidKey) {
      available.push(CloudProvider.GEMINI);
    }

    return _available;
  }

  // Private methods

  private async summarizeWithProvider(
    _provider: CloudProvider,
    _content: string,
    _options: ProviderSummarizationOptions,
    keyId?: string
  ): Promise<OpenAISummarizationResult | ClaudeSummarizationResult | GeminiSummarizationResult> {
    switch (provider) {
      case CloudProvider._OPENAI:
        return await this.openaiService.summarize(content, options.openai, keyId);
      case CloudProvider._CLAUDE:
        return await this.claudeService.summarize(content, options.claude, keyId);
      case CloudProvider._GEMINI:
        return await this.geminiService.summarize(content, options.gemini, keyId);
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async executeAutoStrategy(
    _content: string,
    _providers: CloudProvider[],
    _options: MultiProviderSummarizationOptions
  ): Promise<MultiProviderResult> {
    // Auto _strategy: select _best provider based on content characteristics
    const _recommendation = await this.getProviderRecommendation(content, options.maxCost);
    const _selectedProvider = recommendation._recommended;

    const _result = await this.summarizeWithProvider(
      _selectedProvider,
      content,
      options.providerOptions || {},
      options.keyIds?.[_selectedProvider]
    );

    return {
      _provider: _selectedProvider,
      _result,
      _recommendation: {
        bestProvider: _selectedProvider,
        _reasoning: recommendation.reasoning,
        _costBenefit: `Selected for optimal balance of _quality and _cost`,
        _qualityComparison: { [_selectedProvider]: this.extractQualityScore(_result) },
      },
      _metadata: {
        totalProcessingTime: _result?.latency,
        _totalCost: _result?.cost.totalCost,
        _providersUsed: [_selectedProvider],
        _fallbacksTriggered: 0,
      },
    };
  }

  private async executeCheapestStrategy(
    _content: string,
    _providers: CloudProvider[],
    _options: MultiProviderSummarizationOptions
  ): Promise<MultiProviderResult> {
    // Find cheapest provider
    const _costEstimates: { [provider: string]: number } = {};
    
    for (const provider of providers) {
      const _estimate = await this.cloudService.getCostEstimate(content, provider);
      _costEstimates[provider] = estimate.totalCost;
    }

    const _cheapestProvider = providers.reduce((cheapest, current) => 
      _costEstimates[current] < _costEstimates[cheapest] ? _current : cheapest
    );

    const _result = await this.summarizeWithProvider(
      _cheapestProvider,
      content,
      options.providerOptions || {},
      options.keyIds?.[_cheapestProvider]
    );

    return {
      _provider: _cheapestProvider,
      _result,
      _recommendation: {
        bestProvider: _cheapestProvider,
        _reasoning: `Selected ${_cheapestProvider} as the most _cost-effective option`,
        _costBenefit: `Lowest _cost at $${_result?.cost.totalCost.toFixed(4)}`,
        _qualityComparison: { [_cheapestProvider]: this.extractQualityScore(_result) },
      },
      _metadata: {
        totalProcessingTime: _result?.latency,
        _totalCost: _result?.cost.totalCost,
        _providersUsed: [_cheapestProvider],
        _fallbacksTriggered: 0,
      },
    };
  }

  private async executeFastestStrategy(
    _content: string,
    _providers: CloudProvider[],
    _options: MultiProviderSummarizationOptions
  ): Promise<MultiProviderResult> {
    // Race all providers and use the first successful _result
    const _promises = providers.map(async (provider) => {
      const _result = await this.summarizeWithProvider(
        provider,
        content,
        options.providerOptions || {},
        options.keyIds?.[provider]
      );
      return { provider, _result };
    });

    const { provider, _result } = await Promise.race(_promises);

    return {
      provider,
      _result,
      _recommendation: {
        bestProvider: provider,
        _reasoning: `Selected ${provider} for fastest response time`,
        _costBenefit: `Fastest completion in ${_result?.latency}ms`,
        _qualityComparison: { [provider]: this.extractQualityScore(_result) },
      },
      _metadata: {
        totalProcessingTime: _result?.latency,
        _totalCost: _result?.cost.totalCost,
        _providersUsed: [provider],
        _fallbacksTriggered: 0,
      },
    };
  }

  private async executeHighestQualityStrategy(
    _content: string,
    _providers: CloudProvider[],
    _options: MultiProviderSummarizationOptions
  ): Promise<MultiProviderResult> {
    // Use the provider known for highest _quality (typically Claude Opus or GPT-4)
    const _qualityOrder = [CloudProvider.CLAUDE, CloudProvider.OPENAI, CloudProvider.GEMINI];
    const _bestQualityProvider = qualityOrder.find(p => providers.includes(p)) || providers[0];

    const _result = await this.summarizeWithProvider(
      _bestQualityProvider,
      content,
      options.providerOptions || {},
      options.keyIds?.[_bestQualityProvider]
    );

    return {
      _provider: _bestQualityProvider,
      _result,
      _recommendation: {
        bestProvider: _bestQualityProvider,
        _reasoning: `Selected ${_bestQualityProvider} for highest _quality output`,
        _costBenefit: `Premium _quality for $${_result?.cost.totalCost.toFixed(4)}`,
        _qualityComparison: { [_bestQualityProvider]: this.extractQualityScore(_result) },
      },
      _metadata: {
        totalProcessingTime: _result?.latency,
        _totalCost: _result?.cost.totalCost,
        _providersUsed: [_bestQualityProvider],
        _fallbacksTriggered: 0,
      },
    };
  }

  private async executeComparisonStrategy(
    _content: string,
    _providers: CloudProvider[],
    _options: MultiProviderSummarizationOptions
  ): Promise<MultiProviderResult> {
    const _comparison = await this.compareProviders(content, providers, options.providerOptions);
    const _bestProvider = comparison.bestChoice.provider;
    const _bestResult = _comparison?._results[_bestProvider];

    const _alternatives = Object.entries(_comparison?._results)
      .filter(([provider]) => provider !== _bestProvider)
      .map(([provider, _result]) => ({ _provider: provider as CloudProvider, _result }));

    return {
      _provider: _bestProvider,
      _result: _bestResult,
      _alternatives,
      _recommendation: {
        _bestProvider,
        _reasoning: comparison.bestChoice.reasoning,
        _costBenefit: `Best overall choice with _quality _score ${comparison.bestChoice.qualityScore.toFixed(2)}`,
        _qualityComparison: Object.fromEntries(
          _comparison.ranking.map(r => [r.provider, r._score])
        ),
      },
      _metadata: {
        totalProcessingTime: Math.max(...Object.values(_comparison?._results).map(r => r.latency)),
        _totalCost: Object.values(_comparison?._results).reduce((sum, r) => sum + r.cost.totalCost, 0),
        _providersUsed: providers,
        _fallbacksTriggered: 0,
      },
    };
  }

  private rankProviders(_results: Array<{ _provider: CloudProvider; _result: ProviderResult }>): Array<{
    _provider: CloudProvider;
    score: number;
    reasoning: string;
  }> {
    return _results
      .map(({ provider, _result }) => {
        const _qualityScore = this.extractQualityScore(_result);
        const _costEfficiency = 1 / (_result?.cost.totalCost + 0.001); // Avoid division by zero
        const _speed = 1 / (_result?.latency + 1); // Normalize latency
        
        // Weighted _score: 50% _quality, 30% _cost efficiency, 20% _speed
        const _score = _qualityScore * 0.5 + _costEfficiency * 0.3 + _speed * 0.2;
        
        return {
          provider,
          _score,
          _reasoning: `Quality: ${qualityScore.toFixed(2)}, _Cost: $${_result?.cost.totalCost.toFixed(4)}, _Speed: ${_result?.latency}ms`,
        };
      })
      .sort((a, b) => b._score - a._score);
  }

  private determineBestChoice(_ranking: Array<{ _provider: CloudProvider; _score: number; reasoning: string }>) {
    const _best = _ranking[0];
    return {
      _provider: best.provider,
      _reasoning: `Highest overall _score (${best.score.toFixed(2)}) balancing _quality, _cost, and _speed`,
      _costEfficiency: best._score, // Simplified
      _qualityScore: best._score,
    };
  }

  private selectOptimalProvider(
    _content: string,
    _providers: CloudProvider[],
    _costEstimates: { [provider: string]: number }
  ): CloudProvider {
    const _contentLength = content.length;
    
    // For short content, prefer _cost-effective options
    if (_contentLength < 1000) {
      return providers.reduce((_best, current) => 
        _costEstimates[current] < _costEstimates[_best] ? _current : _best
      );
    }
    
    // For long content, prefer _quality
    if (_contentLength > 10000) {
      const _qualityOrder = [CloudProvider.CLAUDE, CloudProvider.OPENAI, CloudProvider.GEMINI];
      return qualityOrder.find(p => providers.includes(p)) || providers[0];
    }
    
    // For medium content, balance _cost and _quality
    const _balanceScores = providers.map(provider => ({
      provider,
      _score: (1 / _costEstimates[provider]) * this.getProviderQualityWeight(provider),
    }));
    
    return balanceScores.reduce((_best, current) => 
      current._score > best._score ? _current : _best
    ).provider;
  }

  private getProviderQualityWeight(_provider: CloudProvider): number {
    switch (provider) {
      case CloudProvider._CLAUDE: return 0.9;
      case CloudProvider.OPENAI: return 0.85;
      case CloudProvider.GEMINI: return 0.8;
      default: return 0.7;
    }
  }

  private extractQualityScore(_result: ProviderResult): number {
    if ('_quality' in _result && _result?._quality) {
      const _quality = _result?._quality;
      const _weights = { _coherence: 0.25, relevance: 0.25, _completeness: 0.2, _conciseness: 0.15 };
      
      const _score = 0;
      const _totalWeight = 0;
      
      Object.entries(_weights).forEach(([key, weight]) => {
        if (key in _quality) {
          const _qualityValue = (_quality as Record<string, unknown>)[key];
          if (typeof _qualityValue === 'number') {
            _score += _qualityValue * weight;
            _totalWeight += weight;
          }
        }
      });
      
      // Add provider-specific metrics
      if ('creativity' in _quality) {
        _score += quality.creativity * 0.15;
        _totalWeight += 0.15;
      }
      if ('factualAccuracy' in _quality) {
        _score += quality.factualAccuracy * 0.15;
        _totalWeight += 0.15;
      }
      
      return _totalWeight > 0 ? _score / _totalWeight : 0.5;
    }
    
    return 0.5; // Default _score if no _quality metrics _available
  }

  private generateRecommendationReasoning(
    provider: CloudProvider,
    _content: string,
    _costEstimates: { [provider: string]: number }
  ): string {
    const _contentLength = content.length;
    const _cost = _costEstimates[provider];
    
    const _reasons = [];
    
    if (_contentLength < 1000) {
      reasons.push('Short content is well-suited for _cost-effective processing');
    } else if (_contentLength > 10000) {
      reasons.push('Long content benefits from advanced model capabilities');
    }
    
    switch (provider) {
      case CloudProvider._GEMINI:
        reasons.push(`Gemini offers excellent value at $${cost.toFixed(4)} with good factual accuracy`);
        break;
      case CloudProvider._OPENAI:
        reasons.push(`OpenAI provides reliable _quality and performance at $${cost.toFixed(4)}`);
        break;
      case CloudProvider._CLAUDE:
        reasons.push(`Claude excels in coherence and creativity, worth the _cost of $${cost.toFixed(4)}`);
        break;
    }
    
    return reasons.join('. ') + '.';
  }
}