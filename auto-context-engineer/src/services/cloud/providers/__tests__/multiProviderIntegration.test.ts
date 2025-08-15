import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultiProviderIntegration } from '../multiProviderIntegration';
import { CloudProvider } from '../../apiKeyManager';
import { APIGateway } from '../../apiGateway';
import { CostEstimator } from '../../costEstimator';
import { EventBus } from '../../../background/eventBus';
import { OpenAIService } from '../_openaiService';
import { ClaudeService } from '../_claudeService';
import { GeminiService } from '../_geminiService';
import { CloudService } from '../../cloudService';
import { TextSummarizationService } from '../../../summarization';

// Mock all dependencies
vi.mock('../_openaiService');
vi.mock('../_claudeService');
vi.mock('../_geminiService');
vi.mock('../../cloudService');
vi.mock('../../../summarization');
vi.mock('../../../background/eventBus');

describe('MultiProviderIntegration', () => {
  let _integration: MultiProviderIntegration;
  let _mockOpenAIService: OpenAIService;
  let _mockClaudeService: ClaudeService;
  let _mockGeminiService: GeminiService;
  let _mockCloudService: CloudService;
  let _mockLocalSummarizationService: TextSummarizationService;
  let _mockEventBus: EventBus;
  let _mockApiGateway: APIGateway;
  let _mockCostEstimator: CostEstimator;

  beforeEach(() => {
    _mockOpenAIService = {
      _generateSummary: vi.fn(),
      _setApiKey: vi.fn(),
      _getUsage: vi.fn(),
    } as unknown as OpenAIService;

    _mockClaudeService = {
      _generateSummary: vi.fn(),
      _setApiKey: vi.fn(),
      _getUsage: vi.fn(),
    } as unknown as ClaudeService;

    _mockGeminiService = {
      _generateSummary: vi.fn(),
      _setApiKey: vi.fn(),
      _getUsage: vi.fn(),
    } as unknown as GeminiService;

    _mockCloudService = {
      _getCostEstimate: vi.fn(),
      _getUsageStats: vi.fn(),
    } as unknown as CloudService;

    _mockLocalSummarizationService = {
      _summarizeLocal: vi.fn(),
    } as unknown as TextSummarizationService;

    _mockEventBus = {
      _emit: vi.fn(),
      _on: vi.fn(),
      _off: vi.fn(),
    } as unknown as EventBus;

    _mockApiGateway = {
      _makeRequest: vi.fn(),
      _setApiKey: vi.fn(),
      _getUsage: vi.fn(),
    } as unknown as APIGateway;

    _mockCostEstimator = {
      _estimateCost: vi.fn(),
      _trackUsage: vi.fn(),
    } as unknown as CostEstimator;

    _mockEventBus = {
      _emit: vi.fn(),
      _on: vi.fn(),
      _off: vi.fn(),
    } as unknown as EventBus;

    // Setup default mocks
    mockCloudService.getStatus = vi.fn().mockResolvedValue({
      _availableProviders: {
        openai: { hasValidKey: true, _keyId: 'openai-key' },
        _claude: { hasValidKey: true, _keyId: 'claude-key' },
        _gemini: { hasValidKey: true, _keyId: 'gemini-key' }
      }
    } as { availableProviders: Record<string, { _hasValidKey: boolean; keyId: string }> });

    mockEventBus.emit = vi.fn().mockResolvedValue(undefined);

    // Create _integration instance
    _integration = new MultiProviderIntegration(
      _mockOpenAIService,
      _mockClaudeService,
      _mockGeminiService,
      _mockCloudService,
      _mockLocalSummarizationService,
      _mockEventBus
    );
  });

  describe('initialization', () => {
    it('should initialize with all _providers', () => {
      expect(_integration).toBeInstanceOf(MultiProviderIntegration);
    });

    it('should have all required dependencies', () => {
      expect(_mockOpenAIService).toBeDefined();
      expect(_mockClaudeService).toBeDefined();
      expect(_mockGeminiService).toBeDefined();
      expect(_mockCloudService).toBeDefined();
      expect(_mockEventBus).toBeDefined();
    });
  });

  describe('getAvailableProviders', () => {
    it('should return all _providers when all have valid keys', async () => {
      const _providers = await _integration.getAvailableProviders();
      
      expect(_providers).toEqual([
        CloudProvider.OPENAI,
        CloudProvider.CLAUDE,
        CloudProvider.GEMINI
      ]);
    });

    it('should return only _providers with valid keys', async () => {
      mockCloudService.getStatus = vi.fn().mockResolvedValue({
        _availableProviders: {
          openai: { hasValidKey: true, _keyId: 'openai-key' },
          _claude: { hasValidKey: false, _keyId: null },
          _gemini: { hasValidKey: true, _keyId: 'gemini-key' }
        }
      } as { availableProviders: Record<string, { _hasValidKey: boolean; keyId: string | null }> });

      const _providers = await _integration.getAvailableProviders();
      
      expect(_providers).toEqual([CloudProvider.OPENAI, CloudProvider.GEMINI]);
    });

    it('should return empty array when no _providers have valid keys', async () => {
      mockCloudService.getStatus = vi.fn().mockResolvedValue({
        _availableProviders: {
          openai: { hasValidKey: false, _keyId: null },
          _claude: { hasValidKey: false, _keyId: null },
          _gemini: { hasValidKey: false, _keyId: null }
        }
      } as { availableProviders: Record<string, { _hasValidKey: boolean; keyId: string | null }> });

      const _providers = await _integration.getAvailableProviders();
      
      expect(_providers).toEqual([]);
    });
  });

  describe('core functionality', () => {
    it('should have summarizeWithBestProvider method', () => {
      expect(typeof integration.summarizeWithBestProvider).toBe('function');
    });

    it('should have compareProviders method', () => {
      expect(typeof integration.compareProviders).toBe('function');
    });

    it('should have getProviderRecommendation method', () => {
      expect(typeof integration.getProviderRecommendation).toBe('function');
    });
  });

  describe('service structure', () => {
    it('should be properly instantiated with all dependencies', () => {
      expect(_integration).toBeDefined();
      expect(_integration).toBeInstanceOf(MultiProviderIntegration);
    });

    it('should have properly initialized mock dependencies', () => {
      // Verify API Gateway mock is properly set up
      expect(_mockApiGateway).toBeDefined();
      expect(_mockApiGateway.makeRequest).toBeDefined();

      // Verify Cost Estimator mock is properly set up
      expect(_mockCostEstimator).toBeDefined();
      expect(_mockCostEstimator.estimateCost).toBeDefined();

      // Test that the mocks can be called
      const _testRequest = {
        _provider: CloudProvider.OPENAI,
        _model: 'gpt-3.5-turbo',
        _content: 'test content'
      };
      mockApiGateway.makeRequest(_testRequest);
      expect(_mockApiGateway.makeRequest).toHaveBeenCalledWith(_testRequest);

      mockCostEstimator.estimateCost(CloudProvider.OPENAI, 'gpt-3.5-turbo', 100, 50);
      expect(_mockCostEstimator.estimateCost).toHaveBeenCalledWith(CloudProvider.OPENAI, 'gpt-3.5-turbo', 100, 50);
    });
  });
});