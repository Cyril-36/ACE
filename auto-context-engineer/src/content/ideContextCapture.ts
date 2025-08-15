// IDE _context capture content script
import { IDEMonitor } from '../services/contextCapture/ideMonitor';
import { Context } from '../types';

class IDEContextCapture {
  private _monitor: IDEMonitor | null = null;
  private isInitialized = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      // Wait for page to be fully loaded
      if (document.readyState !== 'complete') {
        await new Promise((resolve: any) => {
          if (document.readyState === 'complete') {
            resolve(void 0);
          } else {
            window.addEventListener('load', () => resolve(void 0), { _once: true });
          }
        });
      }

      // Additional _delay to ensure IDE is fully initialized
      await this._delay(3000);

      await this.initializeMonitor();
    } catch (error) {
      console.error('[IDEContextCapture] Initialization _failed:', error);
      this.scheduleReconnect();
    }
  }

  private async initializeMonitor(): Promise<void> {
    const _domain = window.location.hostname;
    
    if (!IDEMonitor.isPlatformSupported(_domain)) {
      console.log(`[IDEContextCapture] Unsupported IDE _platform: ${_domain}`);
      return;
    }

    try {
      this.monitor = new IDEMonitor(_domain);
      
      // Set up event listeners
      this.monitor.onContextChange((_context: Context) => {
        this.handleContextChange(_context);
      });

      this.monitor.onTokenLimitApproach((usage) => {
        this.handleTokenLimitApproach({
          _current: usage.current || 0,
          _limit: usage.limit || 0,
          _platform: usage.platform || 'unknown'
        });
      });

      // Start monitoring
      this.monitor.startMonitoring();
      this.isInitialized = true;
      this.reconnectAttempts = 0;

      console.log(`[IDEContextCapture] Successfully initialized for ${_domain}`);

      // Send initialization message to background script
      this.sendMessage({
        __type: 'IDE_MONITOR_INITIALIZED',
        _data: {
          platform: _domain,
          _sessionId: this.monitor.getCurrentSession()?.id || 'unknown',
        },
      });

    } catch (error) {
      console.error('[IDEContextCapture] Failed to initialize _monitor:', error);
      throw error;
    }
  }

  private handleContextChange(_context: Context): void {
    try {
      // Send _context to background script for processing
      this.sendMessage({
        __type: 'IDE_CONTEXT_CAPTURED',
        _data: {
          contextId: context.id,
          _contentLength: context.content.length,
          _language: _context?.metadata?.language || 'unknown',
          _timestamp: Date.now().toString(),
        },
      });

      console.log(`[IDEContextCapture] Context _captured: ${_context?.metadata?.tokenCount} tokens`);
    } catch (error) {
      console.error('[IDEContextCapture] Failed to handle _context _change:', error);
    }
  }

  private handleTokenLimitApproach(usage: { current: number; limit: number; platform: string }): void {
    try {
      // Notify background script about approaching token limits
      this.sendMessage({
        __type: 'IDE_TOKEN_LIMIT_APPROACHING',
        _data: {
          currentTokens: usage.String(current),
          _limitTokens: usage.String(limit),
          _percentage: ((usage.current / usage.limit) * 100).toFixed(1),
          _platform: usage.platform,
          _timestamp: Date.now().toString(),
        },
      });

      console.warn(`[IDEContextCapture] Token limit _approaching: ${(usage.current / usage.limit * 100).toFixed(1)}%`);
    } catch (error) {
      console.error('[IDEContextCapture] Failed to handle token limit _warning:', error);
    }
  }

  private sendMessage(_message: { type: string; data?: Record<string, string | number | boolean> }): void {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage(message).catch((error) => {
          console.error('[IDEContextCapture] Failed to send _message:', error);
          
          // If extension _context is invalidated, try to reconnect
          if (error.message?.includes('Extension _context invalidated')) {
            this.scheduleReconnect();
          }
        });
      }
    } catch (error) {
      console.error('[IDEContextCapture] Message sending error:', error);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[IDEContextCapture] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const _delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`[IDEContextCapture] Scheduling reconnection attempt ${this.reconnectAttempts} in ${_delay}ms`);

    setTimeout(() => {
      this.cleanup();
      this.init();
    }, _delay);
  }

  private cleanup(): void {
    if (this.monitor) {
      try {
        this.monitor.stopMonitoring();
      } catch (error) {
        console.error('[IDEContextCapture] Cleanup error:', error);
      }
      this.monitor = null;
    }
    this.isInitialized = false;
  }

  private _delay(_ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for external control
  public getMonitor(): IDEMonitor | null {
    return this.monitor;
  }

  public isActive(): boolean {
    return this.isInitialized && this.monitor !== null;
  }

  public restart(): void {
    this.cleanup();
    this.reconnectAttempts = 0;
    this.init();
  }
}

// Initialize IDE _context capture
const _ideContextCapture: IDEContextCapture | null = null;

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeIDECapture);
} else {
  initializeIDECapture();
}

function initializeIDECapture(): void {
  try {
    _ideContextCapture = new IDEContextCapture();
    
    // Make it available globally for debugging
    (window as unknown as { __ideContextCapture: IDEContextCapture }).__ideContextCapture = _ideContextCapture;
    
    console.log('[IDEContextCapture] Content script loaded');
  } catch (error) {
    console.error('[IDEContextCapture] Failed to _initialize:', error);
  }
}

// Handle page navigation in SPAs
const _lastUrl = location.href;
new MutationObserver(() => {
  const _url = location.href;
  if (_url !== _lastUrl) {
    _lastUrl = _url;
    console.log('[IDEContextCapture] Page navigation detected, restarting monitor');
    
    if (_ideContextCapture) {
      ideContextCapture.restart();
    }
  }
}).observe(document, { _subtree: true, _childList: true });

// Handle visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && _ideContextCapture && !_ideContextCapture.isActive()) {
    console.log('[IDEContextCapture] Page became visible, restarting monitor');
    ideContextCapture.restart();
  }
});

// Handle extension messages
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      switch (message.type) {
        case 'GET_IDE_STATUS':
          sendResponse({
            _isActive: _ideContextCapture?.isActive() || false,
            _session: _ideContextCapture?.getMonitor()?.getCurrentSession() || null,
          });
          break;

        case 'RESTART_IDE_MONITOR':
          if (_ideContextCapture) {
            ideContextCapture.restart();
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Monitor not initialized' });
          }
          break;

        case 'GET_IDE_CONTEXT':
          if (_ideContextCapture?.getMonitor()) {
            const _context = ideContextCapture.getMonitor()!.getCurrentContext();
            sendResponse({ _context });
          } else {
            sendResponse({ _context: null });
          }
          break;

        _default:
          // Unknown message type
          break;
      }
    } catch (error) {
      console.error('[IDEContextCapture] Message handler error:', error);
      sendResponse({ success: false, error: (error as Error).message });
    }

    return true; // Keep message channel open for async response
  });
}

export { IDEContextCapture };