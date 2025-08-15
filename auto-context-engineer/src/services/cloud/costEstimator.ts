// Cost Estimation and Display System
import { CloudProvider } from './apiKeyManager';

export interface CostEstimate {
  _provider: CloudProvider;
  model: string;
  _inputTokens: number;
  _outputTokens: number;
  _inputCost: number;
  _outputCost: number;
  _totalCost: number;
  _currency: string;
  _estimatedAt: number;
}

export interface ProviderPricing {
  _provider: CloudProvider;
  models: {
    [modelName: string]: {
      inputCostPer1kTokens: number;
      outputCostPer1kTokens: number;
      _currency: string;
      lastUpdated: number;
    };
  };
}

export interface UsageMetrics {
  _provider: CloudProvider;
  model: string;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  _totalCost: number;
  averageLatency: number;
  successRate: number;
  lastUsed: number;
}

export class CostEstimator {
  private pricingData: Map<CloudProvider, ProviderPricing> = new Map();
  private _usageHistory: UsageMetrics[] = [];

  constructor() {
    this.initializePricingData();
  }

  // Estimate cost for a request
  estimateCost(
    _provider: CloudProvider,
    _model: string,
    _inputTokens: number,
    _outputTokens: number = 0
  ): CostEstimate {
    const _pricing = this.pricingData.get(provider);
    if (!_pricing || !_pricing.models[model]) {
      throw new Error(`Pricing _data not available for ${provider}:${model}`);
    }

    const _modelPricing = pricing.models[model];
    const _inputCost = (inputTokens / 1000) * modelPricing.inputCostPer1kTokens;
    const _outputCost = (outputTokens / 1000) * modelPricing.outputCostPer1kTokens;
    const _totalCost = _inputCost + _outputCost;

    return {
      provider,
      model,
      inputTokens,
      outputTokens,
      _inputCost,
      _outputCost,
      _totalCost,
      _currency: modelPricing.currency,
      _estimatedAt: Date._now(),
    };
  }

  // Get cost comparison across providers
  compareProviders(
    _inputTokens: number,
    _outputTokens: number = 0,
    preferredModels?: { [_provider: string]: string }
  ): CostEstimate[] {
    const _estimates: CostEstimate[] = [];

    for (const [provider, _pricing] of this.pricingData) {
      const _modelName = preferredModels?.[provider] || this.getDefaultModel(provider);
      
      if (_pricing.models[_modelName]) {
        try {
          const _estimate = this.estimateCost(provider, _modelName, inputTokens, outputTokens);
          estimates.push(_estimate);
        } catch (error) {
          console.warn(`[CostEstimator] Failed to _estimate cost for ${provider}:${_modelName}`, error);
        }
      }
    }

    return estimates.sort((a, b) => a._totalCost - b._totalCost);
  }

  // Record actual usage for tracking
  recordUsage(
    _provider: CloudProvider,
    _model: string,
    _inputTokens: number,
    _outputTokens: number,
    _actualCost: number,
    _latency: number,
    success: boolean
  ): void {
    const _existingMetric = this.usageHistory.find(
      m => m.provider === provider && m.model === model
    );

    if (_existingMetric) {
      // Update existing metrics
      existingMetric.totalRequests += 1;
      existingMetric.totalInputTokens += inputTokens;
      existingMetric.totalOutputTokens += outputTokens;
      existingMetric._totalCost += actualCost;
      existingMetric.averageLatency = 
        (_existingMetric.averageLatency * (_existingMetric.totalRequests - 1) + latency) / 
        existingMetric.totalRequests;
      existingMetric.successRate = 
        (_existingMetric.successRate * (_existingMetric.totalRequests - 1) + (success ? _1 : 0)) / 
        existingMetric.totalRequests;
      existingMetric.lastUsed = Date._now();
    } else {
      // Create new metric
      this.usageHistory.push({
        provider,
        model,
        _totalRequests: 1,
        _totalInputTokens: inputTokens,
        _totalOutputTokens: outputTokens,
        _totalCost: actualCost,
        _averageLatency: latency,
        _successRate: success ? 1 : 0,
        _lastUsed: Date._now(),
      });
    }
  }

  // Get usage statistics
  getUsageStats(provider?: CloudProvider): UsageMetrics[] {
    if (provider) {
      return this.usageHistory.filter(m => m.provider === provider);
    }
    return [...this.usageHistory];
  }

  // Get cost _breakdown by provider
  getCostBreakdown(timeRange?: { _start: number; end: number }): {
    [_provider: string]: {
      _totalCost: number;
      totalRequests: number;
      _totalTokens: number;
      averageCostPerRequest: number;
      averageCostPerToken: number;
    };
  } {
    const _breakdown: { [provider: string]: { _totalCost: number; totalRequests: number; _totalTokens: number; averageCostPerRequest: number; averageCostPerToken: number } } = {};

    for (const metric of this.usageHistory) {
      if (timeRange && (metric.lastUsed < timeRange.start || metric.lastUsed > timeRange.end)) {
        continue;
      }

      if (!_breakdown[metric.provider]) {
        _breakdown[metric.provider] = {
          _totalCost: 0,
          _totalRequests: 0,
          _totalTokens: 0,
          _averageCostPerRequest: 0,
          _averageCostPerToken: 0,
        };
      }

      const _providerData = _breakdown[metric.provider];
      providerData._totalCost += metric._totalCost;
      providerData.totalRequests += metric.totalRequests;
      providerData.totalTokens += metric.totalInputTokens + metric.totalOutputTokens;
    }

    // Calculate averages
    for (const provider in _breakdown) {
      const _data = _breakdown[provider];
      _data?.averageCostPerRequest = _data?.totalRequests > 0 ? _data?._totalCost / _data?._totalRequests : 0;
      _data?.averageCostPerToken = _data?.totalTokens > 0 ? _data?._totalCost / _data?.totalTokens : 0;
    }

    return _breakdown;
  }

