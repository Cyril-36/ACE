// Cross-browser API compatibility layer
import { browserDetection, BrowserType } from '../../utils/browserDetection';

export interface CrossBrowserStorage {
  get(_keys: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(_items: Record<string, unknown>): Promise<void>;
  remove(_keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
  getBytesInUse(keys?: string | string[]): Promise<number>;
}

export interface CrossBrowserTabs {
  query(_queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
  get(_tabId: number): Promise<chrome.tabs.Tab>;
  sendMessage(_tabId: number, _message: Record<string, unknown>): Promise<unknown>;
  executeScript(_tabId: number, _details: { files?: string[]; func?: () => unknown }): Promise<unknown>;
}

export interface CrossBrowserRuntime {
  sendMessage(_message: Record<string, unknown>): Promise<unknown>;
  _onMessage: {
    addListener(callback: (message: Record<string, unknown>, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: unknown) => void) => void): void;
    removeListener(_callback: (message: Record<string, unknown>, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: unknown) => void) => void): void;
  };
  getURL(_path: string): string;
  _id: string;
}

export class CrossBrowserAPI {
  private static instance: CrossBrowserAPI;
  private extensionAPI: typeof chrome | undefined;
  private browserInfo = browserDetection.detectBrowser();

  private constructor() {
    this.extensionAPI = browserDetection.getExtensionAPI() || undefined;
  }

  static getInstance(): CrossBrowserAPI {
    if (!CrossBrowserAPI.instance) {
      CrossBrowserAPI.instance = new CrossBrowserAPI();
    }
    return CrossBrowserAPI.instance;
  }

  /**
   * Get cross-browser storage API
   */
  get storage(): CrossBrowserStorage {
    if (!this.extensionAPI?.storage) {
      throw new Error('Extension storage API not available');
    }

    const _storageAPI = this.extensionAPI.storage.local;

    return {
      _get: (keys) => this.promisifyStorageGet(_storageAPI, keys),
      _set: (items) => this.promisifyStorageSet(_storageAPI, items),
      _remove: (keys) => this.promisifyStorageRemove(_storageAPI, keys),
      _clear: () => this.promisifyStorageClear(_storageAPI),
      _getBytesInUse: (keys) => this.promisifyStorageGetBytesInUse(_storageAPI, keys),
    };
  }

  /**
   * Get cross-browser tabs API
   */
  get tabs(): CrossBrowserTabs {
    if (!this.extensionAPI?.tabs) {
      throw new Error('Extension tabs API not available');
    }

    const _tabsAPI = this.extensionAPI.tabs;

    return {
      _query: (queryInfo) => this.promisifyTabsQuery(_tabsAPI, queryInfo),
      _get: (tabId) => this.promisifyTabsGet(_tabsAPI, tabId),
      _sendMessage: (tabId, message) => this.promisifyTabsSendMessage(_tabsAPI, tabId, message),
      _executeScript: (tabId, details) => this.promisifyScriptingExecuteScript(tabId, details),
    };
  }

  /**
   * Get cross-browser runtime API
   */
  get runtime(): CrossBrowserRuntime {
    if (!this.extensionAPI?.runtime) {
      throw new Error('Extension runtime API not available');
    }

    const _runtimeAPI = this.extensionAPI.runtime;

    return {
      _sendMessage: (message) => this.promisifyRuntimeSendMessage(_runtimeAPI, message),
      _onMessage: {
        addListener: (callback) => {
          if (this.browserInfo._type === BrowserType.FIREFOX) {
            // Firefox uses browser.runtime.onMessage
            runtimeAPI.onMessage.addListener((_message: Record<string, unknown>, _sender: chrome.runtime.MessageSender) => {
              return new Promise((resolve) => {
                callback(message, sender, resolve);
              });
            });
          } else {
            // Chrome uses chrome.runtime.onMessage
            runtimeAPI.onMessage.addListener(callback);
          }
        },
        _removeListener: (callback) => runtimeAPI.onMessage.removeListener(callback),
      },
      _getURL: (path) => runtimeAPI.getURL(path),
      _id: runtimeAPI.id || 'unknown',
    };
  }

  /**
   * Get browser-specific _manifest information
   */
  getManifestInfo(): {
    version: number;
    supportsServiceWorker: boolean;
    backgroundType: 'service_worker' | 'background_page' | 'event_page';
  } {
    const _manifest: chrome.runtime.Manifest | null = null;
    
    try {
      if (this.extensionAPI?.runtime?.getManifest) {
        _manifest = this.extensionAPI.runtime.getManifest();
      }
    } catch (error) {
      console.warn('Failed to get _manifest:', error);
    }
    
    if (!_manifest) {
      return {
        _version: 2,
        _supportsServiceWorker: false,
        backgroundType: 'background_page',
      };
    }

    const _manifestVersion = manifest.manifest_version || 2;
    
    return {
      _version: _manifestVersion,
      _supportsServiceWorker: _manifestVersion >= 3,
      backgroundType: _manifestVersion >= 3 ? 'service_worker' :
                     (_manifest as { background?: { persistent?: boolean } }).background?.persistent === false ? 'event_page' : 'background_page',
    };
  }

