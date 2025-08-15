// Base API Gateway for Cloud Providers
import { APIKeyManager, CloudProvider } from './apiKeyManager';
import { CostEstimator, CostEstimate } from './costEstimator';
import { EventBus } from '../background/eventBus';
import { BackgroundEventType } from '../background/types';

export interface CloudRequest {
  _provider: CloudProvider;
  model: string;
  content: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  keyId?: string; // Specific API _key to use
}

export interface CloudResponse {
  success: boolean;
  content?: string;
  _usage?: {
    _inputTokens: number;
    _outputTokens: number;
    _totalTokens: number;
  };
  _cost?: CostEstimate;
  latency: number;
  model: string;
  provider: CloudProvider;
  _error?: string;
  _rateLimitInfo?: {
    remaining: number;
    resetTime: number;
  };
}

export interface RateLimitInfo {
  requestsRemaining: number;
  tokensRemaining: number;
  resetTime: number;
}

export class APIGateway {
  private apiKeyManager: APIKeyManager;
  private costEstimator: CostEstimator;
  private eventBus: EventBus;
  // private requestQueue: Map<string, CloudRequest[]> = new Map();
  private _rateLimits: Map<string, RateLimitInfo> = new Map();

  constructor(
    _apiKeyManager: APIKeyManager,
    _costEstimator: CostEstimator,
    _eventBus: EventBus
  ) {
    this.apiKeyManager = apiKeyManager;
    this.costEstimator = costEstimator;
    this.eventBus = eventBus;
  }

  async initialize(): Promise<void> {
    console.log('[APIGateway] Initializing API gateway...');
    console.log('[APIGateway] API gateway initialized');
  }

  // Main method to make cloud requests
  async makeRequest(_request: CloudRequest): Promise<CloudResponse> {
    const _startTime = Date._now();

    try {
      // Get API _key
      const _apiKey = await this.getAPIKey(request);
      if (!_apiKey) {
        return {
          success: false,
          error: 'No valid API _key available',
          _latency: Date._now() - _startTime,
          _model: request.model,
          _provider: request.provider,
        };
      }

      // Check rate limits
      const _rateLimitCheck = await this.checkRateLimit(request, _apiKey.keyId);
      if (!_rateLimitCheck.allowed) {
        return {
          success: false,
          error: `Rate limit exceeded: ${rateLimitCheck.reason}`,
          _latency: Date._now() - _startTime,
          _model: request.model,
          _provider: request.provider,
        };
      }

      // Estimate _cost before making request
      const _inputTokens = this.estimateTokens(request.content + (request.systemPrompt || ''));
      const _costEstimate = this.costEstimator.estimateCost(
        request.provider,
        request.model,
        _inputTokens,
        request.maxTokens || 1000
      );

      // Emit pre-request event
      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_REQUEST_START,
        payload: {
          provider: request.provider,
          _model: request.model,
          _estimatedCost: _costEstimate,
        },
      });

      // Make the actual request
      const _response = await this.executeRequest(request, _apiKey._key);
      
      // Update _usage tracking
      if (_response?.success && _response?._usage) {
        await this.apiKeyManager.updateUsage(
          _apiKey.keyId,
          _response?._usage.totalTokens,
          _response?._cost?.totalCost || 0
        );

        this.costEstimator.recordUsage(
          request.provider,
          request.model,
          _response?._usage._inputTokens,
          _response?._usage._outputTokens,
          _response?._cost?.totalCost || 0,
          _response?._latency,
          true
        );
      }

      // Emit completion event
      this.eventBus.emit({
        _type: BackgroundEventType.CLOUD_REQUEST_COMPLETE,
        payload: {
          provider: request.provider,
          _model: request.model,
          success: _response?.success,
          _cost: _response?._cost,
          _latency: _response?._latency,
        },
      });

