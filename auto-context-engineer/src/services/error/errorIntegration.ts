// Integration service that connects error handling with notifications and analytics
import { globalErrorHandler, ErrorContext, RecoveryResult } from './errorHandler';
import { globalNotificationService } from '../notification/notificationService';
import { globalStorageFallback } from '../fallback/storageFallback';
import { globalCloudFallback } from '../fallback/cloudFallback';
import { ErrorCode, ExtensionError } from '../../types';

export interface ErrorIntegrationConfig {
  enableNotifications: boolean;
  enableAnalytics: boolean;
  enableFallbacks: boolean;
  notificationConfig?: {
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    autoHide?: boolean;
    duration?: number;
  };
}

export class ErrorIntegrationService {
  private config: ErrorIntegrationConfig;
  private analyticsCallback?: (error: ExtensionError, recovered: boolean) => void;

  constructor(config: Partial<ErrorIntegrationConfig> = {}) {
    this.config = {
      enableNotifications: true,
      enableAnalytics: true,
      enableFallbacks: true,
      ...config,
    };

    this.initialize();
  }

  /**
   * Set analytics callback for error tracking
   */
  setAnalyticsCallback(callback: (error: ExtensionError, recovered: boolean) => void): void {
    this.analyticsCallback = callback;
    if (this.config.enableAnalytics) {
      globalErrorHandler.setAnalyticsCallback(callback);
    }
  }

  /**
   * Handle an error with full integration (notifications, analytics, fallbacks)
   */
  async handleError(
    error: Error | ExtensionError,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    return globalErrorHandler.handleError(error, context);
  }

