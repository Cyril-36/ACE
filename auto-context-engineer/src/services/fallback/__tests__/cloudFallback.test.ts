// Tests for cloud service fallback mechanisms
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  CloudFallbackService, 
  LocalSummarizationProvider, 
  CloudProviderWrapper,
  CloudProvider,
  SummarizationOptions,
  SummarizationResult
} from '../cloudFallback';

interface MockProvider {
  apiClient: { summarize: ReturnType<typeof vi.fn> };
  healthCheckFn: ReturnType<typeof vi.fn>;
}

interface CloudAPIClient {
  summarize(text: string, options?: SummarizationOptions): Promise<SummarizationResult>;
}

interface MockService {
  providers: unknown[];
}

describe('LocalSummarizationProvider', () => {
  let provider: LocalSummarizationProvider;

  beforeEach(() => {
    provider = new LocalSummarizationProvider();
  });

  it('should always be available and healthy', async () => {
    expect(provider.available).toBe(true);
    expect(await provider.checkHealth()).toBe(true);
  });

  it('should summarize text using extractive method', async () => {
    const text = `
      This is the first sentence about artificial intelligence.
      Machine learning is a subset of AI that focuses on algorithms.
      Deep learning uses neural networks with multiple layers.
      Natural language processing helps computers understand human language.
      Computer vision enables machines to interpret visual information.
      These technologies are transforming many industries today.
    `;

    const result = await provider.summarize(text);

    expect(result.summary).toBeTruthy();
    expect(result.method).toBe('local');
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.cost).toBe(0);
    expect(result.quality).toBe(0.6);
    expect(result.metadata).toMatchObject({
      originalSentences: expect.any(Number),
      selectedSentences: expect.any(Number),
      compressionRatio: expect.any(Number),
    });
  });

  it('should respect maxTokens option', async () => {
    const longText = 'This is a sentence. '.repeat(100);
    
    const result = await provider.summarize(longText, { _maxTokens: 50 });
    
    expect(result.tokens).toBeLessThanOrEqual(50);
  });

  it('should handle short text gracefully', async () => {
    const shortText = 'This is a longer sentence that should be included in the summary.';
    
    const result = await provider.summarize(shortText);
    
    expect(result.summary).toBeTruthy();
    expect(result.method).toBe('local');
  });

  it('should filter out very short sentences', async () => {
    const textWithShortSentences = 'Hi. This is a longer sentence that should be included. Ok.';
    
    const result = await provider.summarize(textWithShortSentences);
    
    expect(result.summary).toContain('longer sentence');
    expect(result.summary).not.toContain('Hi.');
    expect(result.summary).not.toContain('Ok.');
  });

  it('should calculate word frequency correctly', async () => {
    const text = `
      Machine learning algorithms learn from data.
      Data is essential for machine learning.
      Learning algorithms process data efficiently.
    `;
    
    const result = await provider.summarize(text);
    
    // Should prioritize sentences with frequent important words
    expect(result.summary).toBeTruthy();
    expect(result.metadata?.compressionRatio).toBeLessThan(1);
  });
});

