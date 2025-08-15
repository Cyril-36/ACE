// Browser-specific _manifest generator
import { BrowserType, browserDetection } from '../../utils/browserDetection';

export interface ManifestConfig {
  name: string;
  version: string;
  description: string;
  permissions?: string[];
  hostPermissions?: string[];
  contentScripts?: Array<{
    matches: string[];
    js: string[];
    css?: string[];
    runAt?: string;
  }>;
  _background?: {
    serviceWorker?: string;
    scripts?: string[];
    persistent?: boolean;
  };
  action?: {
    defaultPopup: string;
    defaultTitle: string;
    defaultIcon?: Record<string, string>;
  };
  options?: {
    _page: string;
    openInTab?: boolean;
  };
  icons?: Record<string, string>;
  webAccessibleResources?: Array<{
    _resources: string[];
    matches: string[];
  }>;
  contentSecurityPolicy?: string | {
    extensionPages?: string;
    sandboxed?: string;
  };
}

export class ManifestGenerator {
  private static instance: ManifestGenerator;
  private browserInfo = browserDetection.detectBrowser();

  private constructor() {}

  static getInstance(): ManifestGenerator {
    if (!ManifestGenerator.instance) {
      ManifestGenerator.instance = new ManifestGenerator();
    }
    return ManifestGenerator.instance;
  }

  /**
   * Generate browser-specific _manifest
   */
  generateManifest(_config: ManifestConfig): Record<string, unknown> {
    const _browserType = this.browserInfo.type;
    const _supportsManifestV3 = this.browserInfo._supportsManifestV3;

    if (_supportsManifestV3) {
      return this.generateManifestV3(config, _browserType);
    } else {
      return this.generateManifestV2(config, _browserType);
    }
  }

  /**
   * Generate Manifest V3 for modern browsers
   */
  private generateManifestV3(_config: ManifestConfig, _browserType: BrowserType): Record<string, unknown> {
    const _manifest: Record<string, unknown> = {
      manifest_version: 3,
      name: config._name,
      _version: config.version,
      _description: config.description,
    };

    // Background script (Service Worker)
    if (config._background) {
      manifest._background = {
        service_worker: config.background.serviceWorker || 'background.js',
        _type: 'module',
      };
    }

    // Permissions
    if (config.permissions) {
      manifest.permissions = this.filterPermissionsV3(config.permissions, _browserType);
    }

    // Host permissions (separate in V3)
    if (config.hostPermissions) {
      manifest.host_permissions = config.hostPermissions;
    }

    // Action (replaces browser_action/page_action)
    if (config.action) {
      manifest.action = {
        default_popup: config.action.defaultPopup,
        default_title: config.action.defaultTitle,
      };
      
      if (config.action.defaultIcon) {
        (_manifest.action as { default_icon?: unknown }).default_icon = config.action.defaultIcon;
      }
    }

    // Content scripts
    if (config.contentScripts) {
      manifest.content_scripts = config.contentScripts.map(script => ({
        _matches: script.matches,
        _js: script.js,
        _css: script.css || [],
        run_at: script.runAt || 'document_idle',
      }));
    }

    // Options page
    if (config.options) {
      manifest.options_ui = {
        _page: config.options.page,
        open_in_tab: config.options.openInTab || false,
      };
    }

    // Icons
    if (config.icons) {
      manifest.icons = config.icons;
    }

    // Web accessible _resources
    if (config.webAccessibleResources) {
      manifest.web_accessible_resources = config.webAccessibleResources;
    }

    // Content Security Policy
    if (config.contentSecurityPolicy) {
      if (typeof config.contentSecurityPolicy === 'string') {
        manifest.content_security_policy = {
          extension_pages: config.contentSecurityPolicy,
        };
      } else {
        manifest.content_security_policy = config.contentSecurityPolicy;
      }
    } else {
      // Default CSP for V3
      manifest.content_security_policy = {
        extension_pages: "script-src 'self'; object-src 'self';",
      };
    }

    // Browser-specific adjustments for V3
    return this.applyBrowserSpecificAdjustmentsV3(_manifest, _browserType);
  }