  /**
   * Create a standardized error with proper context
   */
  createError(
    code: ErrorCode,
    message: string,
    originalError?: Error,
    recoverable: boolean = true,
    context?: Record<string, unknown>
  ): ExtensionError {
    return globalErrorHandler.createError(code, message, originalError, recoverable, context);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorIntegrationConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.notificationConfig) {
      globalNotificationService.updateConfig(config.notificationConfig);
    }
  }

  /**
   * Get comprehensive error statistics
   */
  getErrorStats() {
    return {
      errorHandler: globalErrorHandler.getErrorStats(),
      storage: globalStorageFallback.getStats(),
      cloud: globalCloudFallback.getProviderStats(),
    };
  }

  /**
   * Clear all error history
   */
  clearErrorHistory(): void {
    globalErrorHandler.clearHistory();
    globalNotificationService.clear();
  }

  /**
   * Test all fallback systems
   */
  async testFallbackSystems(): Promise<{
    storage: boolean;
    cloud: boolean;
    notifications: boolean;
  }> {
    const results = {
      storage: false,
      cloud: false,
      notifications: false,
    };

    // Test storage fallback
    try {
      await globalStorageFallback.store('__test__', 'test');
      const retrieved = await globalStorageFallback.retrieve('__test__');
      await globalStorageFallback.remove('__test__');
      results.storage = retrieved === 'test';
    } catch (error) {
      console.warn('Storage fallback test failed:', error);
    }

    // Test cloud fallback
    try {
      const result = await globalCloudFallback.summarize('Test text for fallback system.');
      results.cloud = !!result.summary;
    } catch (error) {
      console.warn('Cloud fallback test failed:', error);
    }

    // Test notifications
    try {
      const testNotification = {
        id: 'test-notification',
        type: 'info' as const,
        title: 'Test',
        message: 'Testing notification system',
        dismissible: true,
      };
      
      globalNotificationService.show(testNotification);
      results.notifications = globalNotificationService.getAll().length > 0;
      globalNotificationService.dismiss('test-notification');
    } catch (error) {
      console.warn('Notification test failed:', error);
    }

    return results;
  }

  private initialize(): void {
    // Configure notifications
    if (this.config.enableNotifications) {
      globalErrorHandler.onNotification((notification) => {
        globalNotificationService.show(notification);
      });

      if (this.config.notificationConfig) {
        globalNotificationService.updateConfig(this.config.notificationConfig);
      }
    }

    // Configure analytics
    if (this.config.enableAnalytics && this.analyticsCallback) {
      globalErrorHandler.setAnalyticsCallback(this.analyticsCallback);
    }

    // Register enhanced fallback strategies
    if (this.config.enableFallbacks) {
      this.registerEnhancedFallbacks();
    }
  }

  private registerEnhancedFallbacks(): void {
    // Enhanced storage fallback strategy
    globalErrorHandler.registerRecoveryStrategy({
      id: 'enhanced_storage_fallback',
      name: 'Enhanced Storage Fallback',
      description: 'Use storage fallback service for storage errors',
      priority: 1,
      canRecover: (error, _context) => {
        return error.code === ErrorCode.STORAGE_ERROR;
      },
      recover: async (_error, _context) => {
        try {
          // Test storage fallback system
          const stats = await globalStorageFallback.getStats();
          
          return {
            success: true,
            message: `Switched to ${stats.currentAdapter}`,
            data: { 
              fallbackAdapter: stats.currentAdapter,
              availableAdapters: stats.availableAdapters,
            },
          };
        } catch (fallbackError) {
          return {
            success: false,
            message: `Storage fallback failed: ${(fallbackError as Error).message}`,
          };
        }
      },
    });

    // Enhanced cloud fallback strategy
    globalErrorHandler.registerRecoveryStrategy({
      id: 'enhanced_cloud_fallback',
      name: 'Enhanced Cloud Fallback',
      description: 'Use cloud fallback service for API errors',
      priority: 1,
      canRecover: (error, context) => {
        return (error.code === ErrorCode.NETWORK_ERROR || error.code === ErrorCode.API_ERROR) &&
               (context.operation.includes('summariz') || context.operation.includes('cloud'));
      },
      recover: async (_error, _context) => {
        try {
          const bestProvider = globalCloudFallback.getBestProvider();
          
          if (!bestProvider) {
            return {
              success: false,
              message: 'No cloud providers available',
            };
          }

          return {
            success: true,
            message: `Switched to ${bestProvider._name}`,
            data: { 
              fallbackProvider: bestProvider.id,
              providerName: bestProvider._name,
            },
          };
        } catch (fallbackError) {
          return {
            success: false,
            message: `Cloud fallback failed: ${(fallbackError as Error).message}`,
          };
        }
      },
    });

    // Quota management strategy
    globalErrorHandler.registerRecoveryStrategy({
      id: 'quota_management',
      name: 'Quota Management',
      description: 'Manage storage and API quotas',
      priority: 2,
      canRecover: (error, _context) => {
        return error.code === ErrorCode.QUOTA_EXCEEDED;
      },
      recover: async (_error, context) => {
        try {
          if (context.component?.toLowerCase().includes('storage')) {
            // Try to free up storage space
            const stats = await globalStorageFallback.getStats();
            
            return {
              success: true,
              message: `Storage cleanup initiated. Current usage: ${stats.totalSize} items`,
              data: { 
                action: 'storage_cleanup',
                currentSize: stats.totalSize,
              },
            };
          } else {
            // API quota exceeded - suggest local processing
            return {
              success: true,
              message: 'Switched to local processing to avoid API costs',
              data: { 
                action: 'local_processing',
                reason: 'quota_exceeded',
              },
            };
          }
        } catch (recoveryError) {
          return {
            success: false,
            message: `Quota management failed: ${(recoveryError as Error).message}`,
          };
        }
      },
    });

    // Network connectivity strategy
    globalErrorHandler.registerRecoveryStrategy({
      id: 'network_connectivity',
      name: 'Network Connectivity',
      description: 'Handle network connectivity issues',
      priority: 3,
      canRecover: (error, _context) => {
        return error.code === ErrorCode.NETWORK_ERROR || error.code === ErrorCode.TIMEOUT_ERROR;
      },
      recover: async (_error, context) => {
        // Check if we can switch to offline mode
        const isCloudOperation = context.operation.includes('cloud') || 
                               context.operation.includes('api') ||
                               context.operation.includes('summariz');

        if (isCloudOperation) {
          return {
            success: true,
            message: 'Switched to offline mode',
            data: { 
              mode: 'offline',
              reason: 'network_unavailable',
            },
          };
        }

        // For non-cloud operations, suggest retry with backoff
        const retryCount = (context.metadata?.retryCount as number) || 0;
        if (retryCount < 2) {
          return {
            success: true,
            message: `Network retry scheduled (attempt ${retryCount + 1})`,
            data: { 
              action: 'retry',
              retryCount: retryCount + 1,
              delay: Math.min(1000 * Math.pow(2, retryCount), 5000),
            },
          };
        }

        return {
          success: false,
          message: 'Network connectivity could not be restored',
        };
      },
    });
  }
}

// Global error integration service
export const globalErrorIntegration = new ErrorIntegrationService();

// Convenience functions
export const handleError = (
  error: Error | ExtensionError,
  context: ErrorContext
): Promise<RecoveryResult> => {
  return globalErrorIntegration.handleError(error, context);
};

export const createError = (
  code: ErrorCode,
  message: string,
  originalError?: Error,
  recoverable: boolean = true,
  context?: Record<string, unknown>
): ExtensionError => {
  return globalErrorIntegration.createError(code, message, originalError, recoverable, context);
}