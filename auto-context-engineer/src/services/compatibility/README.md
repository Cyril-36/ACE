# Cross-Browser Compatibility Service

This service provides comprehensive cross-browser compatibility for the Auto Context Engineer extension, ensuring it works seamlessly across Chrome, Firefox, Edge, Safari, and other browsers.

## Overview

The cross-browser compatibility system consists of several key components:

1. **Browser Detection** - Identifies the current browser and its capabilities
2. **Cross-Browser API** - Provides unified APIs that work across different browsers
3. **Polyfills** - Fills in missing browser features with JavaScript implementations
4. **Manifest Generator** - Creates browser-specific manifest files
5. **Compatibility Integration** - Orchestrates all compatibility features

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Compatibility Integration                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Browser   │  │Cross-Browser│  │     Polyfills       │  │
│  │  Detection  │  │     API     │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                 Manifest Generator                          │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Browser Detection (`browserDetection.ts`)

Detects the current browser and its capabilities:

```typescript
import { browserDetection, BrowserType } from './utils/browserDetection';

const browserInfo = browserDetection.detectBrowser();
console.log(browserInfo.type); // BrowserType.CHROME, FIREFOX, etc.
console.log(browserInfo.supportsManifestV3); // boolean
```

**Features:**
- Detects Chrome, Firefox, Edge, Safari, Opera
- Identifies browser version and capabilities
- Provides storage limits and CSP requirements
- Checks for Manifest V3 support

### Cross-Browser API (`crossBrowserAPI.ts`)

Provides unified APIs that work across browsers:

```typescript
import { crossBrowserAPI } from './services/compatibility/crossBrowserAPI';

// Storage API (works in all browsers)
await crossBrowserAPI.storage.set({ key: 'value' });
const data = await crossBrowserAPI.storage.get('key');

// Tabs API (works in all browsers)
const tabs = await crossBrowserAPI.tabs.query({ active: true });

// Runtime API (works in all browsers)
crossBrowserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle messages
});
```

**Features:**
- Unified storage, tabs, and runtime APIs
- Automatic promisification of callback-based APIs
- Browser-specific error handling
- Permission request handling

### Polyfills (`polyfills.ts`)

Provides JavaScript implementations for missing browser features:

```typescript
import { browserPolyfills } from './services/compatibility/polyfills';

// Initialize all polyfills
browserPolyfills.initializePolyfills();

// Get browser-specific CSS prefixes
const prefixes = browserPolyfills.getCSSPrefixes();
console.log(prefixes.transform); // 'transform' or '-webkit-transform'
```

**Polyfilled Features:**
- `Promise.withResolvers()` - For older browsers
- `structuredClone()` - For deep object cloning
- `requestIdleCallback()` - For Safari
- `ResizeObserver` - For older browsers
- `IntersectionObserver` - For older browsers
- `AbortController` - For older browsers
- Custom Elements - Basic support

### Manifest Generator (`manifestGenerator.ts`)

Generates browser-specific manifest files:

```typescript
import { manifestGenerator } from './services/compatibility/manifestGenerator';

const config = manifestGenerator.generateDefaultConfig();
const manifest = manifestGenerator.generateManifest(config);

// Validate the manifest
const validation = manifestGenerator.validateManifest(manifest);
if (!validation.valid) {
  console.error('Manifest errors:', validation.errors);
}
```

**Features:**
- Generates Manifest V2 and V3 versions
- Browser-specific permission filtering
- CSP policy generation
- Validation and error checking

### Compatibility Integration (`compatibilityIntegration.ts`)

Main service that orchestrates all compatibility features:

```typescript
import { compatibilityIntegration } from './services/compatibility/compatibilityIntegration';

// Initialize compatibility
await compatibilityIntegration.initialize();

// Get unified API
const api = compatibilityIntegration.getAPI();

// Execute with error handling
const result = await compatibilityIntegration.executeWithErrorHandling(
  async () => {
    // Your operation here
    return await someAsyncOperation();
  },
  'operation-context'
);
```

## Browser Support

### Chrome (Manifest V3)
- ✅ Full feature support
- ✅ Service Worker background
- ✅ Scripting API
- ✅ Unlimited storage
- ✅ Offscreen documents

### Firefox (Manifest V2/V3)
- ✅ Core features supported
- ⚠️ Limited Manifest V3 support
- ❌ No offscreen documents
- ❌ No unlimited storage
- ✅ Background pages/event pages

### Edge (Manifest V3)
- ✅ Full feature support (Chromium-based)
- ✅ Service Worker background
- ✅ Scripting API
- ✅ Unlimited storage

### Safari (Manifest V2)
- ⚠️ Limited extension support
- ❌ No Manifest V3
- ❌ No service workers
- ❌ Limited permissions
- ✅ Basic storage and tabs

### Opera (Manifest V3)
- ✅ Full feature support (Chromium-based)
- ✅ Service Worker background
- ✅ Scripting API