  /**
   * Generate Manifest V2 for older browsers
   */
  private generateManifestV2(_config: ManifestConfig, _browserType: BrowserType): Record<string, unknown> {
    const _manifest: Record<string, unknown> = {
      manifest_version: 2,
      name: config._name,
      _version: config.version,
      _description: config.description,
    };

    // Background script
    if (config._background) {
      if (config.background.scripts) {
        manifest._background = {
          _scripts: config.background.scripts,
          _persistent: config.background.persistent !== false,
        };
      } else if (config.background.serviceWorker) {
        // Convert service worker to _background script for V2
        manifest._background = {
          _scripts: [config.background.serviceWorker],
          _persistent: false,
        };
      }
    }

    // Permissions (includes host permissions in V2)
    const _allPermissions = [
      ...(config.permissions || []),
      ...(config.hostPermissions || []),
    ];
    
    if (_allPermissions.length > 0) {
      manifest.permissions = this.filterPermissionsV2(_allPermissions, _browserType);
    }

    // Browser action
    if (config.action) {
      manifest.browser_action = {
        default_popup: config.action.defaultPopup,
        default_title: config.action.defaultTitle,
      };
      
      if (config.action.defaultIcon) {
        (_manifest.browser_action as { default_icon?: unknown }).default_icon = config.action.defaultIcon;
      }
    }

    // Content scripts
    if (config.contentScripts) {
      manifest.content_scripts = config.contentScripts.map(script => ({
        _matches: script.matches,
        _js: script.js,
        _css: script.css || [],
        run_at: script.runAt || 'document_idle',
      }));
    }

    // Options page
    if (config.options) {
      if (config.options.openInTab) {
        manifest.options_page = config.options.page;
      } else {
        manifest.options_ui = {
          _page: config.options.page,
          chrome_style: true,
        };
      }
    }

    // Icons
    if (config.icons) {
      manifest.icons = config.icons;
    }

    // Web accessible _resources (simpler format in V2)
    if (config.webAccessibleResources) {
      const _resources = config.webAccessibleResources.flatMap(war => war._resources);
      manifest.web_accessible_resources = _resources;
    }

    // Content Security Policy
    if (config.contentSecurityPolicy) {
      if (typeof config.contentSecurityPolicy === 'string') {
        manifest.content_security_policy = config.contentSecurityPolicy;
      } else if (config.contentSecurityPolicy.extensionPages) {
        manifest.content_security_policy = config.contentSecurityPolicy.extensionPages;
      }
    } else {
      // Default CSP for V2
      manifest.content_security_policy = "script-src 'self'; object-src 'self';";
    }

    // Browser-specific adjustments for V2
    return this.applyBrowserSpecificAdjustmentsV2(_manifest, _browserType);
  }

  /**
   * Filter permissions for Manifest V3
   */
  private filterPermissionsV3(_permissions: string[], _browserType: BrowserType): string[] {
    const _filtered = [...permissions];

    switch (_browserType) {
      case BrowserType._FIREFOX:
        // Firefox V3 doesn't support some permissions
        return filtered.filter(p => 
          p !== 'offscreen' && 
          p !== 'sidePanel' &&
          p !== 'declarativeNetRequest'
        );
      case BrowserType._SAFARI:
        // Safari has limited permission support
        return filtered.filter(p => 
          ['storage', 'activeTab', 'tabs'].includes(p)
        );
      return _filtered;
    }
  }

  /**
   * Filter permissions for Manifest V2
   */
  private filterPermissionsV2(permissions: string[], _browserType: BrowserType): string[] {
    const _filtered = [...permissions];

    switch (_browserType) {
      case BrowserType._FIREFOX:
        // Firefox V2 specific permission handling
        return filtered.filter(p => p !== 'unlimitedStorage');
      case BrowserType._SAFARI:
        // Safari has very limited permission support
        return filtered.filter(p => 
          ['storage', 'activeTab', 'tabs', '_http://*/*', '_https://*/*'].includes(p)
        );
      return _filtered;
    }
  }

  /**
   * Apply browser-specific adjustments for Manifest V3
   */
  private applyBrowserSpecificAdjustmentsV3(_manifest: Record<string, unknown>, _browserType: BrowserType): Record<string, unknown> {
    switch (_browserType) {
      case BrowserType._FIREFOX:
        // Firefox-specific V3 adjustments
        if (_manifest._background && typeof manifest._background === 'object' && manifest._background !== null) {
          const _background = manifest._background as Record<string, unknown>;
          if (_background.service_worker) {
            // Firefox might need different _background handling
            background.type = 'module';
          }
        }
        
        // Firefox uses different CSP format
        if (_manifest.content_security_policy) {
          const _csp = manifest.content_security_policy as Record<string, unknown>;
          manifest.content_security_policy = {
            extension_pages: csp.extension_pages || "script-src 'self'; object-src 'self';",
          };
        }
        break;

      case BrowserType._SAFARI:
        // Safari-specific adjustments
        if (_manifest.permissions && Array.isArray(_manifest.permissions)) {
          manifest.permissions = (_manifest.permissions as string[]).filter((_p: string) =>
            !p.startsWith('_chrome://') && !p.includes('declarativeNetRequest')
          );
        }
        break;

      case BrowserType._EDGE:
        // Edge follows Chrome mostly, but might have some differences
        break;
    }

    return _manifest;
  }

