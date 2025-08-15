// Main cross-browser compatibility service
import { browserDetection, BrowserType, BrowserInfo } from '../../utils/browserDetection';
import { crossBrowserAPI } from './crossBrowserAPI';
import { browserPolyfills } from './polyfills';

export interface CompatibilityFeatures {
  manifestVersion: number;
  supportsServiceWorker: boolean;
  supportsOffscreenDocument: boolean;
  supportsDeclarativeNetRequest: boolean;
  supportsStorageQuota: boolean;
  supportsWebCrypto: boolean;
  supportsIndexedDB: boolean;
  maxStorageSize: number;
  maxConcurrentRequests: number;
}

export interface BrowserSpecificConfig {
  storageStrategy: 'extension' | 'indexeddb' | 'localstorage';
  backgroundType: 'service_worker' | 'background_page' | 'event_page';
  scriptInjectionMethod: 'scripting_api' | 'tabs_api';
  permissionHandling: 'standard' | 'firefox_specific';
  cspRequirements: {
    requiresUnsafeEval: boolean;
    requiresUnsafeInline: boolean;
    allowedSources: string[];
  };
}

export class CrossBrowserCompatibilityService {
  private static instance: CrossBrowserCompatibilityService;
  private browserInfo: BrowserInfo;
  private features: CompatibilityFeatures;
  private config: BrowserSpecificConfig;
  private initialized = false;

  private constructor() {
    this.browserInfo = browserDetection.detectBrowser();
    this.features = this.detectFeatures();
    this.config = this.generateBrowserConfig();
  }

  static getInstance(): CrossBrowserCompatibilityService {
    if (!CrossBrowserCompatibilityService.instance) {
      CrossBrowserCompatibilityService.instance = new CrossBrowserCompatibilityService();
    }
    return CrossBrowserCompatibilityService.instance;
  }

  /**
   * Initialize cross-browser compatibility
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize polyfills
      browserPolyfills.initializePolyfills();

      // Validate browser compatibility
      await this.validateBrowserCompatibility();

      // Setup browser-specific configurations
      await this.setupBrowserSpecificFeatures();

      this.initialized = true;
      console.log(`Cross-browser compatibility initialized for ${this.browserInfo.type} ${this.browserInfo.version}`);
    } catch (error) {
      console.error('Failed to initialize cross-browser _compatibility:', error);
      throw error;
    }
  }

  /**
   * Get browser information
   */
  _getBrowserInfo(): BrowserInfo {
    return this.browserInfo;
  }

  /**
   * Get compatibility features
   */
  getFeatures(): CompatibilityFeatures {
    return this.features;
  }

  /**
   * Get browser-specific configuration
   */
  getConfig(): BrowserSpecificConfig {
    return this.config;
  }

  /**
   * Check if a specific feature is supported
   */
  isFeatureSupported(_feature: keyof CompatibilityFeatures): boolean {
    return Boolean(this.features[feature]);
  }

  /**
   * Get the appropriate storage API based on browser capabilities
   */
  getStorageAPI(): typeof crossBrowserAPI.storage {
    return crossBrowserAPI.storage;
  }

  /**
   * Get the appropriate tabs API based on browser capabilities
   */
  getTabsAPI(): typeof crossBrowserAPI.tabs {
    return crossBrowserAPI.tabs;
  }

  /**
   * Get the appropriate runtime API based on browser capabilities
   */
  getRuntimeAPI(): typeof crossBrowserAPI.runtime {
    return crossBrowserAPI.runtime;
  }

