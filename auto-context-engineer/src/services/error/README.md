# Error Handling and Fallback System

This directory contains a comprehensive error handling and fallback system for the Auto Context Engineer extension.

## Components

### ErrorHandler (`errorHandler.ts`)
- Core error handling with automatic recovery strategies
- Extensible recovery strategy system with 6 built-in strategies
- Error categorization and normalization with 10 distinct error codes
- Analytics integration and comprehensive error statistics
- User notification system with actionable recovery options

### NotificationService (`notificationService.ts`)
- User-friendly error notifications with 4 types (error, warning, success, info)
- Configurable notification positioning and styling
- Action buttons for error resolution with async handling
- Auto-hide functionality and persistent notifications for critical errors

### Fallback Services
- **StorageFallback** (`fallback/storageFallback.ts`): Three-tier fallback system (IndexedDB → LocalStorage → Memory storage)
- **CloudFallback** (`fallback/cloudFallback.ts`): Automatic provider switching with local processing fallback

### ErrorIntegration (`errorIntegration.ts`)
- Unified integration service connecting all error handling components
- Enhanced recovery strategies for specific scenarios (quota, network, storage)
- Configuration management for all error handling features
- System health testing and diagnostics

## Usage

```typescript
import { handleError, createError } from './services/error/errorIntegration';
import { ErrorCode } from './types';

// Handle an error with automatic recovery
try {
  // Some operation that might fail
} catch (error) {
  const result = await handleError(error, {
    component: 'MyComponent',
    operation: 'myOperation',
  });
  
  if (result.success) {
    console.log('Error recovered:', result.message);
    console.log('Fallback used:', result.fallbackUsed);
  }
}

// Create a structured error
const error = createError(
  ErrorCode.STORAGE_ERROR,
  'Failed to save data',
  originalError,
  true, // recoverable
  { userId: 'user123' }
);
```

## Error Codes

The system supports 10 distinct error codes:

- `STORAGE_ERROR`: Issues with local storage (IndexedDB, LocalStorage)
- `NETWORK_ERROR`: Network connectivity and API communication issues
- `PROCESSING_ERROR`: General processing and computation errors
- `PERMISSION_ERROR`: Browser permission and authorization issues
- `PRIVACY_ERROR`: Privacy setting and consent issues
- `API_ERROR`: Cloud service API errors
- `QUOTA_EXCEEDED`: Storage or usage quota exceeded
- `INVALID_INPUT`: Invalid user input or data validation errors
- `TIMEOUT_ERROR`: Operation timeout errors
- `UNKNOWN_ERROR`: Unexpected or unclassified errors

## Recovery Strategies

The system includes 6 built-in recovery strategies:

1. **Cloud to Local Fallback**: Switches to local processing when cloud APIs fail
2. **Storage Fallback**: Uses alternative storage mechanisms (IndexedDB → LocalStorage → Memory)
3. **Automatic Retry**: Retries operations with exponential backoff (max 3 attempts)
4. **Enhanced Storage Fallback**: Intelligent storage adapter switching with health monitoring
5. **Enhanced Cloud Fallback**: Multi-provider cloud service fallback with local processing
6. **Quota Management**: Handles storage and API quota exceeded errors with cleanup
7. **Network Connectivity**: Manages network-related failures with offline mode
8. **Graceful Degradation**: Continues with reduced functionality when possible

## Configuration

```typescript
import { globalErrorIntegration } from './services/error/errorIntegration';

globalErrorIntegration.updateConfig({
  enableNotifications: true,
  enableAnalytics: true,
  enableFallbacks: true,
  notificationConfig: {
    position: 'top-right', // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
    autoHide: true,
    duration: 5000,
  },
});

// Set analytics callback for error tracking
globalErrorIntegration.setAnalyticsCallback((error, recovered) => {
  console.log('Error tracked:', error.code, 'Recovered:', recovered);
});
```

## System Health Testing

```typescript
import { globalErrorIntegration } from './services/error/errorIntegration';

// Test all fallback systems
const healthResults = await globalErrorIntegration.testFallbackSystems();
console.log('Storage fallback:', healthResults.storage);
console.log('Cloud fallback:', healthResults.cloud);
console.log('Notifications:', healthResults.notifications);

// Get comprehensive error statistics
const stats = globalErrorIntegration.getErrorStats();
console.log('Error handler stats:', stats.errorHandler);
console.log('Storage stats:', stats.storage);
console.log('Cloud provider stats:', stats.cloud);
```

## Testing

The system includes comprehensive tests for all components:
- Unit tests for error handling logic (21 tests)
- Integration tests for fallback mechanisms (32 tests for cloud, storage tests)
- Mock implementations for browser APIs (IndexedDB, LocalStorage, DOM)
- Error scenario simulation and recovery validation
- Cross-component integration testing

### Test Structure:
- `errorHandler.test.ts`: Core error handling functionality
- `notificationService.test.ts`: User notification system
- `storageFallback.test.ts`: Storage fallback mechanisms
- `cloudFallback.test.ts`: Cloud service fallback
- `errorIntegration.test.ts`: Integration service testing

Run tests with:
```bash
npm test src/services/error src/services/notification src/services/fallback
```

## Architecture

The error handling system follows a layered architecture:

1. **Core Layer**: `ErrorHandler` with recovery strategies
2. **Service Layer**: `NotificationService` for user feedback
3. **Fallback Layer**: Storage and cloud fallback services
4. **Integration Layer**: `ErrorIntegrationService` orchestrating all components
5. **Global Layer**: Convenience functions and global instances

This design ensures separation of concerns while providing a unified interface for error handling throughout the application.