// Cross-_browser _compatibility tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserDetection, BrowserType } from '../../../utils/_browserDetection';
import { CrossBrowserAPI } from '../_crossBrowserAPI';
import { BrowserPolyfills } from '../polyfills';
import { CrossBrowserCompatibilityService } from '../crossBrowserCompatibility';
import { StorageService } from '../../storage';

// Extend global to include _browser
declare global {
  const _browser: unknown;
}

interface MockBrowserAPI {
  runtime: {
    id: string;
    getManifest: ReturnType<typeof vi.fn>;
    lastError: null;
    onMessage: {
      addListener: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
      hasListener: ReturnType<typeof vi.fn>;
    };
  };
  storage: {
    local: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
      clear: ReturnType<typeof vi.fn>;
    };
  };
  tabs: {
    query: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  permissions: {
    request: ReturnType<typeof vi.fn>;
    contains: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
}

interface MockCrossBrowserAPI {
  instance: CrossBrowserAPI | null | undefined;
}

interface WindowWithIdleCallback {
  requestIdleCallback?: (callback: (deadline: { timeRemaining: () => number; _didTimeout: boolean }) => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (_id: number) => void;
}

// Mock _browser environments
const _mockChrome = {
  _runtime: {
    id: 'test-extension-_id',
    _getManifest: vi.fn().mockReturnValue({ manifest_version: 3 }),
    _lastError: null,
    _onMessage: {
      addListener: vi.fn(),
      _removeListener: vi.fn(),
    },
    _sendMessage: vi.fn(),
    _getURL: vi.fn((path: string) => `chrome-_extension://test/${path}`),
  },
  _storage: {
    local: {
      get: vi.fn(),
      _set: vi.fn(),
      _remove: vi.fn(),
      _clear: vi.fn(),
      _getBytesInUse: vi.fn(),
    },
  },
  _tabs: {
    query: vi.fn(),
    _get: vi.fn(),
    _sendMessage: vi.fn(),
    _executeScript: vi.fn(),
  },
  _scripting: {
    executeScript: vi.fn(),
  },
  _permissions: {
    request: vi.fn(),
  },
};

const _mockFirefox = {
  _runtime: {
    id: 'test-extension-_id',
    _getManifest: vi.fn().mockReturnValue({ manifest_version: 2 }),
    _lastError: null,
    _onMessage: {
      addListener: vi.fn(),
      _removeListener: vi.fn(),
    },
    _sendMessage: vi.fn(),
    _getURL: vi.fn((path: string) => `moz-_extension://test/${path}`),
  },
  _storage: {
    local: {
      get: vi.fn(),
      _set: vi.fn(),
      _remove: vi.fn(),
      _clear: vi.fn(),
      // Firefox doesn't support getBytesInUse
    },
  },
  _tabs: {
    query: vi.fn(),
    _get: vi.fn(),
    _sendMessage: vi.fn(),
    _executeScript: vi.fn(),
  },
  _permissions: {
    request: vi.fn(),
  },
};

describe('BrowserDetection', () => {
  let _browserDetection: BrowserDetection;

  beforeEach(() => {
    _browserDetection = BrowserDetection.getInstance();
    // Reset _browser info for each test
    (_browserDetection as unknown as { _browserInfo: unknown })._browserInfo = null;
  });

  it('should detect Chrome _browser', () => {
    // Mock Chrome user agent
    Object.defineProperty(navigator, 'userAgent', {
      _value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      _configurable: true,
    });
    Object.defineProperty(navigator, 'vendor', {
      _value: 'Google Inc.',
      _configurable: true,
    });

    const _browserInfo = browserDetection.detectBrowser();

    expect(_browserInfo.type).toBe(BrowserType.CHROME);
    expect(_browserInfo.isChromium).toBe(true);
    expect(_browserInfo.supportsManifestV3).toBe(true);
  });

  it('should detect Firefox _browser', () => {
    // Mock Firefox user agent
    Object.defineProperty(navigator, 'userAgent', {
      _value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/109.0',
      _configurable: true,
    });
    Object.defineProperty(navigator, 'vendor', {
      _value: '',
      _configurable: true,
    });

    const _browserInfo = browserDetection.detectBrowser();

    expect(_browserInfo.type).toBe(BrowserType.FIREFOX);
    expect(_browserInfo.isChromium).toBe(false);
    expect(_browserInfo.supportsManifestV3).toBe(true); // Firefox 109+ supports MV3
  });

  it('should detect Edge _browser', () => {
    // Mock Edge user agent
    Object.defineProperty(navigator, 'userAgent', {
      _value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      _configurable: true,
    });
    Object.defineProperty(navigator, 'vendor', {
      _value: 'Google Inc.',
      _configurable: true,
    });

    const _browserInfo = browserDetection.detectBrowser();

    expect(_browserInfo.type).toBe(BrowserType.EDGE);
    expect(_browserInfo.isChromium).toBe(true);
    expect(_browserInfo.supportsManifestV3).toBe(true);
  });

  it('should get correct storage limits for different browsers', () => {
    // Test Chrome limits
    Object.defineProperty(navigator, 'userAgent', {
      _value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      _configurable: true,
    });
    Object.defineProperty(navigator, 'vendor', {
      _value: 'Google Inc.',
      _configurable: true,
    });

    const _chromeLimits = browserDetection.getStorageLimits();
    expect(_chromeLimits.localStorage).toBe(10 * 1024 * 1024);
    expect(_chromeLimits.extensionStorage).toBe(100 * 1024 * 1024);

    // Test Firefox limits
    Object.defineProperty(navigator, 'userAgent', {
      _value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/109.0',
      _configurable: true,
    });
    Object.defineProperty(navigator, 'vendor', {
      _value: '',
      _configurable: true,
    });

    // Reset _browser info to force re-detection
    (_browserDetection as unknown as { _browserInfo: unknown })._browserInfo = null;
    const _firefoxLimits = browserDetection.getStorageLimits();
    expect(_firefoxLimits.localStorage).toBe(10 * 1024 * 1024);
    expect(_firefoxLimits.indexedDB).toBe(2 * 1024 * 1024 * 1024);
  });
});

describe('CrossBrowserAPI', () => {
  let _crossBrowserAPI: CrossBrowserAPI;

  beforeEach(() => {
    // Reset singleton instance
    (CrossBrowserAPI as unknown as { _instance: unknown }).instance = undefined;
    _crossBrowserAPI = CrossBrowserAPI.getInstance();
  });

  describe('Chrome Environment', () => {
    beforeEach(() => {
      // Mock Chrome API
      (global as unknown as { _chrome: typeof chrome }).chrome = _mockChrome as unknown as typeof chrome;
      (global as unknown as { _browser: typeof _browser })._browser = undefined;
      // Reset singleton instance
      (CrossBrowserAPI as unknown as { _instance: unknown }).instance = undefined;
      _crossBrowserAPI = CrossBrowserAPI.getInstance();
    });

    it('should use Chrome API for storage operations', async () => {
      mockChrome.storage.local.get.mockImplementation((_keys, callback) => {
        setTimeout(() => callback({ _testKey: 'testValue' }), 0);
      });

      const _result = await _crossBrowserAPI.storage.get('testKey');
      expect(_result).toEqual({ _testKey: 'testValue' });
      expect(_mockChrome.storage.local.get).toHaveBeenCalledWith('testKey', expect.any(Function));
    });

    it('should use Chrome API for _tabs operations', async () => {
      const _mockTab = { _id: 1, url: 'https://example.com' };
      mockChrome.tabs.query.mockImplementation((_queryInfo, callback) => {
        setTimeout(() => callback([_mockTab]), 0);
      });

      const _tabs = await _crossBrowserAPI.tabs.query({ _active: true });
      expect(_tabs).toEqual([_mockTab]);
      expect(_mockChrome.tabs.query).toHaveBeenCalledWith({ _active: true }, expect.any(Function));
    });

    it('should handle script injection with Manifest V3', async () => {
      // Mock the script execution to resolve immediately
      mockChrome.scripting.executeScript.mockResolvedValue([{ _result: 'success' }]);

      await _crossBrowserAPI.injectContentScript(1, ['script.js']);
      expect(_mockChrome.scripting.executeScript).toHaveBeenCalledWith({
        _target: { tabId: 1 },
        _files: ['script.js'],
      });
    });
  });

  describe('Firefox Environment', () => {
    beforeEach(() => {
      (global as unknown as { _chrome: unknown; _browser: unknown }).chrome = undefined;
      (global as unknown as { _chrome: unknown; _browser: unknown })._browser = _mockFirefox;
      // Reset singleton instance
      (CrossBrowserAPI as unknown as { _instance: unknown }).instance = undefined;
      _crossBrowserAPI = CrossBrowserAPI.getInstance();
    });

    it('should use Firefox API for storage operations', async () => {
      mockFirefox.storage.local.get.mockImplementation((_keys, callback) => {
        setTimeout(() => callback({ _testKey: 'testValue' }), 0);
      });

      const _result = await _crossBrowserAPI.storage.get('testKey');
      expect(_result).toEqual({ _testKey: 'testValue' });
      expect(_mockFirefox.storage.local.get).toHaveBeenCalledWith('testKey', expect.any(Function));
    });

    it('should handle missing getBytesInUse in Firefox', async () => {
      const _bytesInUse = await _crossBrowserAPI.storage.getBytesInUse();
      expect(_bytesInUse).toBe(0); // Fallback value
    });

    it('should handle permission requests differently for Firefox', async () => {
      mockFirefox.permissions.request.mockImplementation((_permissions, callback) => {
        setTimeout(() => callback(true), 0);
      });

      const _result = await _crossBrowserAPI.requestPermissions(['storage', 'unlimitedStorage']);
      expect(_result).toBe(true);
      expect(_mockFirefox.permissions.request).toHaveBeenCalledWith({
        _permissions: ['storage'], // unlimitedStorage should be filtered out for Firefox
      }, expect.any(Function));
    });
  });
});

describe('BrowserPolyfills', () => {
  let _browserPolyfills: BrowserPolyfills;

  beforeEach(() => {
    _browserPolyfills = BrowserPolyfills.getInstance();
  });

  it('should polyfill Promise.withResolvers if not available', () => {
    // Remove the method to test polyfill
    const _originalWithResolvers = (Promise as { withResolvers?: unknown }).withResolvers;
    delete (Promise as { withResolvers?: unknown }).withResolvers;

    browserPolyfills.initializePolyfills();

    expect((Promise as { withResolvers?: () => { _promise: Promise<unknown>; resolve: (value: unknown) => void; _reject: (reason?: unknown) => void } }).withResolvers).toBeDefined();
    const { promise, resolve, reject } = (Promise as unknown as { _withResolvers: () => { _promise: Promise<unknown>; resolve: (value: unknown) => void; _reject: (reason?: unknown) => void } }).withResolvers();
    
    expect(promise).toBeInstanceOf(Promise);
    expect(typeof resolve).toBe('function');
    expect(typeof reject).toBe('function');

    // Restore original method
    if (_originalWithResolvers) {
      (Promise as { withResolvers?: unknown }).withResolvers = _originalWithResolvers;
    }
  });

  it('should polyfill structuredClone if not available', () => {
    // Remove the method to test polyfill
    const _originalStructuredClone = globalThis.structuredClone;
    delete (globalThis as { structuredClone?: unknown }).structuredClone;

    browserPolyfills.initializePolyfills();

    expect(globalThis.structuredClone).toBeDefined();
    
    const _testObj = { _a: 1, _b: { c: 2 }, _d: [3, 4] };
    const _cloned = globalThis.structuredClone(_testObj);
    
    expect(_cloned).toEqual(_testObj);
    expect(_cloned).not.toBe(_testObj);
    expect(_cloned.b).not.toBe(_testObj.b);

    // Restore original method
    if (_originalStructuredClone) {
      globalThis.structuredClone = _originalStructuredClone;
    }
  });

  it('should polyfill requestIdleCallback if not available', () => {
    // Remove the method to test polyfill
    const _originalRequestIdleCallback = window.requestIdleCallback;
    const _originalCancelIdleCallback = window.cancelIdleCallback;
    delete (window as WindowWithIdleCallback).requestIdleCallback;
    delete (window as WindowWithIdleCallback).cancelIdleCallback;

    browserPolyfills.initializePolyfills();

    expect(window.requestIdleCallback).toBeDefined();
    expect(window.cancelIdleCallback).toBeDefined();

    // Test the polyfill
    const _callbackCalled = false;
    const _id = window.requestIdleCallback(() => {
      _callbackCalled = true;
    });

    expect(typeof _id).toBe('number');

    // Wait for callback
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(_callbackCalled).toBe(true);
        resolve();
      }, 10);
    }).finally(() => {
      // Restore original methods
      if (_originalRequestIdleCallback) {
        window.requestIdleCallback = _originalRequestIdleCallback;
      }
      if (_originalCancelIdleCallback) {
        window.cancelIdleCallback = _originalCancelIdleCallback;
      }
    });
  });

  it('should get correct CSS _prefixes for different browsers', () => {
    const _prefixes = browserPolyfills.getCSSPrefixes();
    
    expect(_prefixes).toHaveProperty('transform');
    expect(_prefixes).toHaveProperty('transition');
    expect(_prefixes).toHaveProperty('animation');
    expect(_prefixes).toHaveProperty('userSelect');
    
    // All should be strings
    Object.values(_prefixes).forEach((prefix: any) => {
      expect(typeof prefix).toBe('string');
    });
  });

  it('should get correct event names for different browsers', () => {
    const _events = browserPolyfills.getEventNames();
    
    expect(_events).toHaveProperty('transitionEnd');
    expect(_events).toHaveProperty('animationEnd');
    expect(_events).toHaveProperty('fullscreenChange');
    
    // All should be strings
    Object.values(_events).forEach((event: any) => {
      expect(typeof event).toBe('string');
    });
  });
});

