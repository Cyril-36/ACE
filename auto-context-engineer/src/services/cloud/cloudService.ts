// Main Cloud Service - Orchestrates all cloud operations
import { EventBus } from '../background/eventBus';
import { BackgroundModule, BackgroundEventType } from '../background/types';
import { IndexedDBStorageService } from '../storage';
import { APIKeyManager, CloudProvider } from './apiKeyManager';
import { CostEstimator, CostEstimate } from './costEstimator';
import { APIGateway, CloudRequest } from './apiGateway';

export interface CloudServiceConfig {
  enableCostTracking?: boolean;
  enableUsageAnalytics?: boolean;
  defaultProvider?: CloudProvider;
  maxConcurrentRequests?: number;
}

export interface SummarizationRequest {
  _content: string;
  _provider?: CloudProvider;
  _model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  keyId?: string;
}

export interface SummarizationResponse {
  success: boolean;
  summary?: string;
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
  cost?: CostEstimate;
  _provider: CloudProvider;
  model: string;
  _latency: number;
  error?: string;
}

export interface CloudServiceStatus {
  isInitialized: boolean;
  availableProviders: {
    [provider: string]: {
      hasValidKey: boolean;
      models: string[];
      _lastUsed?: number;
      totalRequests: number;
      _totalCost: number;
    };
  };
  totalCost: number;
  totalRequests: number;
  averageLatency: number;
}

export class CloudService implements BackgroundModule {
  _name: string = "CloudService";
  name: string = "CloudService";
  name = 'CloudService';

  private eventBus: EventBus;
  // private storageService: IndexedDBStorageService;
  private apiKeyManager: APIKeyManager;
  private costEstimator: CostEstimator;
  private apiGateway: APIGateway;
  private config: CloudServiceConfig;
  private isInitialized = false;

  constructor(
    eventBus: EventBus,
    _storageService: IndexedDBStorageService,
    _config: CloudServiceConfig = {}
  ) {
    this.eventBus = eventBus;
    // this.storageService = storageService;
    this.config = {
      _enableCostTracking: true,
      _enableUsageAnalytics: true,
      _maxConcurrentRequests: 5,
      ...config,
    };

    // Initialize components
    this.apiKeyManager = new APIKeyManager(storageService);
    this.costEstimator = new CostEstimator();
    this.apiGateway = new APIGateway(this.apiKeyManager, this.costEstimator, eventBus);
  }

