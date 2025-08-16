// Browser detection and compatibility utilities

interface GlobalWithBrowser {
  browser?: unknown;
}

export enum BrowserType {
  CHROME = 'chrome',
  FIREFOX = 'firefox',
  EDGE = 'edge',
  SAFARI = 'safari',
  OPERA = 'opera',
  UNKNOWN = 'unknown'
}

export interface BrowserInfo {
  type: BrowserType;
  version: string;
  isChromium: boolean;
  supportsManifestV3: boolean;
  supportsServiceWorker: boolean;
  supportsIndexedDB: boolean;
  supportsWebCrypto: boolean;
  supportsStorageAPI: boolean;
}

export class BrowserDetection {
  private static instance: BrowserDetection;
  private browserInfo: BrowserInfo | null = null;

  private constructor() {}

  static getInstance(): BrowserDetection {
    if (!BrowserDetection.instance) {
      BrowserDetection.instance = new BrowserDetection();
    }
    return BrowserDetection.instance;
  }

  /**
   * Detect the current browser and its capabilities
   */
  detectBrowser(): BrowserInfo {
    if (this.browserInfo) {
      return this.browserInfo;
    }

    const userAgent = navigator.userAgent;
    const vendor = navigator.vendor;
    
    let type = BrowserType.UNKNOWN;
    let version = 'unknown';
    let isChromium = false;

    // Chrome detection
    if (userAgent.includes('Chrome') && (vendor || '').includes('Google')) {
      if (userAgent.includes('Edg/')) {
        type = BrowserType.EDGE;
        version = this.extractVersion(userAgent, /Edg\/([0-9.]+)/);
        isChromium = true;
      } else if (userAgent.includes('OPR/')) {
        type = BrowserType.OPERA;
        version = this.extractVersion(userAgent, /OPR\/([0-9.]+)/);
        isChromium = true;
      } else {
        type = BrowserType.CHROME;
        version = this.extractVersion(userAgent, /Chrome\/([0-9.]+)/);
        isChromium = true;
      }
    }
    // Firefox detection
    else if (userAgent.includes('Firefox')) {
      type = BrowserType.FIREFOX;
      version = this.extractVersion(userAgent, /Firefox\/([0-9.]+)/);
    }
    // Safari detection
    else if (userAgent.includes('Safari') && (vendor || '').includes('Apple')) {
      type = BrowserType.SAFARI;
      version = this.extractVersion(userAgent, /Version\/([0-9.]+)/);
    }

    // Check for extension API availability
    const hasExtensionAPI = typeof chrome !== 'undefined' || typeof (globalThis as GlobalWithBrowser).browser !== 'undefined';
    const extensionAPI = this.getExtensionAPI();

    this.browserInfo = {
      type,
      version,
      isChromium,
      supportsManifestV3: this.checkManifestV3Support(type, version),
      supportsServiceWorker: this.checkServiceWorkerSupport(),
      supportsIndexedDB: this.checkIndexedDBSupport(),
      supportsWebCrypto: this.checkWebCryptoSupport(),
      supportsStorageAPI: hasExtensionAPI && !!extensionAPI?.storage,
    };

    return this.browserInfo;
  }

  /**
   * Get the appropriate extension API (chrome or browser)
   */
  getExtensionAPI(): typeof chrome | null {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome;
    }
    const globalWithBrowser = globalThis as { browser?: typeof chrome };
    if (typeof globalWithBrowser.browser !== 'undefined' && globalWithBrowser.browser?.runtime) {
      return globalWithBrowser.browser;
    }
    return null;
  }

  /**
   * Check if the browser is Chromium-based
   */
  isChromiumBased(): boolean {
    return this.detectBrowser().isChromium;
  }

  /**
   * Check if the browser is Firefox
   */
  isFirefox(): boolean {
    return this.detectBrowser().type === BrowserType.FIREFOX;
  }

  /**
   * Check if the browser is Edge
   */
  isEdge(): boolean {
    return this.detectBrowser().type === BrowserType.EDGE;
  }

  /**
   * Get browser-specific storage limits
   */
  getStorageLimits(): {
    localStorage: number;
    indexedDB: number;
    extensionStorage: number;
  } {
    const browser = this.detectBrowser();
    
    switch (browser.type) {
      case BrowserType.FIREFOX:
        return {
          localStorage: 10 * 1024 * 1024, // 10MB
          indexedDB: 2 * 1024 * 1024 * 1024, // 2GB
          extensionStorage: 100 * 1024 * 1024, // 100MB
        };
      case BrowserType.CHROME:
      case BrowserType.EDGE:
        return {
          localStorage: 10 * 1024 * 1024, // 10MB
          indexedDB: Math.floor((navigator.storage && typeof navigator.storage.estimate === 'function') ? 0.6 * 1024 * 1024 * 1024 : 50 * 1024 * 1024), // 60% of available or 50MB
          extensionStorage: 100 * 1024 * 1024, // 100MB (unlimited with permission)
        };
      default:
        return {
          localStorage: 5 * 1024 * 1024, // 5MB (conservative)
          indexedDB: 50 * 1024 * 1024, // 50MB (conservative)
          extensionStorage: 50 * 1024 * 1024, // 50MB (conservative)
        };
    }
  }

  /**
   * Get browser-specific CSP (Content Security Policy) requirements
   */
  getCSPRequirements(): {
    requiresUnsafeEval: boolean;
    requiresUnsafeInline: boolean;
    allowedSources: string[];
  } {
    const browser = this.detectBrowser();
    
    switch (browser.type) {
      case BrowserType.FIREFOX:
        return {
          requiresUnsafeEval: false,
          requiresUnsafeInline: false,
          allowedSources: ['self', 'https:'],
        };
      case BrowserType.CHROME:
      case BrowserType.EDGE:
        return {
          requiresUnsafeEval: false,
          requiresUnsafeInline: false,
          allowedSources: ['self'],
        };
      default:
        return {
          requiresUnsafeEval: true, // Conservative fallback
          requiresUnsafeInline: true,
          allowedSources: ['self', 'https:', 'data:'],
        };
    }
  }

  private extractVersion(userAgent: string, regex: RegExp): string {
    const match = userAgent.match(regex);
    return match ? match[1] : 'unknown';
  }

  private checkManifestV3Support(type: BrowserType, version: string): boolean {
    switch (type) {
      case BrowserType.CHROME:
        return this.compareVersions(version, '88.0') >= 0;
      case BrowserType.EDGE:
        return this.compareVersions(version, '88.0') >= 0;
      case BrowserType.FIREFOX:
        return this.compareVersions(version, '109.0') >= 0;
      default:
        return false;
    }
  }

  private checkServiceWorkerSupport(): boolean {
    return 'serviceWorker' in navigator;
  }

  private checkIndexedDBSupport(): boolean {
    return 'indexedDB' in window;
  }

  private checkWebCryptoSupport(): boolean {
    return 'crypto' in window && 'subtle' in window.crypto;
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }
}

// Global instance
export const browserDetection = BrowserDetection.getInstance();

// Convenience functions
export const getBrowserInfo = (): BrowserInfo => browserDetection.detectBrowser();
export const getExtensionAPI = () => browserDetection.getExtensionAPI();
export const isChromium = (): boolean => browserDetection.isChromiumBased();
export const isFirefox = (): boolean => browserDetection.isFirefox();
export const isEdge = (): boolean => browserDetection.isEdge();