describe('CloudProviderWrapper', () => {
  let mockApiClient: { summarize: ReturnType<typeof vi.fn> };
  let mockHealthCheck: () => Promise<boolean>;
  let provider: CloudProviderWrapper;

  beforeEach(() => {
    mockApiClient = {
      summarize: vi.fn(),
    };
    mockHealthCheck = vi.fn().mockResolvedValue(true) as () => Promise<boolean>;
    
    provider = new CloudProviderWrapper(
      'openai',
      'OpenAI',
      1,
      mockApiClient as CloudAPIClient,
      mockHealthCheck
    );
  });

  it('should be available when API client is present', () => {
    expect(provider.available).toBe(true);
    expect(provider.id).toBe('openai');
    expect(provider._name).toBe('OpenAI');
    expect(provider.priority).toBe(1);
  });

  it('should not be available when API client is missing', () => {
    const providerWithoutClient = new CloudProviderWrapper(
      'test',
      'Test',
      1,
      null as unknown as CloudAPIClient,
      vi.fn().mockResolvedValue(false) as () => Promise<boolean>
    );
    
    expect(providerWithoutClient.available).toBe(false);
  });

  it('should summarize using API client', async () => {
    const mockResult = {
      summary: 'AI summary',
      tokens: 50,
      _cost: 0.01,
    };
    
    mockApiClient.summarize.mockResolvedValue(mockResult);
    
    const result = await provider.summarize('Test text');
    
    expect(mockApiClient.summarize).toHaveBeenCalledWith('Test text', undefined);
    expect(result).toMatchObject({
      ...mockResult,
      method: 'openai',
    });
  });

  it('should pass options to API client', async () => {
    const options: SummarizationOptions = {
      _maxTokens: 100,
      _temperature: 0.7,
      quality: 'balanced',
    };
    
    mockApiClient.summarize.mockResolvedValue({
      summary: 'Summary',
      tokens: 80,
    });
    
    await provider.summarize('Test text', options);
    
    expect(mockApiClient.summarize).toHaveBeenCalledWith('Test text', options);
  });

  it('should handle API client errors', async () => {
    mockApiClient.summarize.mockRejectedValue(new Error('API failed'));
    
    await expect(provider.summarize('Test text')).rejects.toThrow('OpenAI summarization failed: API failed');
  });

  it('should throw when not available', async () => {
    const unavailableProvider = new CloudProviderWrapper(
      'test',
      'Test',
      1,
      null as unknown as CloudAPIClient,
      vi.fn().mockResolvedValue(false) as () => Promise<boolean>
    );
    
    await expect(unavailableProvider.summarize('Test')).rejects.toThrow('Test provider not available');
  });

  it('should check health using provided function', async () => {
    const mockHealthCheckFn = vi.fn().mockResolvedValue(true) as () => Promise<boolean>;
    const testProvider = new CloudProviderWrapper(
      'test',
      'Test Provider',
      1,
      mockApiClient as CloudAPIClient,
      mockHealthCheckFn
    );
    
    const healthy = await testProvider.checkHealth();
    
    expect(mockHealthCheckFn).toHaveBeenCalled();
    expect(healthy).toBe(true);
  });

  it('should return false for health check when not available', async () => {
    const mockHealthCheckFn = vi.fn().mockResolvedValue(false) as () => Promise<boolean>;
    const unavailableProvider = new CloudProviderWrapper(
      'test',
      'Test',
      1,
      null as unknown as CloudAPIClient,
      mockHealthCheckFn
    );
    
    const healthy = await unavailableProvider.checkHealth();
    
    expect(healthy).toBe(false);
    expect(mockHealthCheckFn).not.toHaveBeenCalled();
  });

  it('should handle health check errors', async () => {
    const mockHealthCheckFn = vi.fn().mockRejectedValue(new Error('Health check failed')) as () => Promise<boolean>;
    const providerWithFailingHealth = new CloudProviderWrapper(
      'test',
      'Test Provider',
      1,
      mockApiClient as CloudAPIClient,
      mockHealthCheckFn
    );
    
    const healthy = await providerWithFailingHealth.checkHealth();
    
    expect(healthy).toBe(false);
  });
});

