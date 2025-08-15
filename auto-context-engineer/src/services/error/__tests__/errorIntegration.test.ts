// Tests for error integration service
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorIntegrationService, globalErrorIntegration, handleError, createError } from '../errorIntegration';
import { globalErrorHandler, RecoveryStrategy } from '../errorHandler';
import { ErrorCode, ExtensionError } from '../../../types';

// Mock the fallback services
vi.mock('../../fallback/storageFallback', () => ({
  globalStorageFallback: {
    store: vi.fn(),
    retrieve: vi.fn(),
  }
}));

vi.mock('../../fallback/cloudFallback', () => ({
  globalCloudFallback: {
    summarize: vi.fn(),
  }
}));

vi.mock('../../notification/notificationService', () => ({
  globalNotificationService: {
    show: vi.fn(),
    updateConfig: vi.fn(),
    clearAll: vi.fn(),
  }
}));

// Import the mocked services
import { globalStorageFallback } from '../../fallback/storageFallback';
import { globalCloudFallback } from '../../fallback/cloudFallback';
import { globalNotificationService } from '../../notification/notificationService';

// Mock the global services
vi.mock('../errorHandler', () => ({
  globalErrorHandler: {
    handleError: vi.fn(),
    createError: vi.fn(),
    onNotification: vi.fn(),
    setAnalyticsCallback: vi.fn(),
    getErrorStats: vi.fn().mockReturnValue({
      totalErrors: 5,
      errorsByCode: {},
      errorsByComponent: {},
      recoverySuccessRate: 80,
    }),
    clearHistory: vi.fn(),
    registerRecoveryStrategy: vi.fn(),
  },
}));

vi.mock('../../notification/notificationService', () => ({
  globalNotificationService: {
    show: vi.fn(),
    updateConfig: vi.fn(),
    clear: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
    dismiss: vi.fn(),
  },
}));

vi.mock('../../fallback/storageFallback', () => ({
  globalStorageFallback: {
    store: vi.fn(),
    retrieve: vi.fn(),
    remove: vi.fn(),
    getStats: vi.fn().mockReturnValue({
      currentAdapter: 'IndexedDB',
      availableAdapters: ['IndexedDB', 'LocalStorage', 'Memory'],
      totalSize: 100,
    }),
  },
}));

vi.mock('../../fallback/cloudFallback', () => ({
  globalCloudFallback: {
    summarize: vi.fn().mockResolvedValue({
      summary: 'Test summary',
      method: 'local',
      tokens: 50,
    }),
    getBestProvider: vi.fn().mockReturnValue({
      id: 'local',
      name: 'Local Processing',
    }),
    getProviderStats: vi.fn().mockReturnValue([
      { id: 'local', name: 'Local Processing', available: true, healthy: true, priority: 10 },
    ]),
  },
}));

