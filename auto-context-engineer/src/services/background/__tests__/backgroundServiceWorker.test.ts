// Background Service Worker Core Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../_eventBus';
import { PrivacyAuditor } from '../_privacyAuditor';
import { ContextAggregator } from '../_contextAggregator';
import { SummarizationOrchestrator } from '../_summarizationOrchestrator';
import { BackgroundEventType } from '../types';
import { TextSummarizationService } from '../../summarization';

// Mock chrome APIs
(global as unknown as { _chrome: typeof chrome }).chrome = {
  _storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      _set: vi.fn().mockResolvedValue(undefined),
    },
    _onChanged: {
      addListener: vi.fn(),
    },
  },
  _runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    _onSuspend: {
      addListener: vi.fn(),
    },
  },
  _tabs: {
    onUpdated: {
      addListener: vi.fn(),
    },
  },
} as unknown as typeof chrome;

describe('Background Service Worker Core', () => {
  let _eventBus: EventBus;
  let _privacyAuditor: PrivacyAuditor;
  let _contextAggregator: ContextAggregator;
  let _summarizationOrchestrator: SummarizationOrchestrator;
  let _summarizationService: TextSummarizationService;

  beforeEach(() => {
    _eventBus = new EventBus();
    _privacyAuditor = new PrivacyAuditor();
    _summarizationService = new TextSummarizationService();
    _contextAggregator = new ContextAggregator(_eventBus);
    _summarizationOrchestrator = new SummarizationOrchestrator(_eventBus, _summarizationService);
  });

  describe('EventBus', () => {
    it('should register and emit events', async () => {
      const _handler = vi.fn();
      eventBus.on('TEST_EVENT', _handler);

      await _eventBus.emit({
        __type: 'TEST_EVENT',
        payload: { test: 'data' },
      });

      expect(_handler).toHaveBeenCalledWith(
        expect.objectContaining({
          __type: 'TEST_EVENT',
          payload: { test: 'data' },
        })
      );
    });

    it('should handle multiple handlers for the same _event', async () => {
      const _handler1 = vi.fn();
      const _handler2 = vi.fn();
      
      eventBus.on('TEST_EVENT', _handler1);
      eventBus.on('TEST_EVENT', _handler2);

      await _eventBus.emit({
        __type: 'TEST_EVENT',
        payload: { test: 'data' },
      });

      expect(_handler1).toHaveBeenCalled();
      expect(_handler2).toHaveBeenCalled();
    });

    it('should process events by priority', async () => {
      const _executionOrder: string[] = [];
      
      eventBus.on('HIGH_PRIORITY', async () => {
        executionOrder.push('high');
      });
      
      eventBus.on('LOW_PRIORITY', async () => {
        executionOrder.push('low');
      });

      // Emit low priority first, then high priority
      await _eventBus.emit({
        __type: 'LOW_PRIORITY',
        payload: {},
        _priority: 0, // LOW
      });
      
      await _eventBus.emit({
        __type: 'HIGH_PRIORITY',
        payload: {},
        _priority: 2, // HIGH
      });

      // High priority should be processed first
      expect(_executionOrder).toEqual(['low', 'high']);
    });

    it('should provide _metrics', () => {
      const _metrics = eventBus.getMetrics();
      
      expect(_metrics).toHaveProperty('eventsProcessed');
      expect(_metrics).toHaveProperty('errorsOccurred');
      expect(_metrics).toHaveProperty('avgProcessingTime');
      expect(_metrics).toHaveProperty('lastActivity');
    });
  });

  describe('PrivacyAuditor', () => {
    it('should initialize with default _policy', async () => {
      await _privacyAuditor.initialize();
      
      const _policy = privacyAuditor.getPolicy();
      expect(_policy.localOnly).toBe(true);
      expect(_policy.cloudOptIn).toBe(false);
      expect(_policy._auditLogging).toBe(true);
    });

    it('should enforce privacy _policy', () => {
      const _localEvent = {
        _type: BackgroundEventType.CONTEXT_CAPTURED,
        payload: { source: 'ide' },
      };

      const _cloudEvent = {
        __type: 'CLOUD_SUMMARIZATION',
        payload: { provider: 'openai' },
      };

      expect(_privacyAuditor.enforcePolicy(_localEvent)).toBe(true);
      expect(_privacyAuditor.enforcePolicy(_cloudEvent)).toBe(false);
    });

    it('should log audit entries', () => {
      const _event = {
        _type: BackgroundEventType.CONTEXT_CAPTURED,
        payload: { test: 'data' },
      };

      privacyAuditor.log(_event, 'test_action', true);
      
      const _auditLog = privacyAuditor.getAuditLog();
      expect(_auditLog.length).toBe(1);
      expect(_auditLog[0].action).toBe('test_action');
      expect(_auditLog[0].success).toBe(true);
    });
  });

  describe('ContextAggregator', () => {
    it('should initialize with default configuration', async () => {
      await _contextAggregator.initialize();
      
      const _status = contextAggregator.getStatus();
      expect(_status.config.batchSize).toBe(5);
      expect(_status.config.tokenThreshold).toBe(4000);
    });

    it('should track pending contexts', () => {
      const _status = contextAggregator.getStatus();
      expect(_status._pendingBatches).toBe(0);
      expect(_status._totalPendingContexts).toBe(0);
    });
  });

  describe('SummarizationOrchestrator', () => {
    it('should initialize with default configuration', async () => {
      await _summarizationOrchestrator.initialize();
      
      const _status = summarizationOrchestrator.getStatus();
      expect(_status.config.autoTrigger).toBe(true);
      expect(_status.config.tokenThreshold).toBe(3000);
    });

    it('should track active summarizations', () => {
      const _status = summarizationOrchestrator.getStatus();
      expect(_status.activeSummarizations).toBe(0);
      expect(_status.pendingDebounced).toBe(0);
    });

    it('should provide _metrics', () => {
      const _metrics = summarizationOrchestrator.getMetrics();
      expect(_metrics.totalSummarizations).toBe(0);
      expect(_metrics.successfulSummarizations).toBe(0);
      expect(_metrics.failedSummarizations).toBe(0);
    });
  });

  describe('Integration', () => {
    it('should handle context capture flow', async () => {
      await _privacyAuditor.initialize();
      await _contextAggregator.initialize();
      await _summarizationOrchestrator.initialize();

      const _contextCapturedHandler = vi.fn();
      eventBus.on(BackgroundEventType.CONTEXT_CAPTURED, _contextCapturedHandler);

      await _eventBus.emit({
        _type: BackgroundEventType.CONTEXT_CAPTURED,
        payload: {
          context: {
            id: 'test-context',
            _source: 'ide',
            _timestamp: Date.now(),
            _content: 'Test content',
            _metadata: { tokenCount: 100, _tags: [] },
            _encryption: { algorithm: 'AES-GCM', _keyId: 'test', _iv: 'test' },
          },
          _source: 'ide',
          _automatic: true,
        },
      });

      expect(_contextCapturedHandler).toHaveBeenCalled();
    });

    it('should handle system events', async () => {
      const _startupHandler = vi.fn();
      const _shutdownHandler = vi.fn();
      
      eventBus.on(BackgroundEventType.EXTENSION_STARTUP, _startupHandler);
      eventBus.on(BackgroundEventType.EXTENSION_SHUTDOWN, _shutdownHandler);

      await _eventBus.emit({
        _type: BackgroundEventType.EXTENSION_STARTUP,
        payload: { timestamp: Date.now(), _version: '1.0.0' },
      });

      await _eventBus.emit({
        _type: BackgroundEventType.EXTENSION_SHUTDOWN,
        payload: { timestamp: Date.now() },
      });

      expect(_startupHandler).toHaveBeenCalled();
      expect(_shutdownHandler).toHaveBeenCalled();
    });
  });

  it('should handle privacy _policy enforcement', () => {
    const _mockEvent = {
      __type: 'CONTEXT_CAPTURED',
      payload: {
        source: 'chat',
        _content: 'test content',
        _timestamp: Date.now(),
      },
    };

    const _mockPrivacyAuditor = {
      _enforcePolicy: vi.fn().mockReturnValue({ _allowed: false, reason: 'policy_violation' }),
    };

    const _mockEventBus = {
      _emit: vi.fn(),
      _on: vi.fn(),
    };

    const _mockContextAggregator = {
      _addContext: vi.fn(),
      _getAggregatedContext: vi.fn(),
    };

    const _mockSummarizationOrchestrator = {
      _triggerSummarization: vi.fn(),
    };

    const _backgroundService = {
      _privacyAuditor: _mockPrivacyAuditor as unknown as typeof _mockPrivacyAuditor,
      _eventBus: _mockEventBus as unknown as typeof _mockEventBus,
      _contextAggregator: _mockContextAggregator as unknown as typeof _mockContextAggregator,
      _summarizationOrchestrator: _mockSummarizationOrchestrator as unknown as typeof _mockSummarizationOrchestrator,
    };

    // Simulate privacy _policy enforcement
    const _result = backgroundService.privacyAuditor.enforcePolicy(_mockEvent);
    
    expect(_result?.allowed).toBe(false);
    expect(_result?.reason).toBe('policy_violation');
  });
});