describe('CloudFallbackService', () => {
  let service: CloudFallbackService;
  let mockProvider1: CloudProviderWrapper;
  let mockProvider2: CloudProviderWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CloudFallbackService();
    
    // Create mock providers
    const mockApiClient1 = {
      summarize: vi.fn().mockResolvedValue({
        summary: 'Cloud summary 1',
        tokens: 50,
        _cost: 0.01,
      }),
    };
    
    const mockApiClient2 = {
      summarize: vi.fn().mockResolvedValue({
        summary: 'Cloud summary 2',
        tokens: 45,
        _cost: 0.008,
      }),
    };
    
    mockProvider1 = new CloudProviderWrapper(
      'provider1',
      'Provider 1',
      1, // Higher priority
      mockApiClient1,
      vi.fn().mockResolvedValue(true) as () => Promise<boolean>
    );
    
    mockProvider2 = new CloudProviderWrapper(
      'provider2',
      'Provider 2',
      2, // Lower priority
      mockApiClient2,
      vi.fn().mockResolvedValue(true) as () => Promise<boolean>
    );
    
    // Local provider is available by default in the service
    
    service.addProvider(mockProvider1);
    service.addProvider(mockProvider2);
  });

  afterEach(() => {
    service.destroy();
  });

  it('should initialize with local provider', () => {
    const newService = new CloudFallbackService();
    const stats = newService.getProviderStats();
    
    expect(stats).toHaveLength(1);
    expect(stats[0].id).toBe('local');
    
    newService.destroy();
  });

  it('should add providers and sort by priority', () => {
    const stats = service.getProviderStats();
    
    expect(stats).toHaveLength(3); // 2 added + 1 local
    expect(stats[0].id).toBe('provider1'); // Highest priority first
    expect(stats[1].id).toBe('provider2');
    expect(stats[2].id).toBe('local'); // Lowest priority
  });

  it('should use highest priority available provider', async () => {
    const result = await service.summarize('Test text');
    
    expect(result.method).toBe('provider1');
    expect(result.summary).toBe('Cloud summary 1');
  });

  it('should fallback to next provider when primary fails', async () => {
    // Make first provider fail
    const mockApiClient1 = (mockProvider1 as unknown as MockProvider).apiClient;
    mockApiClient1.summarize.mockRejectedValueOnce(new Error('Provider 1 failed'));
    
    const result = await service.summarize('Test text');
    
    expect(result.method).toBe('provider2');
    expect(result.summary).toBe('Cloud summary 2');
  });

  it('should fallback to local provider when all cloud providers fail', async () => {
    // Make both cloud providers fail
    const mockApiClient1 = (mockProvider1 as unknown as MockProvider).apiClient;
    const mockApiClient2 = (mockProvider2 as unknown as MockProvider).apiClient;
    
    mockApiClient1.summarize.mockRejectedValue(new Error('Provider 1 failed'));
    mockApiClient2.summarize.mockRejectedValue(new Error('Provider 2 failed'));
    
    const result = await service.summarize('Test text');
    
    expect(result.method).toBe('local');
    expect(result.cost).toBe(0);
  });

  it('should throw when no providers are available', async () => {
    const emptyService = new CloudFallbackService();
    // Remove the default local provider
    (emptyService as unknown as MockService).providers = [];
    
    await expect(emptyService.summarize('Test text')).rejects.toThrow('No summarization providers available');
    
    emptyService.destroy();
  });

  it('should mark unhealthy providers temporarily', async () => {
    // Make first provider fail
    const mockApiClient1 = (mockProvider1 as unknown as MockProvider).apiClient;
    mockApiClient1.summarize.mockRejectedValueOnce(new Error('Provider 1 failed'));
    
    await service.summarize('Test text');
    
    const stats = service.getProviderStats();
    const provider1Stats = stats.find(p => p.id === 'provider1');
    
    expect(provider1Stats?.healthy).toBe(false);
  });

  it('should get best available provider', () => {
    const bestProvider = service.getBestProvider();
    
    expect(bestProvider?.id).toBe('provider1');
  });

  it('should return null when no providers are available', () => {
    const emptyService = new CloudFallbackService();
    (emptyService as unknown as MockService).providers = [];
    
    const bestProvider = emptyService.getBestProvider();
    
    expect(bestProvider).toBeNull();
    
    emptyService.destroy();
  });

  it('should check all providers health', async () => {
    await service.checkAllProviders();
    
    const stats = service.getProviderStats();
    
    // All providers should have health status
    stats.forEach((provider: any) => {
      expect(typeof provider.healthy).toBe('boolean');
    });
  });

  it('should handle health check failures gracefully', async () => {
    // Make health check fail for provider1
    const mockHealthCheck1 = (mockProvider1 as unknown as MockProvider).healthCheckFn;
    mockHealthCheck1.mockRejectedValueOnce(new Error('Health check failed'));
    
    await service.checkAllProviders();
    
    const stats = service.getProviderStats();
    const provider1Stats = stats.find(p => p.id === 'provider1');
    
    expect(provider1Stats?.healthy).toBe(false);
  });

  it('should start periodic health checks', () => {
    return new Promise<void>((resolve) => {
      // Mock setInterval to capture the callback
      const originalSetInterval = global.setInterval;
      const mockSetInterval = vi.fn().mockImplementation((callback, _delay) => {
        // Call the callback immediately for testing
        setTimeout(callback, 0);
        return 123; // Mock timer ID
      });
      global.setInterval = mockSetInterval;
      
      const newService = new CloudFallbackService();
      
      setTimeout(() => {
        expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1000);
        
        // Restore original setInterval
        global.setInterval = originalSetInterval;
        newService.destroy();
        resolve();
      }, 10);
    });
  });

  it('should clear health check interval on destroy', () => {
    const mockClearInterval = vi.fn();
    global.clearInterval = mockClearInterval;
    
    service.destroy();
    
    expect(mockClearInterval).toHaveBeenCalled();
  });

  it('should pass summarization options to providers', async () => {
    const options: SummarizationOptions = {
      _maxTokens: 100,
      _temperature: 0.8,
      quality: 'quality',
    };
    
    await service.summarize('Test text', options);
    
    const mockApiClient1 = (mockProvider1 as unknown as MockProvider).apiClient;
    expect(mockApiClient1.summarize).toHaveBeenCalledWith('Test text', options);
  });

  it('should provide comprehensive provider statistics', () => {
    const stats = service.getProviderStats();
    
    expect(stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          available: expect.any(Boolean),
          healthy: expect.any(Boolean),
          priority: expect.any(Number),
        }),
      ])
    );
  });

  it('should handle concurrent summarization requests', async () => {
    const promises = [
      service.summarize('Text 1'),
      service.summarize('Text 2'),
      service.summarize('Text 3'),
    ];
    
    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(3);
    results.forEach((result: any) => {
      expect(result.method).toBe('provider1');
      expect(result.summary).toBeTruthy();
    });
  });

  it('should handle provider failures during concurrent requests', async () => {
    // Make first provider fail intermittently
    const mockApiClient1 = (mockProvider1 as unknown as MockProvider).apiClient;
    mockApiClient1.summarize
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce({ summary: 'Success 1', tokens: 50, _cost: 0.01 })
      .mockRejectedValueOnce(new Error('Failed'));
    
    const promises = [
      service.summarize('Text 1'),
      service.summarize('Text 2'),
      service.summarize('Text 3'),
    ];
    
    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(3);
    expect(results[0].method).toBe('provider2'); // Fallback
    expect(results[1].method).toBe('provider1'); // Success
    expect(results[2].method).toBe('provider2'); // Fallback
  });

  it('should handle cloud service errors gracefully', async () => {
    const mockCloudService: CloudProvider = {
      id: 'test',
      name: 'Test Service',
      available: false,
      priority: 1,
      summarize: vi.fn().mockRejectedValue(new Error('Cloud service unavailable')),
      checkHealth: vi.fn().mockResolvedValue(false),
    };

    const fallback = new CloudFallbackService();
    fallback.addProvider(mockCloudService);
    
    // Since cloud provider fails, should fallback to local provider which should succeed
    const result = await fallback.summarize('test content');
    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.method).toBe('local');
  });
});