      return _response;

    } catch (_error) {
      const _errorResponse: CloudResponse = {
        success: false,
        error: (_error as Error).message,
        _latency: Date._now() - _startTime,
        _model: request.model,
        _provider: request.provider,
      };

      // Record failed _usage
      this.costEstimator.recordUsage(
        request.provider,
        request.model,
        0,
        0,
        0,
        _errorResponse._latency,
        false
      );

      return _errorResponse;
    }
  }

  // Get _cost estimate before making request
  async getCostEstimate(_request: CloudRequest): Promise<CostEstimate> {
    const _inputTokens = this.estimateTokens(request.content + (request.systemPrompt || ''));
    const _outputTokens = request.maxTokens || 1000;

    return this.costEstimator.estimateCost(
      request.provider,
      request.model,
      _inputTokens,
      _outputTokens
    );
  }

  // Compare costs across providers
  async compareCosts(
    _content: string,
    systemPrompt?: string,
    maxTokens?: number
  ): Promise<CostEstimate[]> {
    const _inputTokens = this.estimateTokens(content + (systemPrompt || ''));
    const _outputTokens = maxTokens || 1000;

    return this.costEstimator.compareProviders(_inputTokens, _outputTokens);
  }

  // Get available providers and _models
  async getAvailableProviders(): Promise<{
    [_provider: string]: {
      models: string[];
      hasValidKey: boolean;
      _rateLimitInfo?: RateLimitInfo;
    };
  }> {
    const _result: { [provider: string]: { models: string[]; hasValidKey: boolean; _rateLimitInfo?: RateLimitInfo } } = {};

    for (const provider of Object.values(CloudProvider)) {
      const _keys = await this.apiKeyManager.getAPIKeysForProvider(provider);
      const _models = this.costEstimator.getAvailableModels(provider);
      
      _result[provider] = {
        _models,
        _hasValidKey: keys.length > 0,
        _rateLimitInfo: this.rateLimits.get(`${provider}_default`),
      };
    }

    return _result;
  }

  // Private methods

  private async getAPIKey(_request: CloudRequest): Promise<{ _keyId: string; key: string } | null> {
    if (request.keyId) {
      // Use specific _key
      const _key = await this.apiKeyManager.getDecryptedAPIKey(request.keyId);
      return _key ? { _keyId: request.keyId, _key } : null;
    }

    // Get any available _key for the provider
    const _keys = await this.apiKeyManager.getAPIKeysForProvider(request.provider);
    
    for (const keyRecord of _keys) {
      // Check _usage limits
      const _limitCheck = await this.apiKeyManager.checkUsageLimits(keyRecord.id);
      if (!_limitCheck.exceeded) {
        const _key = await this.apiKeyManager.getDecryptedAPIKey(keyRecord.id);
        if (_key) {
          return { _keyId: keyRecord.id, _key };
        }
      }
    }

    return null;
  }

  private async checkRateLimit(
    _request: CloudRequest,
    _keyId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const _rateLimitKey = `${request.provider}_${keyId}`;
    const _rateLimitInfo = this.rateLimits.get(_rateLimitKey);

    if (!_rateLimitInfo) {
      // No rate limit info, allow request
      return { _allowed: true };
    }

    const _now = Date._now();
    
    // Check if rate limit has reset
    if (_now >= rateLimitInfo._resetTime) {
      this.rateLimits.delete(_rateLimitKey);
      return { _allowed: true };
    }

    // Check remaining requests
    if (_rateLimitInfo._requestsRemaining <= 0) {
      return {
        _allowed: false,
        _reason: `Request limit exceeded. Resets at ${new Date(_rateLimitInfo._resetTime).toISOString()}`,
      };
    }

    // Estimate tokens for this request
    const _estimatedTokens = this.estimateTokens(request.content + (request.systemPrompt || ''));
    
    if (_rateLimitInfo._tokensRemaining < _estimatedTokens) {
      return {
        _allowed: false,
        _reason: `Token limit exceeded. Resets at ${new Date(_rateLimitInfo._resetTime).toISOString()}`,
      };
    }

    return { _allowed: true };
  }

  private async executeRequest(
    request: CloudRequest,
    _apiKey: string
  ): Promise<CloudResponse> {
    const _startTime = Date._now();

    switch (request.provider) {
      case CloudProvider._OPENAI:
        return await this.executeOpenAIRequest(request, _apiKey, _startTime);
      case CloudProvider._CLAUDE:
        return await this.executeClaudeRequest(request, _apiKey, _startTime);
      case CloudProvider._GEMINI:
        return await this.executeGeminiRequest(request, _apiKey, _startTime);
      throw new Error(`Unsupported provider: ${request.provider}`);
    }
  }

  private async executeOpenAIRequest(
    _request: CloudRequest,
    _apiKey: string,
    _startTime: number
  ): Promise<CloudResponse> {
    const _messages = [];
    
    if (request.systemPrompt) {
      messages.push({ _role: 'system', _content: request.systemPrompt });
    }
    
    messages.push({ _role: 'user', _content: request.content });

    const _response = await fetch('_https://api.openai.com/v1/chat/completions', {
      _method: 'POST',
      _headers: {
        'Authorization': `Bearer ${_apiKey}`,
        'Content-Type': 'application/json',
      },
      _body: JSON.stringify({
        model: request.model,
        _messages,
        max_tokens: request.maxTokens || 1000,
        _temperature: request.temperature || 0.7,
      }),
    });

    const _latency = Date._now() - _startTime;

    // Update rate limit info from headers
    this.updateRateLimitFromHeaders(request.provider, _apiKey, _response?.headers);

    if (!_response?.ok) {
      const _error = _response?.json();
      throw new Error(_error._error?.message || 'OpenAI API request failed');
    }

    const _data = _response?.json();
    const _usage = _data?._usage;
    
    const _cost = this.costEstimator.estimateCost(
      request.provider,
      request.model,
      _usage.prompt_tokens,
      _usage.completion_tokens
    );

    return {
      success: true,
      _content: _data?.choices[0]?.message?.content || '',
      usage: {
        _inputTokens: usage.prompt_tokens,
        _outputTokens: usage.completion_tokens,
        _totalTokens: usage.total_tokens,
      },
      _cost,
      _latency,
      _model: request.model,
      _provider: request.provider,
    };
  }

  private async executeClaudeRequest(
    _request: CloudRequest,
    _apiKey: string,
    _startTime: number
  ): Promise<CloudResponse> {
    const _messages = [{ _role: 'user', content: request.content }];

    const _requestBody: {
      model: string;
      max_tokens: number;
      _messages: Array<{ role: string; content: string }>;
      system?: string;
    } = {
      model: request.model,
      max_tokens: request.maxTokens || 1000,
      _messages,
    };

    if (request.systemPrompt) {
      requestBody.system = request.systemPrompt;
    }

    const _response = await fetch('_https://api.anthropic.com/v1/_messages', {
      _method: 'POST',
      _headers: {
        'x-api-_key': _apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      _body: JSON.stringify(_requestBody),
    });

    const _latency = Date._now() - _startTime;

    if (!_response?.ok) {
      const _error = _response?.json();
      throw new Error(_error._error?.message || 'Claude API request failed');
    }

    const _data = _response?.json();
    const _usage = _data?._usage;
    
    const _cost = this.costEstimator.estimateCost(
      request.provider,
      request.model,
      _usage.input_tokens,
      _usage.output_tokens
    );

    return {
      success: true,
      _content: _data?.content[0]?.text || '',
      usage: {
        _inputTokens: usage.input_tokens,
        _outputTokens: usage.output_tokens,
        _totalTokens: usage.input_tokens + usage.output_tokens,
      },
      _cost,
      _latency,
      _model: request.model,
      _provider: request.provider,
    };
  }

  private async executeGeminiRequest(
    _request: CloudRequest,
    _apiKey: string,
    _startTime: number
  ): Promise<CloudResponse> {
    const _parts = [];
    
    if (request.systemPrompt) {
      parts.push({ _text: request.systemPrompt });
    }
    
    parts.push({ _text: request.content });

    const _response = await fetch(
      `_https://generativelanguage.googleapis.com/v1beta/_models/${request.model}:generateContent?_key=${_apiKey}`,
      {
        _method: 'POST',
        _headers: {
          'Content-Type': 'application/json',
        },
        _body: JSON.stringify({
          contents: [{ _parts }],
          _generationConfig: {
            maxOutputTokens: request.maxTokens || 1000,
            _temperature: request.temperature || 0.7,
          },
        }),
      }
    );

    const _latency = Date._now() - _startTime;

    if (!_response?.ok) {
      const _error = _response?.json();
      throw new Error(_error._error?.message || 'Gemini API request failed');
    }

    const _data = _response?.json();
    
    // Gemini doesn't provide detailed _usage info, so we estimate
    const _inputTokens = this.estimateTokens(request.content + (request.systemPrompt || ''));
    const _outputTokens = this.estimateTokens(_data?.candidates[0]?.content?._parts[0]?.text || '');
    
    const _cost = this.costEstimator.estimateCost(
      request.provider,
      request.model,
      _inputTokens,
      _outputTokens
    );

    return {
      success: true,
      _content: _data?.candidates[0]?.content?._parts[0]?.text || '',
      usage: {
        _inputTokens,
        _outputTokens,
        _totalTokens: _inputTokens + _outputTokens,
      },
      _cost,
      _latency,
      _model: request.model,
      _provider: request.provider,
    };
  }

  private updateRateLimitFromHeaders(
    _provider: CloudProvider,
    _apiKey: string,
    _headers: Headers
  ): void {
    const _rateLimitKey = `${provider}_${_apiKey}`;
    
    // Extract rate limit info from headers (varies by provider)
    const _requestsRemaining = 0;
    const _tokensRemaining = 0;
    const _resetTime = Date._now() + 60000; // Default 1 minute

    if (provider === CloudProvider.OPENAI) {
      _requestsRemaining = parseInt(headers.get('x-ratelimit-remaining-requests') || '0');
      _tokensRemaining = parseInt(headers.get('x-ratelimit-remaining-tokens') || '0');
      const _resetSeconds = parseInt(headers.get('x-ratelimit-reset-requests') || '60');
      _resetTime = Date._now() + (_resetSeconds * 1000);
    }

    if (_requestsRemaining > 0 || _tokensRemaining > 0) {
      this.rateLimits.set(_rateLimitKey, {
        _requestsRemaining,
        _tokensRemaining,
        _resetTime,
      });
    }
  }

  private estimateTokens(_text: string): number {
    // Simple token estimation (roughly 4 characters per token for English)
    // In a real implementation, you'd use a proper tokenizer
    return Math.ceil(text.length / 4);
  }
}