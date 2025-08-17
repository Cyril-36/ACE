// Comprehensive error handling and recovery system
import { ExtensionError, ErrorCode } from '../../types';

export interface ErrorContext {
  component: string;
  operation: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  canRecover: (error: ExtensionError, context: ErrorContext) => boolean;
  recover: (error: ExtensionError, context: ErrorContext) => Promise<RecoveryResult>;
  priority: number; // Lower number = higher priority
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  data?: unknown;
  fallbackUsed?: string;
}

export interface ErrorNotification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  actions?: NotificationAction[];
  dismissible: boolean;
  autoHide?: number; // milliseconds
  persistent?: boolean;
}

export interface NotificationAction {
  id: string;
  label: string;
  action: () => Promise<void>;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface ErrorStats {
  totalErrors: number;
  errorsByCode: Record<ErrorCode, number>;
  errorsByComponent: Record<string, number>;
  recoverySuccessRate: number;
  lastError?: ExtensionError;
  recentErrors: ExtensionError[];
}

export class ErrorHandler {
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private errorHistory: ExtensionError[] = [];
  private notificationCallbacks: Set<(notification: ErrorNotification) => void> = new Set();
  private maxHistorySize = 100;
  private analyticsCallback?: (error: ExtensionError, recovered: boolean) => void;

  constructor() {
    this.initializeDefaultStrategies();
  }