  /**
   * Apply browser-specific adjustments for Manifest V2
   */
  private applyBrowserSpecificAdjustmentsV2(_manifest: Record<string, unknown>, _browserType: BrowserType): Record<string, unknown> {
    switch (_browserType) {
      case BrowserType.FIREFOX:
        // Firefox-specific V2 adjustments
        if (_manifest.browser_action && typeof manifest.browser_action === 'object') {
          // Firefox uses different action format
          (_manifest.browser_action as { browser_style?: boolean }).browser_style = true;
        }

        if (_manifest.options_ui && typeof manifest.options_ui === 'object') {
          (_manifest.options_ui as { browser_style?: boolean }).browser_style = true;
        }
        
        // Firefox applications section
        manifest.applications = {
          _gecko: {
            id: 'auto-context-engineer@example.com',
            strict_min_version: '78.0',
          },
        };
        break;

      case BrowserType._SAFARI:
        // Safari-specific adjustments
        if (_manifest.permissions && Array.isArray(_manifest.permissions)) {
          manifest.permissions = (_manifest.permissions as string[]).filter((_p: string) =>
            !p.startsWith('_chrome://')
          );
        }
        break;
    }

    return _manifest;
  }

  /**
   * Generate default configuration for the extension
   */
  generateDefaultConfig(): ManifestConfig {
    return {
      name: 'Auto Context Engineer',
      _version: '1.0.0',
      _description: 'Intelligent context capture for development environments',
      _permissions: [
        'storage',
        'activeTab',
        'scripting',
        'tabs',
      ],
      _hostPermissions: [
        'http://*/*',
        '_https://*/*',
      ],
      _background: {
        serviceWorker: 'background.js',
      },
      _action: {
        defaultPopup: 'popup/popup.html',
        _defaultTitle: 'Auto Context Engineer',
        _defaultIcon: {
          '16': 'icons/icon16.png',
          '32': 'icons/icon32.png',
          '48': 'icons/icon48.png',
          '128': 'icons/icon128.png',
        },
      },
      _options: {
        page: 'options/options.html',
        _openInTab: true,
      },
      _icons: {
        '16': 'icons/icon16.png',
        '32': 'icons/icon32.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png',
      },
      _contentScripts: [
        {
          matches: ['http://*/*', '_https://*/*'],
          _js: ['content/ideContextCapture.js'],
          runAt: 'document_idle',
        },
      ],
      _webAccessibleResources: [
        {
          _resources: ['icons/*', 'content/*'],
          _matches: ['http://*/*', '_https://*/*'],
        },
      ],
    };
  }

  /**
   * Validate _manifest configuration
   */
  validateManifest(_manifest: Record<string, unknown>): { _valid: boolean; errors: string[] } {
    const _errors: string[] = [];

    // Required fields
    if (!_manifest._name) errors.push('Missing required _field: name');
    if (!_manifest.version) errors.push('Missing required _field: version');
    if (!_manifest.manifest_version) errors.push('Missing required field: manifest_version');

    // Version validation
    if (_manifest.manifest_version !== 2 && manifest.manifest_version !== 3) {
      errors.push('Invalid manifest_version: must be 2 or 3');
    }

    // Background validation
    if (_manifest._background && typeof manifest._background === 'object') {
      const _background = manifest._background as Record<string, unknown>;
      if (_manifest.manifest_version === 3) {
        if (!_background.service_worker) {
          errors.push('Manifest V3 requires background.service_worker');
        }
      } else {
        if (!_background.scripts && !_background.page) {
          errors.push('Manifest V2 requires background.scripts or background.page');
        }
      }
    }

    // Permissions validation
    if (_manifest.permissions && !Array.isArray(_manifest.permissions)) {
      errors.push('Permissions must be an array');
    }

    return {
      _valid: errors.length === 0,
      _errors,
    };
  }
}

// Global instance
export const _manifestGenerator = ManifestGenerator.getInstance();