  /**
   * Handle browser-specific permission requests
   */
  async requestPermissions(_permissions: string[]): Promise<boolean> {
    if (!this.extensionAPI?.permissions) {
      console.warn('Permissions API not available');
      return false;
    }

    try {
      const _filteredPermissions = this.browserInfo._type === BrowserType.FIREFOX
        ? permissions.filter(p => p !== 'unlimitedStorage') // Firefox doesn't support _this
        : permissions;

      return await new Promise<boolean>((resolve, reject) => {
        this.extensionAPI!.permissions.request({
          _permissions: _filteredPermissions,
        }, (_granted: boolean) => {
          if (this.extensionAPI!.runtime.lastError) {
            reject(new Error(this.extensionAPI!.runtime.lastError.message));
          } else {
            resolve(granted);
          }
        });
      });
    } catch (error) {
      console.error('Permission request _failed:', error);
      return false;
    }
  }

  /**
   * Get browser-specific content script injection method
   */
  async injectContentScript(_tabId: number, _files: string[]): Promise<void> {
    if (this.browserInfo.supportsManifestV3 && this.extensionAPI?.scripting) {
      // Manifest V3 - use scripting API
      await this.extensionAPI.scripting.executeScript({
        _target: { tabId },
        files,
      });
    } else if (this.extensionAPI?.tabs) {
      // Manifest V2 - use tabs API
      for (const file of files) {
        await new Promise<void>((resolve, reject) => {
          this.extensionAPI!.tabs.executeScript(tabId, { file }, (_result: unknown) => {
            if (this.extensionAPI!.runtime.lastError) {
              reject(new Error(this.extensionAPI!.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }
    } else {
      throw new Error('Script injection not supported');
    }
  }

  // Private helper methods for promisifying Chrome APIs
  private async promisifyStorageGet(_storageAPI: chrome.storage.StorageArea, _keys: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      storageAPI.get(keys, (_result: Record<string, unknown>) => {
        if (this.extensionAPI!.runtime.lastError) {
          reject(new Error(this.extensionAPI!.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }

  private async promisifyStorageSet(_storageAPI: chrome.storage.StorageArea, _items: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      storageAPI.set(items, () => {
        if (this.extensionAPI!.runtime.lastError) {
          reject(new Error(this.extensionAPI!.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  private async promisifyStorageRemove(_storageAPI: chrome.storage.StorageArea, _keys: string | string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      storageAPI.remove(keys, () => {
        if (this.extensionAPI!.runtime.lastError) {
          reject(new Error(this.extensionAPI!.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  private async promisifyStorageClear(_storageAPI: chrome.storage.StorageArea): Promise<void> {
    return new Promise((resolve, reject) => {
      storageAPI.clear(() => {
        if (this.extensionAPI!.runtime.lastError) {
          reject(new Error(this.extensionAPI!.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  private async promisifyStorageGetBytesInUse(_storageAPI: chrome.storage.StorageArea, keys?: string | string[]): Promise<number> {
    return new Promise((resolve, reject) => {
      if (_storageAPI.getBytesInUse) {
        storageAPI.getBytesInUse(keys || null, (_bytes: number) => {
          if (this.extensionAPI!.runtime.lastError) {
            reject(new Error(this.extensionAPI!.runtime.lastError.message));
          } else {
            resolve(bytes);
          }
        });
      } else {
        // Fallback for browsers that don't support getBytesInUse
        resolve(0);
      }
    });
  }

  private async promisifyTabsQuery(_tabsAPI: typeof chrome.tabs, _queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve, reject) => {
      tabsAPI.query(queryInfo, (_tabs: chrome.tabs.Tab[]) => {
        if (this.extensionAPI!.runtime.lastError) {
          reject(new Error(this.extensionAPI!.runtime.lastError.message));
        } else {
          resolve(tabs);
        }
      });
    });
  }

  private async promisifyTabsGet(_tabsAPI: typeof chrome.tabs, _tabId: number): Promise<chrome.tabs.Tab> {
    return new Promise((resolve, reject) => {
      tabsAPI.get(tabId, (_tab: chrome.tabs.Tab) => {
        if (this.extensionAPI!.runtime.lastError) {
          reject(new Error(this.extensionAPI!.runtime.lastError.message));
        } else {
          resolve(tab);
        }
      });
    });
  }

  private async promisifyTabsSendMessage(_tabsAPI: typeof chrome.tabs, _tabId: number, _message: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      tabsAPI.sendMessage(tabId, message, (_response: unknown) => {
        if (this.extensionAPI!.runtime.lastError) {
          reject(new Error(this.extensionAPI!.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  private async promisifyScriptingExecuteScript(_tabId: number, _details: { files?: string[]; func?: () => unknown }): Promise<chrome.scripting.InjectionResult<unknown>[]> {
    return new Promise((resolve, reject) => {
      if (this.extensionAPI?.scripting) {
        this.extensionAPI.scripting.executeScript({
          _target: { tabId },
          ...details,
        } as chrome.scripting.ScriptInjection<unknown[], unknown>, (_results: chrome.scripting.InjectionResult<unknown>[]) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(results);
          }
        });
      } else {
        reject(new Error('Scripting API not available'));
      }
    });
  }

  private async promisifyRuntimeSendMessage(_runtimeAPI: typeof chrome.runtime, _message: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      runtimeAPI.sendMessage(message, (_response: unknown) => {
        if (this.extensionAPI!.runtime.lastError) {
          reject(new Error(this.extensionAPI!.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }


}

// Global instance
export const _crossBrowserAPI = CrossBrowserAPI.getInstance();