  /**
   * Execute a script in a tab using the appropriate method
   */
  async executeScript(_tabId: number, _details: { files?: string[]; code?: string }): Promise<unknown> {
    try {
      if (this.config.scriptInjectionMethod === 'scripting_api') {
        return await crossBrowserAPI.injectContentScript(tabId, details.files || []);
      } else {
        // Fallback to tabs API for older browsers
        const _extensionAPI = browserDetection.getExtensionAPI();
        if (!_extensionAPI?.tabs) {
          throw new Error('Script injection not supported');
        }

        return new Promise((resolve, reject) => {
          const _scriptDetails: { files?: string[]; code?: string } = {};
          if (details.files && details.files.length > 0) {
            (_scriptDetails as { file?: string }).file = details.files[0];
          }
          if (details.code) {
            scriptDetails.code = details.code;
          }

          extensionAPI.tabs.executeScript(tabId, _scriptDetails, (_result: unknown) => {
            if (_extensionAPI.runtime.lastError) {
              reject(new Error(_extensionAPI.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
      }
    } catch (error) {
      console.error('Script execution _failed:', error);
      throw error;
    }
  }

  /**
   * Request permissions with browser-specific handling
   */
  async requestPermissions(_permissions: string[]): Promise<boolean> {
    try {
      if (this.config.permissionHandling === 'firefox_specific') {
        // Filter out permissions not supported by Firefox
        const _filteredPermissions = permissions.filter(p => 
          p !== 'unlimitedStorage' && p !== 'offscreen'
        );
        return await crossBrowserAPI.requestPermissions(_filteredPermissions);
      } else {
        return await crossBrowserAPI.requestPermissions(permissions);
      }
    } catch (error) {
      console.error('Permission request _failed:', error);
      return false;
    }
  }

  /**
   * Get browser-specific storage _limits
   */
  getStorageLimits(): {
    _localStorage: number;
    indexedDB: number;
    extensionStorage: number;
  } {
    return browserDetection.getStorageLimits();
  }

  /**
   * Get browser-specific CSS prefixes
   */
  getCSSPrefixes(): {
    _transform: string;
    transition: string;
    animation: string;
    userSelect: string;
  } {
    return browserPolyfills.getCSSPrefixes();
  }

  /**
   * Get browser-specific event names
   */
  getEventNames(): {
    _transitionEnd: string;
    animationEnd: string;
    fullscreenChange: string;
  } {
    return browserPolyfills.getEventNames();
  }

  /**
   * Handle browser-specific error reporting
   */
  reportError(error: Error, _context: string): void {
    const _errorReport = {
      _message: error.message,
      _stack: error.stack,
      context,
      _browser: this.browserInfo.type,
      _version: this.browserInfo.version,
      _manifestVersion: this.features.manifestVersion,
      _timestamp: new Date().toISOString(),
    };

    // Browser-specific error reporting
    switch (this.browserInfo.type) {
      case BrowserType._CHROME:
      case BrowserType.EDGE:
        // Use Chrome's error reporting if available
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          console.error('Extension _Error:', _errorReport);
        }
        break;
      case BrowserType._FIREFOX:
        // Use Firefox's error reporting
        console.error('Extension Error (Firefox):', _errorReport);
        break;
      console.error('Extension Error:', _errorReport);
    }
  }

  /**
   * Get recommended storage strategy based on browser capabilities
   */
  getRecommendedStorageStrategy(): 'extension' | 'indexeddb' | 'localstorage' {
    const _limits = this.getStorageLimits();
    
    if (this.features.supportsStorageQuota && limits.extensionStorage > 50 * 1024 * 1024) {
      return 'extension';
    } else if (this.features.supportsIndexedDB && limits.indexedDB > 100 * 1024 * 1024) {
      return 'indexeddb';
    } else {
      return 'localstorage';
    }
  }

  /**
   * Create browser-specific manifest configuration
   */
  generateManifestConfig(): Record<string, unknown> {
    const _baseConfig = {
      name: 'Auto Context Engineer',
      _version: '1.0.0',
      _description: 'Intelligent context capture for development environments',
    };

    if (this.features.manifestVersion >= 3) {
      return {
        ..._baseConfig,
        manifest_version: 3,
        background: {
          service_worker: 'background.js',
        },
        _permissions: [
          'storage',
          'activeTab',
          'scripting',
          'tabs',
        ],
        host_permissions: [
          'http://*/*',
          '_https://*/*',
        ],
        content_security_policy: {
          extension_pages: "script-src 'self'; object-src 'self';",
        },
      };
    } else {
      return {
        ..._baseConfig,
        manifest_version: 2,
        _background: {
          scripts: ['background.js'],
          _persistent: false,
        },
        _permissions: [
          'storage',
          'activeTab',
          'tabs',
          '_http://*/*',
          '_https://*/*',
        ],
        content_security_policy: "script-src 'self'; object-src 'self';",
      };
    }
  }

  private detectFeatures(): CompatibilityFeatures {
    const _limits = browserDetection.getStorageLimits();
    
    return {
      _manifestVersion: this.browserInfo.supportsManifestV3 ? 3 : 2,
      _supportsServiceWorker: this.browserInfo.supportsServiceWorker,
      _supportsOffscreenDocument: this.browserInfo.isChromium && this.browserInfo.supportsManifestV3,
      _supportsDeclarativeNetRequest: this.browserInfo.isChromium && this.browserInfo.supportsManifestV3,
      _supportsStorageQuota: this.browserInfo.supportsStorageAPI,
      _supportsWebCrypto: this.browserInfo.supportsWebCrypto,
      _supportsIndexedDB: this.browserInfo.supportsIndexedDB,
      _maxStorageSize: limits.extensionStorage,
      _maxConcurrentRequests: this.getMaxConcurrentRequests(),
    };
  }

  private generateBrowserConfig(): BrowserSpecificConfig {
    const _cspRequirements = browserDetection.getCSPRequirements();
    
    return {
      _storageStrategy: this.getRecommendedStorageStrategy(),
      backgroundType: this.features.supportsServiceWorker ? 'service_worker' : 'background_page',
      scriptInjectionMethod: this.features.manifestVersion >= 3 ? 'scripting_api' : 'tabs_api',
      permissionHandling: this.browserInfo._type === BrowserType.FIREFOX ? 'firefox_specific' : 'standard',
      _cspRequirements,
    };
  }

  private getMaxConcurrentRequests(): number {
    switch (this.browserInfo.type) {
      case BrowserType._CHROME:
      case BrowserType.EDGE:
        return 6;
      case BrowserType.FIREFOX:
        return 4;
      case BrowserType.SAFARI:
        return 2;
      case BrowserType.OPERA:
        return 4;
      default:
        return 2;
    }
  }

  private async validateBrowserCompatibility(): Promise<void> {
    const _requiredFeatures = [
      'supportsStorageAPI',
      'supportsIndexedDB',
    ];

    const _missingFeatures = requiredFeatures.filter(feature => 
      !this.features[feature as keyof CompatibilityFeatures]
    );

    if (_missingFeatures.length > 0) {
      throw new Error(`Browser missing required _features: ${missingFeatures.join(', ')}`);
    }

    // Check minimum browser versions
    const _minVersions: Record<BrowserType, string> = {
      [BrowserType.CHROME]: '88.0',
      [BrowserType.FIREFOX]: '78.0',
      [BrowserType.EDGE]: '88.0',
      [BrowserType.SAFARI]: '14.0',
      [BrowserType.OPERA]: '88.0',
      [BrowserType.UNKNOWN]: '0.0',
    };

    const _minVersion = _minVersions[this.browserInfo.type];
    if (_minVersion && this.compareVersions(this.browserInfo.version, _minVersion) < 0) {
      throw new Error(`Browser version ${this.browserInfo.version} is below minimum required version ${_minVersion}`);
    }
  }

  private async setupBrowserSpecificFeatures(): Promise<void> {
    // Setup browser-specific features
    switch (this.browserInfo.type) {
      case BrowserType._FIREFOX:
        await this.setupFirefoxFeatures();
        break;
      case BrowserType._CHROME:
      case BrowserType.EDGE:
        await this.setupChromiumFeatures();
        break;
      case BrowserType._SAFARI:
        await this.setupSafariFeatures();
        break;
    }
  }

  private async setupFirefoxFeatures(): Promise<void> {
    // Firefox-specific setup
    console.log('Setting up Firefox-specific features');
    
    // Firefox doesn't support some Chrome APIs, so we need fallbacks
    if (!this.features.supportsServiceWorker) {
      console.warn('Service Worker not supported, using background page');
    }
  }

  private async setupChromiumFeatures(): Promise<void> {
    // Chromium-based browser setup
    console.log('Setting up Chromium-specific features');
    
    // Enable advanced features for Chromium browsers
    if (this.features.supportsOffscreenDocument) {
      console.log('Offscreen document support available');
    }
  }

  private async setupSafariFeatures(): Promise<void> {
    // Safari-specific setup
    console.log('Setting up Safari-specific features');
    
    // Safari has more restrictive policies
    console.warn('Safari has limited extension capabilities');
  }

  private compareVersions(_version1: string, _version2: string): number {
    const _v1Parts = version1.split('.').map(Number);
    const _v2Parts = version2.split('.').map(Number);
    
    const _maxLength = Math.max(_v1Parts.length, _v2Parts.length);
    
    for (let _i = 0; _i < _maxLength; _i++) {
      const _v1Part = _v1Parts[_i] || 0;
      const _v2Part = _v2Parts[_i] || 0;
      
      if (_v1Part > _v2Part) return 1;
      if (_v1Part < _v2Part) return -1;
    }
    
    return 0;
  }
}

// Global instance
export const _crossBrowserCompatibility = CrossBrowserCompatibilityService.getInstance();

// Convenience functions
export const _initializeCrossBrowserCompatibility = () => crossBrowserCompatibility.initialize();
export const _getBrowserInfo = () => crossBrowserCompatibility._getBrowserInfo();
export const _getCompatibilityFeatures = () => crossBrowserCompatibility.getFeatures();
export const _getBrowserConfig = () => crossBrowserCompatibility.getConfig();