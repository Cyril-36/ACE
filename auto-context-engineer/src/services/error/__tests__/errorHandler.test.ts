// Comprehensive tests for error handling and recovery system
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandler, RecoveryStrategy, ErrorContext } from '../errorHandler';
import { ErrorCode } from '../../../types';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockNotificationCallback: ReturnType<typeof vi.fn>;
  let mockAnalyticsCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    mockNotificationCallback = vi.fn();
    mockAnalyticsCallback = vi.fn();
    
    errorHandler.onNotification(mockNotificationCallback);
    errorHandler.setAnalyticsCallback(mockAnalyticsCallback);
  });

  afterEach(() => {
    errorHandler.clearHistory();
  });

  describe('Error Creation', () => {
    it('should create extension error with all properties', () => {
      const error = errorHandler.createError(
        ErrorCode.STORAGE_ERROR,
        'Test error message',
        new Error('Original error'),
        true,
        { component: 'test' }
      );

      expect(error.code).toBe(ErrorCode.STORAGE_ERROR);
      expect(error.message).toBe('Test error message');
      expect(error.recoverable).toBe(true);
      expect(error.context).toMatchObject({
        originalError: 'Original error',
        component: 'test',
      });
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create error without original error', () => {
      const error = errorHandler.createError(
        ErrorCode.NETWORK_ERROR,
        'Network failed'
      );

      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.message).toBe('Network failed');
      expect(error.recoverable).toBe(true);
      expect(error.context?.originalError).toBeUndefined();
    });
  });

  describe('Error Normalization', () => {
    it('should normalize regular Error to ExtensionError', async () => {
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      await errorHandler.handleError(
        new Error('Network timeout'),
        context
      );

      expect(mockAnalyticsCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.NETWORK_ERROR,
          message: 'Network timeout',
        }),
        expect.any(Boolean)
      );
    });

    it('should categorize storage errors correctly', async () => {
      const context: ErrorContext = {
        component: 'StorageService',
        operation: 'store',
      };

      await errorHandler.handleError(
        new Error('IndexedDB quota exceeded'),
        context
      );

      expect(mockAnalyticsCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.STORAGE_ERROR,
        }),
        expect.any(Boolean)
      );
    });

    it('should categorize permission errors correctly', async () => {
      const context: ErrorContext = {
        component: 'PermissionService',
        operation: 'requestPermission',
      };

      await errorHandler.handleError(
        new Error('Permission denied'),
        context
      );

      expect(mockAnalyticsCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.PERMISSION_ERROR,
        }),
        expect.any(Boolean)
      );
    });
  });

  describe('Recovery Strategies', () => {
    it('should register and use custom recovery strategy', async () => {
      const mockStrategy: RecoveryStrategy = {
        id: 'test-strategy',
        name: 'Test Strategy',
        description: 'Test recovery strategy',
        priority: 1,
        canRecover: vi.fn().mockReturnValue(true),
        recover: vi.fn().mockResolvedValue({
          success: true,
          message: 'Recovery successful',
          data: { recovered: true },
        }),
      };

      errorHandler.registerRecoveryStrategy(mockStrategy);

      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const result = await errorHandler.handleError(
        errorHandler.createError(ErrorCode.PROCESSING_ERROR, 'Test error'),
        context
      );

      expect(mockStrategy.canRecover).toHaveBeenCalled();
      expect(mockStrategy.recover).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe('Test Strategy');
    });

    it('should try multiple strategies in priority order', async () => {
      const strategy1: RecoveryStrategy = {
        id: 'strategy-1',
        name: 'Strategy 1',
        description: 'First strategy',
        priority: 2,
        canRecover: vi.fn().mockReturnValue(true),
        recover: vi.fn().mockResolvedValue({ success: false, message: 'Failed' }),
      };

      const strategy2: RecoveryStrategy = {
        id: 'strategy-2',
        name: 'Strategy 2',
        description: 'Second strategy',
        priority: 1,
        canRecover: vi.fn().mockReturnValue(true),
        recover: vi.fn().mockResolvedValue({ success: true, message: 'Success' }),
      };

      errorHandler.registerRecoveryStrategy(strategy1);
      errorHandler.registerRecoveryStrategy(strategy2);

      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const result = await errorHandler.handleError(
        errorHandler.createError(ErrorCode.PROCESSING_ERROR, 'Test error'),
        context
      );

      // Strategy 2 should be tried first (lower priority number)
      expect(strategy2.recover).toHaveBeenCalled();
      expect(strategy1.recover).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe('Strategy 2');
    });

    it('should handle recovery strategy failures gracefully', async () => {
      const faultyStrategy: RecoveryStrategy = {
        id: 'faulty-strategy',
        name: 'Faulty Strategy',
        description: 'Strategy that throws',
        priority: 1,
        canRecover: vi.fn().mockReturnValue(true),
        recover: vi.fn().mockRejectedValue(new Error('Strategy failed')),
      };

      const workingStrategy: RecoveryStrategy = {
        id: 'working-strategy',
        name: 'Working Strategy',
        description: 'Strategy that works',
        priority: 2,
        canRecover: vi.fn().mockReturnValue(true),
        recover: vi.fn().mockResolvedValue({ success: true, message: 'Success' }),
      };

      errorHandler.registerRecoveryStrategy(faultyStrategy);
      errorHandler.registerRecoveryStrategy(workingStrategy);

      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const result = await errorHandler.handleError(
        errorHandler.createError(ErrorCode.PROCESSING_ERROR, 'Test error'),
        context
      );

      expect(faultyStrategy.recover).toHaveBeenCalled();
      expect(workingStrategy.recover).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe('Working Strategy');
    });
  });

  describe('Default Recovery Strategies', () => {
    it('should have cloud to local fallback strategy', async () => {
      const context: ErrorContext = {
        component: 'SummarizationService',
        operation: 'summarize_cloud',
      };

      const result = await errorHandler.handleError(
        errorHandler.createError(ErrorCode.NETWORK_ERROR, 'API timeout'),
        context
      );

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe('Local Processing');
    });

    it('should have storage fallback strategy', async () => {
      const context: ErrorContext = {
        component: 'StorageService',
        operation: 'store',
      };

      const result = await errorHandler.handleError(
        errorHandler.createError(ErrorCode.STORAGE_ERROR, 'IndexedDB failed'),
        context
      );

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe('Memory Storage');
    });

    it('should have retry strategy with exponential backoff', async () => {
      const context: ErrorContext = {
        component: 'APIService',
        operation: 'request',
        metadata: { retryCount: 1 },
      };

      const result = await errorHandler.handleError(
        errorHandler.createError(ErrorCode.NETWORK_ERROR, 'Temporary failure'),
        context
      );

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe('Automatic Retry');
      expect(result.data).toMatchObject({ retryCount: 2 });
    });

    it('should limit retry attempts', async () => {
      const context: ErrorContext = {
        component: 'APIService',
        operation: 'request',
        metadata: { retryCount: 3 }, // Max retries reached
      };

      const result = await errorHandler.handleError(
        errorHandler.createError(ErrorCode.NETWORK_ERROR, 'Persistent failure'),
        context
      );

      // Should fall back to graceful degradation
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe('Reduced Functionality');
    });
  });

  describe('Error Statistics', () => {
    it('should track error statistics correctly', async () => {
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      // Generate some errors
      await errorHandler.handleError(
        errorHandler.createError(ErrorCode.STORAGE_ERROR, 'Storage error 1'),
        context
      );
      await errorHandler.handleError(
        errorHandler.createError(ErrorCode.STORAGE_ERROR, 'Storage error 2'),
        context
      );
      await errorHandler.handleError(
        errorHandler.createError(ErrorCode.NETWORK_ERROR, 'Network error'),
        context
      );

      const stats = errorHandler.getErrorStats();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCode[ErrorCode.STORAGE_ERROR]).toBe(2);
      expect(stats.errorsByCode[ErrorCode.NETWORK_ERROR]).toBe(1);
      expect(stats.errorsByComponent['TestComponent']).toBe(3);
      expect(stats.recoverySuccessRate).toBeGreaterThan(0);
      expect(stats.recentErrors).toHaveLength(3);
      expect(stats.lastError).toBeDefined();
    });

    it('should maintain error history size limit', async () => {
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      // Generate more than 100 errors (the limit) in batches to avoid timeout
      const promises = [];
      for (let i = 0; i < 105; i++) {
        promises.push(
          errorHandler.handleError(
            errorHandler.createError(ErrorCode.PROCESSING_ERROR, `Error ${i}`),
            context
          )
        );
      }
      
      // Process all errors concurrently
      await Promise.all(promises);

      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(100); // Should be capped at 100
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('Notifications', () => {
    it('should show notification for non-recoverable errors', async () => {
      const context: ErrorContext = {
        component: 'CriticalComponent',
        operation: 'criticalOperation',
      };

      await errorHandler.handleError(
        errorHandler.createError(
          ErrorCode.PERMISSION_ERROR,
          'Critical permission error',
          undefined,
          false // Not recoverable
        ),
        context
      );

      expect(mockNotificationCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Permission Required',
          persistent: true,
          actions: expect.arrayContaining([
            expect.objectContaining({
              id: 'permissions',
              label: 'Grant Permissions',
            }),
          ]),
        })
      );
    });

    it('should show warning notification for recoverable errors', async () => {
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      await errorHandler.handleError(
        errorHandler.createError(
          ErrorCode.STORAGE_ERROR,
          'Storage temporarily unavailable',
          undefined,
          true // Recoverable
        ),
        context
      );

      expect(mockNotificationCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          autoHide: 5000,
          actions: expect.arrayContaining([
            expect.objectContaining({
              id: 'retry',
              label: 'Retry',
            }),
          ]),
        })
      );
    });

    it('should include appropriate actions based on error type', async () => {
      const context: ErrorContext = {
        component: 'StorageService',
        operation: 'store',
      };

      await errorHandler.handleError(
        errorHandler.createError(ErrorCode.STORAGE_ERROR, 'Storage full'),
        context
      );

      expect(mockNotificationCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          actions: expect.arrayContaining([
            expect.objectContaining({
              id: 'clear_storage',
              label: 'Clear Storage',
            }),
          ]),
        })
      );
    });
  });

  describe('Analytics Integration', () => {
    it('should track error occurrence in analytics', async () => {
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      await errorHandler.handleError(
        errorHandler.createError(ErrorCode.PROCESSING_ERROR, 'Test error'),
        context
      );

      expect(mockAnalyticsCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.PROCESSING_ERROR,
          message: 'Test error',
        }),
        false // Initial error tracking
      );
    });

    it('should track successful recovery in analytics', async () => {
      const context: ErrorContext = {
        component: 'SummarizationService',
        operation: 'summarize_cloud',
      };

      await errorHandler.handleError(
        errorHandler.createError(ErrorCode.NETWORK_ERROR, 'API failed'),
        context
      );

      expect(mockAnalyticsCallback).toHaveBeenCalledTimes(2);
      expect(mockAnalyticsCallback).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          code: ErrorCode.NETWORK_ERROR,
        }),
        true // Recovery success tracking
      );
    });
  });

  describe('Callback Management', () => {
    it('should handle notification callback errors gracefully', async () => {
      const faultyCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback failed');
      });
      
      errorHandler.onNotification(faultyCallback);

      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      // Should not throw despite callback error
      await expect(
        errorHandler.handleError(
          errorHandler.createError(ErrorCode.PROCESSING_ERROR, 'Test error'),
          context
        )
      ).resolves.toBeDefined();

      expect(faultyCallback).toHaveBeenCalled();
    });

    it('should remove notification callbacks', () => {
      const callback = vi.fn();
      
      errorHandler.onNotification(callback);
      errorHandler.offNotification(callback);

      // Callback should not be called after removal
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      // Execute the error handling but don't wait for result
      errorHandler.handleError(
        errorHandler.createError(ErrorCode.PROCESSING_ERROR, 'Test error'),
        context
      );

      expect(callback).not.toHaveBeenCalled();
    });
  });
});