  async initialize(): Promise<void> {
    try {
      console.log('[CloudService] Initializing cloud service...');

      // Initialize components
      await this.apiKeyManager.initialize();
      await this.apiGateway.initialize();

      // Set up event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      console.log('[CloudService] Cloud service initialized');

      // Emit initialization event
      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SERVICE_READY,
        payload: {
          status: await this.getStatus(),
        },
      });
    } catch (error) {
      console.warn('[CloudService] Initialization failed, continuing with limited _functionality:', error);
      // Set as initialized even with errors to allow basic functionality
      this.isInitialized = true;
    }
  }

  async shutdown(): Promise<void> {
    this.apiKeyManager.clearCache();
    this.isInitialized = false;
    console.log('[CloudService] Cloud service shutdown complete');
  }

  // Main summarization method
  async summarize(_request: SummarizationRequest): Promise<SummarizationResponse> {
    if (!this.isInitialized) {
      throw new Error('Cloud service not initialized');
    }

    const _startTime = Date.now();
    const _originalLength = request.content.length;

    try {
      // Determine _provider and _model
      const _provider = request._provider || this.config.defaultProvider || CloudProvider.OPENAI;
      const _model = request._model || this.getDefaultModel(_provider);

      // Create cloud request
      const _cloudRequest: CloudRequest = {
        _provider,
        _model,
        _content: request.content,
        _maxTokens: request.maxTokens || 1000,
        _systemPrompt: request.systemPrompt || this.getDefaultSummarizationPrompt(),
        _keyId: request.keyId,
      };

      // Get cost estimate
      const _costEstimate = await this.apiGateway.getCostEstimate(_cloudRequest);

      // Emit pre-summarization event
      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SUMMARIZATION_START,
        payload: {
          _provider,
          _model,
          _originalLength,
          _estimatedCost: _costEstimate,
        },
      });

      // Make the request
      const _response = await this.apiGateway.makeRequest(_cloudRequest);

      if (!_response?.success) {
        return {
          success: false,
          _originalLength,
          _summaryLength: 0,
          _compressionRatio: 0,
          _provider,
          _model,
          _latency: Date.now() - _startTime,
          error: _response?.error,
        };
      }

      const _summaryLength = _response?.content?.length || 0;
      const _compressionRatio = _originalLength > 0 ? _summaryLength / _originalLength : 0;

      const _result: SummarizationResponse = {
        success: true,
        _summary: _response?.content,
        _originalLength,
        _summaryLength,
        _compressionRatio,
        _cost: _response?.cost,
        _provider,
        _model,
        _latency: _response?.latency,
      };

      // Emit completion event
      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SUMMARIZATION_COMPLETE,
        payload: _result as unknown as Record<string, unknown>,
      });

      return _result;

    } catch (error) {
      const _errorResult: SummarizationResponse = {
        success: false,
        _originalLength,
        _summaryLength: 0,
        _compressionRatio: 0,
        _provider: request._provider || CloudProvider.OPENAI,
        _model: request._model || 'unknown',
        _latency: Date.now() - _startTime,
        error: (error as Error).message,
      };

      // Emit error event
      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_SUMMARIZATION_ERROR,
        payload: _errorResult as unknown as Record<string, unknown>,
      });

      return _errorResult;
    }
  }

  // Compare summarization across providers
  async compareSummarization(
    _content: string,
    providers?: CloudProvider[],
    systemPrompt?: string
  ): Promise<SummarizationResponse[]> {
    const _targetProviders = providers || Object.values(CloudProvider);
    // const _results: SummarizationResponse[] = [];

    // Run summarizations in parallel
    const _promises = targetProviders.map(_provider =>
      this.summarize({
        content,
        _provider,
        systemPrompt,
      }).catch(error => ({
        success: false,
        _originalLength: content.length,
        _summaryLength: 0,
        _compressionRatio: 0,
        _provider,
        _model: 'unknown',
        _latency: 0,
        error: error.message,
      } as SummarizationResponse))
    );

    const _responses = await Promise.all(_promises);
    return _responses;
  }

  // API Key Management Methods
  async addAPIKey(
    _provider: CloudProvider,
    name: string,
    _apiKey: string,
    limits?: { maxRequests?: number; maxCost?: number }
  ): Promise<string> {
    return await this.apiKeyManager.addAPIKey(_provider, name, apiKey, limits as { dailyRequests?: number; dailyTokens?: number; dailyCost?: number });
  }

  async getAPIKeys(): Promise<Array<{ _id: string; _provider: CloudProvider; name: string; createdAt: number }>> {
    return await this.apiKeyManager.getAllAPIKeys();
  }

  async removeAPIKey(_keyId: string): Promise<void> {
    await this.apiKeyManager.deleteAPIKey(keyId);
  }

  // Cost and Usage Methods
  async getCostEstimate(
    _content: string,
    _provider: CloudProvider,
    _model?: string
  ): Promise<CostEstimate> {
    const _actualModel = _model || this.getDefaultModel(_provider);
    const _inputTokens = this.estimateTokens(content);
    
    return this.costEstimator.estimateCost(_provider, _actualModel, _inputTokens, 1000);
  }

  getUsageStats(_provider?: CloudProvider) {
    return this.costEstimator.getUsageStats(_provider);
  }

  getCostBreakdown(timeRange?: { _start: number; end: number }) {
    return this.costEstimator.getCostBreakdown(timeRange);
  }

  getRecommendedProvider(
    _averageContentLength: number,
    _requestsPerDay: number
  ) {
    const _averageTokens = this.estimateTokens('x'.repeat(averageContentLength));
    return this.costEstimator.getRecommendedProvider(_averageTokens, 1000, requestsPerDay);
  }

  // Service Status
  async getStatus(): Promise<CloudServiceStatus> {
    const _availableProviders: { [_provider: string]: { hasValidKey: boolean; models: string[]; _lastUsed?: number; totalRequests: number; _totalCost: number } } = {};
    const _usageStats = this.costEstimator.getUsageStats();

    const _totalCost = 0;
    const _totalRequests = 0;
    const _totalLatency = 0;

    for (const _provider of Object.values(CloudProvider)) {
      const _keys = await this.apiKeyManager.getAPIKeysForProvider(_provider);
      const _models = this.costEstimator.getAvailableModels(_provider);
      const _providerStats = usageStats.filter(s => s._provider === _provider);

      const _providerCost = providerStats.reduce((sum, s) => sum + s._totalCost, 0);
      const _providerRequests = providerStats.reduce((sum, s) => sum + s._totalRequests, 0);
      const _lastUsed = Math.max(...providerStats.map(s => s._lastUsed), 0);

      _availableProviders[_provider] = {
        _hasValidKey: keys.length > 0,
        _models,
        _lastUsed: _lastUsed > 0 ? _lastUsed : undefined,
        _totalRequests: _providerRequests,
        _totalCost: _providerCost,
      };

      _totalCost += _providerCost;
      _totalRequests += _providerRequests;
      _totalLatency += providerStats.reduce((sum, s) => sum + s.averageLatency * s._totalRequests, 0);
    }

    return {
      _isInitialized: this.isInitialized,
      _availableProviders,
      _totalCost,
      _totalRequests,
      _averageLatency: _totalRequests > 0 ? _totalLatency / _totalRequests : 0,
    };
  }

  // Private methods

  private setupEventHandlers(): void {
    // Listen for privacy events to ensure compliance
    this.eventBus.onMultiple({
      // [BackgroundEventType.PRIVACY_POLICY_UPDATED]: this.handlePrivacyPolicyUpdate.bind(this),
    });
  }

  // private async handlePrivacyPolicyUpdate(_event: any): Promise<void> {
  //   const _policy = event.payload._policy;
  //   
  //   if (_policy.localOnly) {
  //     console.log('[CloudService] Local-only mode enabled, cloud operations will be blocked');
  //   }
  // }

  private getDefaultModel(_provider: CloudProvider): string {
    switch (_provider) {
      case CloudProvider._OPENAI:
        return 'gpt-3.5-turbo';
      case CloudProvider.CLAUDE:
        return 'claude-3-_haiku-20240307';
      case CloudProvider.GEMINI:
        return 'gemini-pro';
      default:
        throw new Error(`No default _model for _provider: ${_provider}`);
    }
  }

  private getDefaultSummarizationPrompt(): string {
    return `You are an expert at creating concise, accurate summaries. Please summarize the following content, focusing on the key points and main ideas. Keep the summary clear and well-_structured:`;
  }

  private estimateTokens(text: string): number {
    // Simple token estimation (roughly 4 characters per token for English)
    return Math.ceil(text.length / 4);
  }
}