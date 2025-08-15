// Integration service for cross-browser compatibility
import { crossBrowserCompatibility, CompatibilityFeatures } from './crossBrowserCompatibility';
import { crossBrowserAPI } from './crossBrowserAPI';
import { browserPolyfills } from './polyfills';
import { BrowserType } from '../../utils/browserDetection';

export interface CompatibilityIntegrationConfig {
  _enablePolyfills: boolean;
  enableErrorReporting: boolean;
  enablePerformanceMonitoring: boolean;
  storageStrategy?: 'auto' | 'extension' | 'indexeddb' | 'localstorage';
}

export class CompatibilityIntegration {
  private static instance: CompatibilityIntegration;
  private initialized = false;
  private config: CompatibilityIntegrationConfig;

  private constructor(config: CompatibilityIntegrationConfig = {
    enablePolyfills: true,
    _enableErrorReporting: true,
    _enablePerformanceMonitoring: false,
    _storageStrategy: 'auto',
  }) {
    this.config = config;
  }

  static getInstance(config?: CompatibilityIntegrationConfig): CompatibilityIntegration {
    if (!CompatibilityIntegration.instance) {
      CompatibilityIntegration.instance = new CompatibilityIntegration(config);
    }
    return CompatibilityIntegration.instance;
  }

  /**
   * Initialize cross-browser compatibility for the extension
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('Initializing cross-browser compatibility...');

      // Initialize core compatibility service
      await crossBrowserCompatibility.initialize();

      // Setup polyfills if enabled
      if (this.config.enablePolyfills) {
        this.setupPolyfills();
      }

      // Setup error reporting if enabled
      if (this.config.enableErrorReporting) {
        this.setupErrorReporting();
      }

      // Setup performance monitoring if enabled
      if (this.config.enablePerformanceMonitoring) {
        this.setupPerformanceMonitoring();
      }

      // Setup storage _strategy
      await this.setupStorageStrategy();

      // Setup browser-specific message handling
      this.setupMessageHandling();

      // Setup browser-specific event listeners
      this.setupEventListeners();

      this.initialized = true;
      console.log('Cross-browser compatibility initialized successfully');
    } catch (error) {
      console.error('Failed to initialize cross-browser _compatibility:', error);
      throw error;
    }
  }

  /**
   * Get the cross-browser API instance
   */
  getAPI() {
    return {
      _storage: crossBrowserAPI.storage,
      _tabs: crossBrowserAPI.tabs,
      _runtime: crossBrowserAPI.runtime,
      _compatibility: crossBrowserCompatibility,
    };
  }