## Usage Examples

### Basic Setup

```typescript
// In your background script
import { initializeCompatibility } from './services/compatibility/compatibilityIntegration';

// Initialize compatibility on extension startup
await initializeCompatibility({
  enablePolyfills: true,
  enableErrorReporting: true,
  enablePerformanceMonitoring: true,
  storageStrategy: 'auto'
});
```

### Storage Operations

```typescript
import { getCompatibilityAPI } from './services/compatibility/compatibilityIntegration';

const api = getCompatibilityAPI();

// Store data (works across all browsers)
await api.storage.set({
  userPreferences: { theme: 'dark' },
  contextData: { lastUpdate: Date.now() }
});

// Retrieve data
const data = await api.storage.get(['userPreferences', 'contextData']);
```

### Tab Management

```typescript
const api = getCompatibilityAPI();

// Get active tab
const [activeTab] = await api.tabs.query({ active: true, currentWindow: true });

// Send message to tab
await api.tabs.sendMessage(activeTab.id, {
  type: 'CAPTURE_CONTEXT',
  data: { timestamp: Date.now() }
});
```

### Feature Detection

```typescript
import { crossBrowserCompatibility } from './services/compatibility/crossBrowserCompatibility';

// Check if a feature is supported
if (crossBrowserCompatibility.isFeatureSupported('supportsServiceWorker')) {
  // Use service worker features
} else {
  // Use fallback approach
}

// Get browser-specific configuration
const config = crossBrowserCompatibility.getConfig();
console.log('Storage strategy:', config.storageStrategy);
console.log('Background type:', config.backgroundType);
```

### Error Handling

```typescript
import { executeWithCompatibility } from './services/compatibility/compatibilityIntegration';

// Execute with automatic error handling
const result = await executeWithCompatibility(
  async () => {
    // Your risky operation
    return await api.tabs.executeScript(tabId, { code: 'document.title' });
  },
  'script-execution'
);

if (result) {
  console.log('Script executed successfully:', result);
} else {
  console.log('Script execution failed, but error was handled');
}
```

## Configuration

### Environment Variables

```typescript
// Configure compatibility features
const config = {
  enablePolyfills: true,           // Enable JavaScript polyfills
  enableErrorReporting: true,      // Enable cross-browser error reporting
  enablePerformanceMonitoring: false, // Enable performance tracking
  storageStrategy: 'auto'          // 'auto', 'extension', 'indexeddb', 'localstorage'
};
```

### Browser-Specific Settings

```typescript
// Get browser-specific limits
const limits = crossBrowserCompatibility.getStorageLimits();
console.log('Extension storage limit:', limits.extensionStorage);
console.log('IndexedDB limit:', limits.indexedDB);

// Get CSS prefixes for styling
const prefixes = crossBrowserCompatibility.getCSSPrefixes();
const transformStyle = `${prefixes.transform}: translateX(100px)`;
```

## Testing

The compatibility system includes comprehensive tests:

```bash
# Run compatibility tests
npm test -- src/services/compatibility/__tests__/

# Run specific test file
npm test -- src/services/compatibility/__tests__/crossBrowserCompatibility.test.ts
```

## Build Process

Generate browser-specific manifests:

```bash
# Generate manifests for all browsers
npm run build:manifests

# This creates:
# - dist/manifests/manifest-chrome.json
# - dist/manifests/manifest-firefox.json
# - dist/manifests/manifest-edge.json
# - dist/manifests/manifest-safari.json
```

## Best Practices

1. **Always initialize compatibility first** in your background script
2. **Use the unified APIs** instead of direct browser APIs
3. **Check feature support** before using advanced features
4. **Handle errors gracefully** with the provided error handling
5. **Test across multiple browsers** during development
6. **Use browser-specific manifests** for distribution

## Troubleshooting

### Common Issues

1. **Storage API not working**
   - Check if extension has storage permission
   - Verify browser supports the storage API
   - Use fallback storage strategies

2. **Script injection failing**
   - Ensure activeTab or tabs permission
   - Check if target page allows script injection
   - Use appropriate injection method for browser

3. **Manifest validation errors**
   - Use the manifest validator
   - Check browser-specific requirements
   - Ensure all required fields are present

### Debug Mode

Enable debug logging:

```typescript
// Enable detailed logging
localStorage.setItem('compatibility-debug', 'true');

// Check browser info
console.log('Browser info:', crossBrowserCompatibility.getBrowserInfo());
console.log('Features:', crossBrowserCompatibility.getFeatures());
console.log('Config:', crossBrowserCompatibility.getConfig());
```

## Contributing

When adding new compatibility features:

1. Update browser detection if needed
2. Add polyfills for missing features
3. Update the cross-browser API
4. Add comprehensive tests
5. Update documentation

## License

This compatibility system is part of the Auto Context Engineer extension and follows the same license terms.