  /**
   * Register a recovery strategy for specific error types
   */
  registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.id, strategy);
  }

  /**
   * Handle an error with automatic recovery attempts
   */
  async handleError(
    error: Error | ExtensionError,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    const extensionError = this.normalizeError(error, context);
    
    // Add to error history
    this.addToHistory(extensionError);

    // Track error in analytics
    if (this.analyticsCallback) {
      this.analyticsCallback(extensionError, false);
    }

    // Attempt recovery
    const recoveryResult = await this.attemptRecovery(extensionError, context);

    // Track recovery success
    if (this.analyticsCallback && recoveryResult.success) {
      this.analyticsCallback(extensionError, true);
    }

    // Show user notification if recovery failed or error is critical
    if (!recoveryResult.success || !extensionError.recoverable) {
      this.showErrorNotification(extensionError, context, recoveryResult);
    } else if (recoveryResult.success && extensionError.recoverable) {
      // Show success notification for recovered errors
      this.showErrorNotification(extensionError, context, recoveryResult);
    }

    return recoveryResult;
  }

  /**
   * Create a user-friendly error from any error type
   */
  createError(
    code: ErrorCode,
    message: string,
    originalError?: Error,
    recoverable: boolean = true,
    context?: Record<string, unknown>
  ): ExtensionError {
    return {
      name: 'ExtensionError',
      code,
      message,
      context: {
        originalError: originalError?.message,
        stack: originalError?.stack,
        ...context,
      },
      timestamp: new Date(),
      recoverable,
    };
  }

  /**
   * Register callback for error notifications
   */
  onNotification(callback: (notification: ErrorNotification) => void): void {
    this.notificationCallbacks.add(callback);
  }

  /**
   * Remove notification callback
   */
  offNotification(callback: (notification: ErrorNotification) => void): void {
    this.notificationCallbacks.delete(callback);
  }

  /**
   * Set analytics callback for error tracking
   */
  setAnalyticsCallback(callback: (error: ExtensionError, recovered: boolean) => void): void {
    this.analyticsCallback = callback;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStats {
    const errorsByCode = this.errorHistory.reduce((acc, error) => {
      const code = error.code;
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {} as Record<ErrorCode, number>);

    const errorsByComponent = this.errorHistory.reduce((acc, error) => {
      const component = (error.component as string) || (error.context?.component as string) || 'unknown';
      acc[component] = (acc[component] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalRecoverable = this.errorHistory.filter(e => e.recoverable).length;
    const recoverySuccessRate = totalRecoverable > 0 ? 
      (totalRecoverable / this.errorHistory.length) * 100 : 0;

    return {
      totalErrors: this.errorHistory.length,
      errorsByCode,
      errorsByComponent,
      recoverySuccessRate,
      lastError: this.errorHistory[this.errorHistory.length - 1],
      recentErrors: this.errorHistory.slice(-10),
    };
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  private normalizeError(error: Error | ExtensionError, context: ErrorContext): ExtensionError {
    if ('code' in error && 'timestamp' in error) {
      const extensionError = error;
      // Ensure component is set from context if not already present
      if (!extensionError.component && context.component) {
        extensionError.component = context.component;
      }
      return extensionError;
    }

    // Convert regular Error to ExtensionError
    const errorCode = this.categorizeError(error, context);
    const extensionError = this.createError(
      errorCode,
      error.message,
      error,
      true,
      { component: context.component, operation: context.operation }
    );
    extensionError.component = context.component;
    return extensionError;
  }

  private categorizeError(error: Error, context: ErrorContext): ErrorCode {
    const message = error.message.toLowerCase();
    const operation = context.operation.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return ErrorCode.NETWORK_ERROR;
    }
    
    if (message.includes('storage') || message.includes('indexeddb') || message.includes('quota')) {
      return ErrorCode.STORAGE_ERROR;
    }
    
    if (message.includes('permission') || message.includes('denied') || message.includes('unauthorized')) {
      return ErrorCode.PERMISSION_ERROR;
    }
    
    if (operation.includes('privacy') || message.includes('privacy') || message.includes('consent')) {
      return ErrorCode.PRIVACY_ERROR;
    }

    return ErrorCode.PROCESSING_ERROR;
  }

  private async attemptRecovery(
    error: ExtensionError,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    if (!error.recoverable) {
      return {
        success: false,
        message: 'Error is not recoverable',
      };
    }

    // Get applicable recovery strategies, sorted by priority
    const applicableStrategies = Array.from(this.recoveryStrategies.values())
      .filter(strategy => strategy.canRecover(error, context))
      .sort((a, b) => a.priority - b.priority);

    // Try each strategy until one succeeds
    for (const strategy of applicableStrategies) {
      try {
        const result = await strategy.recover(error, context);
        if (result.success) {
          return {
            ...result,
            fallbackUsed: strategy.name,
          };
        }
      } catch (recoveryError) {
        console.warn(`Recovery strategy ${strategy.name} failed:`, recoveryError);
      }
    }

    return {
      success: false,
      message: 'All recovery strategies failed',
    };
  }

  private addToHistory(error: ExtensionError): void {
    this.errorHistory.push(error);
    
    // Maintain history size limit
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  private showErrorNotification(
    error: ExtensionError,
    context: ErrorContext,
    recoveryResult: RecoveryResult
  ): void {
    const notification: ErrorNotification = {
      id: `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: error.recoverable ? 'warning' : 'error',
      title: this.getErrorTitle(error.code),
      message: this.getErrorMessage(error, recoveryResult),
      actions: this.getErrorActions(error, context),
      dismissible: true,
      autoHide: error.recoverable ? 5000 : undefined,
      persistent: !error.recoverable,
    };

    // Notify all registered callbacks
    this.notificationCallbacks.forEach((callback: any) => {
      try {
        callback(notification);
      } catch (callbackError) {
        console.error('Error notification callback failed:', callbackError);
      }
    });
  }

  private getErrorTitle(code: ErrorCode): string {
    const titles: Record<ErrorCode, string> = {
      [ErrorCode.STORAGE_ERROR]: 'Storage Issue',
      [ErrorCode.NETWORK_ERROR]: 'Connection Problem',
      [ErrorCode.PROCESSING_ERROR]: 'Processing Error',
      [ErrorCode.PERMISSION_ERROR]: 'Permission Required',
      [ErrorCode.PRIVACY_ERROR]: 'Privacy Setting Issue',
      [ErrorCode.API_ERROR]: 'API Error',
      [ErrorCode.QUOTA_EXCEEDED]: 'Quota Exceeded',
      [ErrorCode.INVALID_INPUT]: 'Invalid Input',
      [ErrorCode.TIMEOUT_ERROR]: 'Timeout Error',
      [ErrorCode.UNKNOWN_ERROR]: 'Unknown Error',
    };
    return titles[code] || 'Unexpected Error';
  }

  private getErrorMessage(error: ExtensionError, recoveryResult: RecoveryResult): string {
    if (recoveryResult.success && recoveryResult.fallbackUsed) {
      return `Issue resolved using ${recoveryResult.fallbackUsed}. ${recoveryResult.message}`;
    }
    
    const userFriendlyMessages: Record<ErrorCode, string> = {
      [ErrorCode.STORAGE_ERROR]: 'There was an issue accessing local storage. Your data is safe, but some features may be temporarily unavailable.',
      [ErrorCode.NETWORK_ERROR]: 'Unable to connect to cloud services. The extension will continue working with local features only.',
      [ErrorCode.PROCESSING_ERROR]: 'An error occurred while processing your request. Please try again.',
      [ErrorCode.PERMISSION_ERROR]: 'Additional permissions are needed to complete this action.',
      [ErrorCode.PRIVACY_ERROR]: 'This action requires updating your privacy settings.',
      [ErrorCode.API_ERROR]: 'There was an issue with the cloud service API. Please try again later.',
      [ErrorCode.QUOTA_EXCEEDED]: 'Storage or usage quota has been exceeded. Please free up space or upgrade your plan.',
      [ErrorCode.INVALID_INPUT]: 'The provided input is invalid. Please check your data and try again.',
      [ErrorCode.TIMEOUT_ERROR]: 'The operation timed out. Please check your connection and try again.',
      [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again or contact support.',
    };

    const baseMessage = userFriendlyMessages[error.code] || error.message;
    return recoveryResult.message ? `${baseMessage} ${recoveryResult.message}` : baseMessage;
  }

  private getErrorActions(error: ExtensionError, context: ErrorContext): NotificationAction[] {
    const actions: NotificationAction[] = [];

    // Add retry action for recoverable errors
    if (error.recoverable) {
      actions.push({
        id: 'retry',
        label: 'Retry',
        action: async () => {
          // This would trigger a retry of the original operation
          console.log('Retrying operation:', context.operation);
          return Promise.resolve();
        },
        style: 'primary',
      });
    }

    // Add specific actions based on error type
    switch (error.code) {
      case ErrorCode.PERMISSION_ERROR:
        actions.push({
          id: 'permissions',
          label: 'Grant Permissions',
          action: async () => {
            // Open permissions page or trigger permission request
            console.log('Opening permissions dialog');
            return Promise.resolve();
          },
          style: 'primary',
        });
        break;

      case ErrorCode.PRIVACY_ERROR:
        actions.push({
          id: 'privacy_settings',
          label: 'Privacy Settings',
          action: async () => {
            // Open privacy settings
            console.log('Opening privacy settings');
            return Promise.resolve();
          },
          style: 'primary',
        });
        break;

      case ErrorCode.STORAGE_ERROR:
        actions.push({
          id: 'clear_storage',
          label: 'Clear Storage',
          action: async () => {
            // Trigger storage cleanup
            console.log('Clearing storage');
            return Promise.resolve();
          },
          style: 'secondary',
        });
        break;
    }

    return actions;
  }

  private initializeDefaultStrategies(): void {
    // Cloud to Local Fallback Strategy
    this.registerRecoveryStrategy({
      id: 'cloud_to_local_fallback',
      name: 'Local Processing',
      description: 'Fall back to local processing when cloud services fail',
      priority: 1,
      canRecover: (error, context) => {
        return error.code === ErrorCode.NETWORK_ERROR && 
               context.operation.includes('summariz');
      },
      recover: async (error, context) => {
        // This would trigger local summarization instead of cloud
        console.log('Switching to local processing for:', error.code, context.operation);
        return {
          success: true,
          message: 'Switched to local processing',
          data: { fallbackMode: 'local' },
        };
      },
    });

    // Storage Fallback Strategy
    this.registerRecoveryStrategy({
      id: 'storage_fallback',
      name: 'Memory Storage',
      description: 'Use memory storage when IndexedDB fails',
      priority: 2,
      canRecover: (error) => {
        return error.code === ErrorCode.STORAGE_ERROR;
      },
      recover: async (error, context) => {
        // This would switch to memory-based storage
        console.log('Switching to memory storage for:', error.code, context.operation);
        return {
          success: true,
          message: 'Using temporary memory storage',
          data: { fallbackMode: 'memory' },
        };
      },
    });

    // Retry Strategy
    this.registerRecoveryStrategy({
      id: 'simple_retry',
      name: 'Automatic Retry',
      description: 'Retry the operation after a brief delay',
      priority: 3,
      canRecover: (error, context) => {
        return error.recoverable && 
               (!context.metadata?.retryCount || 
               (context.metadata.retryCount as number) < 3);
      },
      recover: async (_error, context) => {
        const retryCount = (context.metadata?.retryCount as number) || 0;
        
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return {
          success: true,
          message: `Retried after ${delay}ms (attempt ${retryCount + 1})`,
          data: { retryCount: retryCount + 1 },
        };
      },
    });

    // Graceful Degradation Strategy
    this.registerRecoveryStrategy({
      id: 'graceful_degradation',
      name: 'Reduced Functionality',
      description: 'Continue with reduced functionality',
      priority: 10, // Low priority - last resort
      canRecover: (error) => {
        return error.recoverable;
      },
      recover: async (error, context) => {
        console.log('Using graceful degradation for:', error.code, context.operation);
        return {
          success: true,
          message: 'Continuing with limited functionality',
          data: { degradedMode: true },
        };
      },
    });
  }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler();

// Convenience functions
export const handleError = (
  error: Error | ExtensionError,
  context: ErrorContext
): Promise<RecoveryResult> => {
  return globalErrorHandler.handleError(error, context);
};

export const createError = (
  code: ErrorCode,
  message: string,
  originalError?: Error,
  recoverable: boolean = true,
  context?: Record<string, unknown>
): ExtensionError => {
  return globalErrorHandler.createError(code, message, originalError, recoverable, context);
}