describe('ErrorIntegrationService', () => {
  let service: ErrorIntegrationService;
  let mockAnalyticsCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ErrorIntegrationService();
    mockAnalyticsCallback = vi.fn();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const newService = new ErrorIntegrationService();
      expect(newService).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const config = {
        enableNotifications: false,
        enableAnalytics: false,
        enableFallbacks: false,
        notificationConfig: {
          position: 'bottom-left' as const,
          autoHide: false,
          duration: 10000,
        },
      };

      const newService = new ErrorIntegrationService(config);
      expect(newService).toBeDefined();
    });

    it('should register notification callback when enabled', () => {
      
      
      new ErrorIntegrationService({ enableNotifications: true });
      
      expect(globalErrorHandler.onNotification).toHaveBeenCalled();
    });

    it('should register enhanced fallback strategies when enabled', () => {
      
      
      new ErrorIntegrationService({ enableFallbacks: true });
      
      expect(globalErrorHandler.registerRecoveryStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'enhanced_storage_fallback',
          name: 'Enhanced Storage Fallback',
        })
      );
    });
  });

  describe('Analytics Integration', () => {
    it('should set analytics callback', () => {
      
      
      service.setAnalyticsCallback(mockAnalyticsCallback);
      
      expect(globalErrorHandler.setAnalyticsCallback).toHaveBeenCalledWith(mockAnalyticsCallback);
    });

    it('should not set analytics callback when disabled', () => {
      
      const serviceWithoutAnalytics = new ErrorIntegrationService({ enableAnalytics: false });
      
      serviceWithoutAnalytics.setAnalyticsCallback(mockAnalyticsCallback);
      
      // Should not call the global handler since analytics is disabled
      expect(globalErrorHandler.setAnalyticsCallback).not.toHaveBeenCalledWith(mockAnalyticsCallback);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors through global error handler', async () => {
      
      const mockError = new Error('Test error');
      const mockContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      vi.mocked(globalErrorHandler.handleError).mockResolvedValue({
        success: true,
        message: 'Handled successfully',
      });

      const result = await service.handleError(mockError, mockContext);

      expect(globalErrorHandler.handleError).toHaveBeenCalledWith(mockError, mockContext);
      expect(result.success).toBe(true);
    });

    it('should create errors through global error handler', () => {
      
      const mockError = {
        name: 'ExtensionError',
        code: ErrorCode.STORAGE_ERROR,
        message: 'Test error',
        timestamp: new Date(),
        recoverable: true,
      };

      vi.mocked(globalErrorHandler.createError).mockReturnValue(mockError);

      const result = service.createError(
        ErrorCode.STORAGE_ERROR,
        'Test error',
        new Error('Original'),
        true,
        { component: 'test' }
      );

      expect(globalErrorHandler.createError).toHaveBeenCalledWith(
        ErrorCode.STORAGE_ERROR,
        'Test error',
        expect.any(Error),
        true,
        { component: 'test' }
      );
      expect(result).toEqual(mockError);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      
      
      const newConfig = {
        enableNotifications: false,
        notificationConfig: {
          position: 'top-left' as const,
          duration: 8000,
        },
      };

      service.updateConfig(newConfig);

      expect(globalNotificationService.updateConfig).toHaveBeenCalledWith(newConfig.notificationConfig);
    });

    it('should not update notification config when not provided', () => {
      
      
      service.updateConfig({ enableAnalytics: false });

      expect(globalNotificationService.updateConfig).not.toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should get comprehensive error statistics', () => {
      const stats = service.getErrorStats();

      expect(stats).toMatchObject({
        errorHandler: expect.objectContaining({
          totalErrors: 5,
          recoverySuccessRate: 80,
        }),
        storage: expect.objectContaining({
          currentAdapter: 'IndexedDB',
          totalSize: 100,
        }),
        cloud: expect.arrayContaining([
          expect.objectContaining({
            id: 'local',
            name: 'Local Processing',
          }),
        ]),
      });
    });
  });

  describe('History Management', () => {
    it('should clear all error history', () => {
      
      
      
      service.clearErrorHistory();

      expect(globalErrorHandler.clearHistory).toHaveBeenCalled();
      expect(globalNotificationService.clear).toHaveBeenCalled();
    });
  });

  describe('Fallback System Testing', () => {
    it('should test all fallback systems successfully', async () => {
      
      
      

      vi.mocked(globalStorageFallback.retrieve).mockResolvedValue('test');
      vi.mocked(globalNotificationService.getAll).mockReturnValue([{
        id: 'test',
        type: 'error',
        title: 'Test',
        message: 'Test message',
        dismissible: true
      }]);

      const results = await service.testFallbackSystems();

      expect(results).toEqual({
        storage: true,
        cloud: true,
        notifications: true,
      });

      expect(globalStorageFallback.store).toHaveBeenCalledWith('__test__', 'test');
      expect(globalStorageFallback.retrieve).toHaveBeenCalledWith('__test__');
      expect(globalStorageFallback.remove).toHaveBeenCalledWith('__test__');
      expect(globalCloudFallback.summarize).toHaveBeenCalledWith('Test text for fallback system.');
    });

    it('should handle storage fallback test failure', async () => {
      
      
      vi.mocked(globalStorageFallback.store).mockRejectedValue(new Error('Storage failed'));

      const results = await service.testFallbackSystems();

      expect(results.storage).toBe(false);
    });

    it('should handle cloud fallback test failure', async () => {
      
      
      vi.mocked(globalCloudFallback.summarize).mockRejectedValue(new Error('Cloud failed'));

      const results = await service.testFallbackSystems();

      expect(results.cloud).toBe(false);
    });

    it('should handle notification test failure', async () => {
      // Make the existing mock throw an error
      vi.mocked(globalNotificationService.show).mockImplementation(() => {
        throw new Error('Notification failed');
      });

      const results = await service.testFallbackSystems();

      expect(results.notifications).toBe(false);
      
      // Reset the mock for other tests
      vi.mocked(globalNotificationService.show).mockReset();
    });
  });

  describe('Enhanced Recovery Strategies', () => {
    it('should register enhanced storage fallback strategy', () => {
      new ErrorIntegrationService({ enableFallbacks: true });

      const storageStrategy = vi.mocked(globalErrorHandler.registerRecoveryStrategy).mock.calls.find(
        (call: [{ id: string }]) => call[0].id === 'enhanced_storage_fallback'
      );

      expect(storageStrategy).toBeDefined();
      expect(storageStrategy).toBeDefined();
      expect(storageStrategy![0]).toMatchObject({
        id: 'enhanced_storage_fallback',
        name: 'Enhanced Storage Fallback',
        priority: 1,
      });
    });

    it('should register enhanced cloud fallback strategy', () => {
      
      
      new ErrorIntegrationService({ enableFallbacks: true });

      const cloudStrategy = vi.mocked(globalErrorHandler.registerRecoveryStrategy).mock.calls.find(
        (call: [{ id: string }]) => call[0].id === 'enhanced_cloud_fallback'
      );

      expect(cloudStrategy).toBeDefined();
      expect(cloudStrategy).toBeDefined();
      expect(cloudStrategy![0]).toMatchObject({
        id: 'enhanced_cloud_fallback',
        name: 'Enhanced Cloud Fallback',
        priority: 1,
      });
    });

    it('should register quota management strategy', () => {
      
      
      new ErrorIntegrationService({ enableFallbacks: true });

      const quotaStrategy = vi.mocked(globalErrorHandler.registerRecoveryStrategy).mock.calls.find(
        (call: [{ id: string }]) => call[0].id === 'quota_management'
      );

      expect(quotaStrategy).toBeDefined();
      expect(quotaStrategy).toBeDefined();
      expect(quotaStrategy![0]).toMatchObject({
        id: 'quota_management',
        name: 'Quota Management',
        priority: 2,
      });
    });

    it('should register network connectivity strategy', () => {
      
      
      new ErrorIntegrationService({ enableFallbacks: true });

      const networkStrategy = vi.mocked(globalErrorHandler.registerRecoveryStrategy).mock.calls.find(
        (call: [{ id: string }]) => call[0].id === 'network_connectivity'
      );

      expect(networkStrategy).toBeDefined();
      expect(networkStrategy).toBeDefined();
      expect(networkStrategy![0]).toMatchObject({
        id: 'network_connectivity',
        name: 'Network Connectivity',
        priority: 3,
      });
    });
  });

  describe('Recovery Strategy Logic', () => {
    let strategies: RecoveryStrategy[];

    beforeEach(() => {

      new ErrorIntegrationService({ enableFallbacks: true });
      strategies = vi.mocked(globalErrorHandler.registerRecoveryStrategy).mock.calls.map((call: [RecoveryStrategy]) => call[0]);
    });

    it('should handle storage errors with enhanced fallback', async () => {
      const storageStrategy = strategies.find((s: any) => s.id === 'enhanced_storage_fallback');

      expect(storageStrategy).toBeDefined();
      if (!storageStrategy) return;

      const mockError = new ExtensionError('Storage error', ErrorCode.STORAGE_ERROR, {}, true);
      const mockContext = { component: 'StorageService', operation: 'store' };

      expect(storageStrategy.canRecover(mockError, mockContext)).toBe(true);

      const result = await storageStrategy.recover(mockError, mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain('IndexedDB');
    });

    it('should handle cloud errors with enhanced fallback', async () => {
      const cloudStrategy = strategies.find((s: any) => s.id === 'enhanced_cloud_fallback');

      expect(cloudStrategy).toBeDefined();
      if (!cloudStrategy) return;

      const mockError = new ExtensionError('Network error', ErrorCode.NETWORK_ERROR, {}, true);
      const mockContext = { component: 'CloudService', operation: 'summarize_cloud' };

      expect(cloudStrategy.canRecover(mockError, mockContext)).toBe(true);

      const result = await cloudStrategy.recover(mockError, mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Local Processing');
    });

    it('should handle quota exceeded errors', async () => {
      const quotaStrategy = strategies.find((s: any) => s.id === 'quota_management');

      expect(quotaStrategy).toBeDefined();
      if (!quotaStrategy) return;

      const mockError = new ExtensionError('Quota exceeded', ErrorCode.QUOTA_EXCEEDED, {}, true);
      const mockContext = { component: 'StorageService', operation: 'store' };

      expect(quotaStrategy.canRecover(mockError, mockContext)).toBe(true);

      const result = await quotaStrategy.recover(mockError, mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Storage cleanup');
    });

    it('should handle network connectivity issues', async () => {
      const networkStrategy = strategies.find((s: any) => s.id === 'network_connectivity');

      expect(networkStrategy).toBeDefined();
      if (!networkStrategy) return;

      const mockError = new ExtensionError('Network error', ErrorCode.NETWORK_ERROR, {}, true);
      const mockContext = { component: 'CloudService', operation: 'cloud_summarize' };

      expect(networkStrategy.canRecover(mockError, mockContext)).toBe(true);

      const result = await networkStrategy.recover(mockError, mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain('offline mode');
    });

    it('should limit network retries', async () => {
      const networkStrategy = strategies.find((s: any) => s.id === 'network_connectivity');

      expect(networkStrategy).toBeDefined();
      if (!networkStrategy) return;

      const mockError = new ExtensionError('Network error', ErrorCode.NETWORK_ERROR, {}, true);
      const mockContext = {
        component: 'APIService',
        operation: 'request',
        metadata: { retryCount: 2 } // Max retries reached
      };

      const result = await networkStrategy.recover(mockError, mockContext);
      expect(result.success).toBe(false);
      expect(result.message).toContain('could not be restored');
    });
  });

  describe('Global Instance', () => {
    it('should provide global error integration instance', () => {
      expect(globalErrorIntegration).toBeInstanceOf(ErrorIntegrationService);
    });

    it('should provide convenience functions', async () => {
      
      

      const mockError = new Error('Test');
      const mockContext = { component: 'Test', operation: 'test' };

      await handleError(mockError, mockContext);
      expect(globalErrorHandler.handleError).toHaveBeenCalledWith(mockError, mockContext);

      createError(ErrorCode.PROCESSING_ERROR, 'Test error');
      expect(globalErrorHandler.createError).toHaveBeenCalledWith(
        ErrorCode.PROCESSING_ERROR,
        'Test error',
        undefined,
        true,
        undefined
      );
    });
  });
});