describe('Cross-Browser Integration', () => {
  it('should handle _browser-specific manifest differences', () => {
    // Mock Chrome environment
    (global as unknown as { _chrome: typeof chrome }).chrome = _mockChrome as unknown as MockBrowserAPI;
    (global as unknown as { _browser: typeof _browser })._browser = undefined;
    
    // Reset the singleton instance to pick up new mocks
    (CrossBrowserAPI as unknown as MockCrossBrowserAPI).instance = null;
    const _chromeAPI = CrossBrowserAPI.getInstance();
    const _chromeManifest = chromeAPI.getManifestInfo();
    expect(_chromeManifest.version).toBe(3);
    expect(_chromeManifest.supportsServiceWorker).toBe(true);
    expect(_chromeManifest.backgroundType).toBe('service_worker');

    // Mock Firefox environment
    (global as unknown as { _chrome: unknown; _browser: unknown }).chrome = undefined;
    (global as unknown as { _chrome: unknown; _browser: unknown })._browser = _mockFirefox;
    
    // Reset the singleton instance to pick up new mocks
    (CrossBrowserAPI as unknown as MockCrossBrowserAPI).instance = null;

    // Reset singleton for Firefox
    (CrossBrowserAPI as unknown as MockCrossBrowserAPI).instance = undefined;
    const _firefoxAPI = CrossBrowserAPI.getInstance();
    const _firefoxManifest = firefoxAPI.getManifestInfo();
    expect(_firefoxManifest.version).toBe(2);
    expect(_firefoxManifest.supportsServiceWorker).toBe(false);
    expect(_firefoxManifest.backgroundType).toBe('background_page');
  });

  it('should handle storage operations consistently across browsers', () => {
    // Test with Chrome
    (global as unknown as { _chrome: typeof chrome }).chrome = _mockChrome as unknown as MockBrowserAPI;
    (global as unknown as { _browser: typeof _browser })._browser = undefined;

    const _chromeAPI = CrossBrowserAPI.getInstance();
    expect(_chromeAPI.storage).toBeDefined();
    expect(typeof chromeAPI.storage.set).toBe('function');
    expect(typeof chromeAPI.storage.get).toBe('function');

    // Test with Firefox
    (global as unknown as { _chrome: unknown; _browser: unknown }).chrome = undefined;
    (global as unknown as { _chrome: unknown; _browser: unknown })._browser = _mockFirefox;
    
    // Reset singleton for Firefox
    (CrossBrowserAPI as unknown as MockCrossBrowserAPI).instance = undefined;
    const _firefoxAPI = CrossBrowserAPI.getInstance();
    expect(_firefoxAPI.storage).toBeDefined();
    expect(typeof firefoxAPI.storage.set).toBe('function');
    expect(typeof firefoxAPI.storage.get).toBe('function');
    
    // Both APIs should have consistent interface
    expect(Object.keys(_chromeAPI.storage)).toEqual(Object.keys(_firefoxAPI.storage));
  });

  it('should handle storage API differences', async () => {
    const _mockStorage = {
      _store: vi.fn().mockResolvedValue(undefined),
      _retrieve: vi.fn().mockResolvedValue({ _test: 'value' }),
      _delete: vi.fn().mockResolvedValue(undefined),
      _getByPrefix: vi.fn().mockResolvedValue([]),
    } as unknown as StorageService;

    const _compatibility = CrossBrowserCompatibilityService.getInstance();
    const _result = compatibility.getStorageAPI();
    
    expect(_result).toBeDefined();
    expect(typeof _result?.get).toBe('function');

    // Test that _mockStorage methods work correctly
    await _mockStorage.store('test-key', 'test-value');
    expect(_mockStorage.store).toHaveBeenCalledWith('test-key', 'test-value');

    const _getResult = await _mockStorage.retrieve('test');
    expect(_mockStorage.retrieve).toHaveBeenCalledWith('test');
    expect(_getResult).toEqual({ _test: 'value' });

    await _mockStorage.delete('test-key');
    expect(_mockStorage.delete).toHaveBeenCalledWith('test-key');

    const _prefixResult = await _mockStorage.getByPrefix('test-');
    expect(_mockStorage.getByPrefix).toHaveBeenCalledWith('test-');
    expect(_prefixResult).toEqual([]);
  });
});