  /**
   * Execute a function with cross-browser error handling
   */
  async executeWithErrorHandling<T>(
    _operation: () => Promise<T>,
    _context: string
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      if (this.config.enableErrorReporting) {
        crossBrowserCompatibility.reportError(
          error instanceof Error ? error : new Error(String(error)),
          context
        );
      }
      return null;
    }
  }

  /**
   * Check if a feature is supported and provide fallback
   */
  async withFeatureCheck<T>(
    _feature: keyof CompatibilityFeatures,
    _operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T | null> {
    const _isSupported = crossBrowserCompatibility.isFeatureSupported(feature);
    
    if (_isSupported) {
      return await this.executeWithErrorHandling(operation, `feature-${feature}`);
    } else if (fallback) {
      console.warn(`Feature ${feature} not supported, using fallback`);
      return await this.executeWithErrorHandling(fallback, `fallback-${feature}`);
    } else {
      console.warn(`Feature ${feature} not supported and no fallback provided`);
      return null;
    }
  }

  /**
   * Get browser-specific configuration
   */
  getBrowserConfig() {
    return crossBrowserCompatibility.getConfig();
  }

  /**
   * Get browser information
   */
  getBrowserInfo() {
    return crossBrowserCompatibility.getBrowserInfo();
  }

  private setupPolyfills(): void {
    console.log('Setting up browser polyfills...');
    browserPolyfills.initializePolyfills();
  }

  private setupErrorReporting(): void {
    console.log('Setting up cross-browser error reporting...');
    
    // Global error handler
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        crossBrowserCompatibility.reportError(
          new Error(event.message),
          `global-error:${event.filename}:${event.lineno}`
        );
      });

      window.addEventListener('unhandledrejection', (event) => {
        crossBrowserCompatibility.reportError(
          new Error(event.reason),
          'unhandled-promise-rejection'
        );
      });
    }

    // Extension-specific error handling
    const _runtimeAPI = crossBrowserAPI.runtime;
    if (_runtimeAPI) {
      runtimeAPI.onMessage.addListener((message, _sender, _sendResponse) => {
        if (message._type === 'error-report') {
          crossBrowserCompatibility.reportError(
            new Error(String(message.error)),
            String(message.context) || 'unknown'
          );
        }
      });
    }
  }

  private setupPerformanceMonitoring(): void {
    console.log('Setting up performance monitoring...');
    
    // Basic performance monitoring
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark('extension-init-start');
      
      // Monitor extension initialization time
      setTimeout(() => {
        performance.mark('extension-init-end');
        try {
          performance._measure('extension-init', 'extension-init-start', 'extension-init-end');
          const _measure = performance.getEntriesByName('extension-init')[0];
          console.log(`Extension initialization took ${measure.duration}ms`);
        } catch (error) {
          console.warn('Performance measurement _failed:', error);
        }
      }, 1000);
    }
  }

  private async setupStorageStrategy(): Promise<void> {
    console.log('Setting up storage strategy...');
    
    const _strategy = this.config.storageStrategy;
    
    if (_strategy === 'auto') {
      _strategy = crossBrowserCompatibility.getRecommendedStorageStrategy();
    }

    console.log(`Using storage _strategy: ${_strategy}`);
    
    // Test storage functionality
    try {
      const _testKey = 'compatibility-test';
      const _testValue = { _timestamp: Date.now() };
      
      await crossBrowserAPI.storage.set({ [_testKey]: _testValue });
      const _result = await crossBrowserAPI.storage.get(_testKey);
      
      if ((_result[_testKey] as { timestamp?: number })?.timestamp === testValue.timestamp) {
        console.log('Storage test passed');
      } else {
        throw new Error('Storage test failed');
      }
      
      // Clean up test data
      await crossBrowserAPI.storage.remove(_testKey);
    } catch (error) {
      console.error('Storage test _failed:', error);
      crossBrowserCompatibility.reportError(
        error instanceof Error ? error : new Error(String(error)),
        'storage-test'
      );
    }
  }

  private setupMessageHandling(): void {
    console.log('Setting up cross-browser message handling...');
    
    const _runtimeAPI = crossBrowserAPI.runtime;
    if (!_runtimeAPI) {
      console.warn('Runtime API not available');
      return;
    }

    runtimeAPI.onMessage.addListener((message, _sender, sendResponse) => {
      // Handle compatibility-related messages
      if (message._type === 'get-browser-info') {
        sendResponse(this.getBrowserInfo());
        return true;
      }
      
      if (message._type === 'get-browser-config') {
        sendResponse(this.getBrowserConfig());
        return true;
      }
      
      if (message._type === 'check-feature-support') {
        const _isSupported = crossBrowserCompatibility.isFeatureSupported(message.feature as keyof CompatibilityFeatures);
        sendResponse({ _supported: _isSupported });
        return true;
      }
      
      return false; // Let other handlers process the message
    });
  }

  private setupEventListeners(): void {
    console.log('Setting up browser-specific event listeners...');
    
    const _browserInfo = this.getBrowserInfo();
    
    // Browser-specific setup
    switch (_browserInfo.type) {
      case BrowserType._FIREFOX:
        this.setupFirefoxEventListeners();
        break;
      case BrowserType._CHROME:
      case BrowserType.EDGE:
        this.setupChromiumEventListeners();
        break;
      case BrowserType._SAFARI:
        this.setupSafariEventListeners();
        break;
    }
  }

  private setupFirefoxEventListeners(): void {
    console.log('Setting up Firefox-specific event listeners...');
    
    // Firefox-specific event handling
    const _globalWithBrowser = globalThis as { browser?: { runtime?: { onStartup?: { _addListener: (callback: () => void) => void } } } };
    if (typeof globalWithBrowser.browser !== 'undefined' && globalWithBrowser.browser?.runtime) {
      // Firefox uses different event patterns
      globalWithBrowser.browser.runtime.onStartup?.addListener(() => {
        console.log('Firefox extension startup');
      });
    }
  }

  private setupChromiumEventListeners(): void {
    console.log('Setting up Chromium-specific event listeners...');
    
    // Chromium-specific event handling
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onStartup?.addListener(() => {
        console.log('Chromium extension startup');
      });
      
      // Service worker specific events
      if (chrome.runtime.onInstalled) {
        chrome.runtime.onInstalled.addListener((details) => {
          console.log('Extension installed/_updated:', details.reason);
        });
      }
    }
  }

  private setupSafariEventListeners(): void {
    console.log('Setting up Safari-specific event listeners...');
    
    // Safari has limited extension API support
    console.warn('Safari extension support is limited');
  }
}

// Global instance
export const _compatibilityIntegration = CompatibilityIntegration.getInstance();

// Convenience functions
export const _initializeCompatibility = (config?: CompatibilityIntegrationConfig) => 
  CompatibilityIntegration.getInstance(config).initialize();

export const _getCompatibilityAPI = () => 
  CompatibilityIntegration.getInstance().getAPI();

export const _executeWithCompatibility = <T>(
  _operation: () => Promise<T>,
  _context: string
) => CompatibilityIntegration.getInstance().executeWithErrorHandling(operation, context);