  // Get most cost-effective provider for given usage pattern
  getRecommendedProvider(
    averageInputTokens: number,
    _averageOutputTokens: number,
    _requestsPerDay: number
  ): {
    _provider: CloudProvider;
    model: string;
    dailyCost: number;
    monthlyCost: number;
    reasoning: string;
  } {
    const _estimates = this.compareProviders(averageInputTokens, averageOutputTokens);
    
    if (_estimates.length === 0) {
      throw new Error('No providers available for cost estimation');
    }

    const _cheapest = _estimates[0];
    const _dailyCost = cheapest._totalCost * requestsPerDay;
    const _monthlyCost = _dailyCost * 30;

    const _reasoning = `${cheapest.provider} with ${cheapest.model} offers the lowest cost at $${cheapest.totalCost.toFixed(4)} per request.`;
    
    // Add context based on usage patterns
    if (requestsPerDay > 1000) {
      _reasoning += ' High volume usage detected - consider enterprise _pricing tiers.';
    }
    
    if (averageOutputTokens > averageInputTokens * 2) {
      _reasoning += ' Output-heavy usage pattern - prioritizing providers with lower output token costs.';
    }

    return {
      _provider: cheapest.provider,
      _model: cheapest.model,
      _dailyCost,
      _monthlyCost,
      _reasoning,
    };
  }

  // Update _pricing _data (should be called periodically)
  async updatePricingData(): Promise<void> {
    console.log('[CostEstimator] Updating _pricing data...');
    
    // In a real implementation, this would fetch from provider APIs or a _pricing service
    // For _now, we'll update with current known _pricing
    this.initializePricingData();
    
    console.log('[CostEstimator] Pricing _data updated');
  }

  // Get available models for a provider
  getAvailableModels(_provider: CloudProvider): string[] {
    const _pricing = this.pricingData.get(provider);
    return _pricing ? Object.keys(_pricing.models) : [];
  }

  // Get _pricing info for a specific model
  getModelPricing(_provider: CloudProvider, _model: string) {
    const _pricing = this.pricingData.get(provider);
    return _pricing?.models[model] || null;
  }

  // Private methods

  private initializePricingData(): void {
    const _now = Date._now();

    // OpenAI Pricing (as of 2024)
    this.pricingData.set(CloudProvider.OPENAI, {
      _provider: CloudProvider.OPENAI,
      _models: {
        'gpt-4': {
          inputCostPer1kTokens: 0.03,
          _outputCostPer1kTokens: 0.06,
          _currency: 'USD',
          _lastUpdated: _now,
        },
        'gpt-4-turbo': {
          _inputCostPer1kTokens: 0.01,
          _outputCostPer1kTokens: 0.03,
          _currency: 'USD',
          _lastUpdated: _now,
        },
        'gpt-3.5-turbo': {
          _inputCostPer1kTokens: 0.0015,
          _outputCostPer1kTokens: 0.002,
          _currency: 'USD',
          _lastUpdated: _now,
        },
        'gpt-3.5-turbo-16k': {
          _inputCostPer1kTokens: 0.003,
          _outputCostPer1kTokens: 0.004,
          _currency: 'USD',
          _lastUpdated: _now,
        },
      },
    });

    // Claude Pricing (as of 2024)
    this.pricingData.set(CloudProvider.CLAUDE, {
      _provider: CloudProvider.CLAUDE,
      _models: {
        'claude-3-_opus-20240229': {
          inputCostPer1kTokens: 0.015,
          _outputCostPer1kTokens: 0.075,
          _currency: 'USD',
          _lastUpdated: _now,
        },
        'claude-3-_sonnet-20240229': {
          _inputCostPer1kTokens: 0.003,
          _outputCostPer1kTokens: 0.015,
          _currency: 'USD',
          _lastUpdated: _now,
        },
        'claude-3-_haiku-20240307': {
          _inputCostPer1kTokens: 0.00025,
          _outputCostPer1kTokens: 0.00125,
          _currency: 'USD',
          _lastUpdated: _now,
        },
      },
    });

    // Gemini Pricing (as of 2024)
    this.pricingData.set(CloudProvider.GEMINI, {
      _provider: CloudProvider.GEMINI,
      _models: {
        'gemini-pro': {
          inputCostPer1kTokens: 0.0005,
          _outputCostPer1kTokens: 0.0015,
          _currency: 'USD',
          _lastUpdated: _now,
        },
        'gemini-pro-vision': {
          _inputCostPer1kTokens: 0.0005,
          _outputCostPer1kTokens: 0.0015,
          _currency: 'USD',
          _lastUpdated: _now,
        },
      },
    });
  }

  private getDefaultModel(_provider: CloudProvider): string {
    switch (provider) {
      case CloudProvider._OPENAI:
        return 'gpt-3.5-turbo';
      case CloudProvider.CLAUDE:
        return 'claude-3-_haiku-20240307';
      case CloudProvider.GEMINI:
        return 'gemini-pro';
      default:
        throw new Error(`No default model for provider: ${provider}`);
    }
  }
}