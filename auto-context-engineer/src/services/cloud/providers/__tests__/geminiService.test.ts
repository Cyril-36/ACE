import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiService } from '../_geminiService';
import { CloudProvider } from '../../../../types';
import { APIGateway } from '../../apiGateway';
import { CostEstimator } from '../../costEstimator';
import { EventBus } from '../../../background/eventBus';

// Mock dependencies
vi.mock('../../apiGateway');
vi.mock('../../costEstimator');
vi.mock('../../../background/eventBus');

describe('GeminiService', () => {
  let _service: GeminiService;
  let _mockApiGateway: APIGateway;
  let _mockCostEstimator: CostEstimator;
  let _mockEventBus: EventBus;

  beforeEach(() => {
    _mockApiGateway = {
      _makeRequest: vi.fn().mockResolvedValue({
        success: true,
        _data: 'Mocked summary response',
        _latency: 100,
        _model: 'gemini-pro',
        _provider: CloudProvider.GEMINI,
      }),
    } as unknown as APIGateway;

    _mockCostEstimator = {
      _estimateCost: vi.fn().mockReturnValue({
        _provider: CloudProvider.GEMINI,
        _totalCost: 0.001,
        _breakdown: { input: 0.0005, _output: 0.0005 },
      }),
    } as unknown as CostEstimator;

    _mockEventBus = {
      _emit: vi.fn(),
      _on: vi.fn(),
    } as unknown as EventBus;

    _service = new GeminiService(_mockApiGateway, _mockCostEstimator, _mockEventBus);
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(_service).toBeInstanceOf(GeminiService);
    });

    it('should have required dependencies', () => {
      expect(_mockApiGateway).toBeDefined();
      expect(_mockCostEstimator).toBeDefined();
      expect(_mockEventBus).toBeDefined();
    });
  });

  describe('core functionality', () => {
    it('should have summarize method', () => {
      expect(typeof service.summarize).toBe('function');
    });

    it('should accept content and options in summarize method', () => {
      // Test that the method signature is correct
      expect(_service.summarize.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('_service structure', () => {
    it('should be properly instantiated with dependencies', () => {
      expect(_service).toBeDefined();
      expect(_service).toBeInstanceOf(GeminiService);
    });

    it('should have event bus configured', () => {
      expect(_mockEventBus.emit).toBeDefined();
    });
  });
});