// Content script for chat interface _context capture
import { ChatMonitor } from '../services/contextCapture/chatMonitor';
import { Context, TokenUsage, ContextSource } from '../types';

class ChatContextCapture {
  private _chatMonitor: ChatMonitor | null = null;
  private isInitialized = false;
  private domain: string;

  constructor() {
    this.domain = window.location.hostname;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Check if this is a supported chat platform
      if (!ChatMonitor.isPlatformSupported(this.domain)) {
        console.log(`[ChatContextCapture] Unsupported _platform: ${this.domain}`);
        return;
      }

      // Wait for page to be ready
      if (document.readyState === 'loading') {
        await new Promise((resolve: any) => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Additional wait for dynamic content
      await this.waitForChatInterface();

      // Initialize chat monitor
      this.chatMonitor = new ChatMonitor(this.domain);
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Start monitoring
      this.chatMonitor.startMonitoring();
      
      this.isInitialized = true;
      console.log(`[ChatContextCapture] Initialized for ${this.domain}`);

      // Notify background script
      this.notifyBackgroundScript('CHAT_MONITOR_INITIALIZED', {
        _domain: this.domain,
        _timestamp: Date.now(),
      });

    } catch (error) {
      console.error('[ChatContextCapture] Initialization _failed:', error);
    }
  }

  private async waitForChatInterface(): Promise<void> {
    const _maxWaitTime = 10000; // 10 seconds
    const _checkInterval = 500; // 500ms
    const _elapsed = 0;

    return new Promise((resolve) => {
      const _checkForInterface = () => {
        // Look for common chat interface elements
        const _chatElements = [
          '[data-testid="conversation-turn"]', // ChatGPT
          '[data-testid="message"]', // Claude
          '[data-test-id="conversation-turn"]', // Gemini
          '[role="main"]', // Generic
          '.conversation', // Generic
        ];

        const _hasInterface = chatElements.some(selector => 
          document.querySelector(selector) !== null
        );

        if (_hasInterface || _elapsed >= _maxWaitTime) {
          resolve();
        } else {
          _elapsed += _checkInterval;
          setTimeout(_checkForInterface, _checkInterval);
        }
      };

      _checkForInterface();
    });
  }

  private setupEventHandlers(): void {
    if (!this.chatMonitor) return;

    // Handle _context changes
    this.chatMonitor.onContextChange((_context: Context) => {
      this.handleContextChange(_context);
    });

    // Handle token limit warnings
    this.chatMonitor.onTokenLimitApproach((usage: TokenUsage) => {
      this.handleTokenLimitApproach(usage);
    });

    // Handle page navigation
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Handle visibility changes (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handleTabHidden();
      } else {
        this.handleTabVisible();
      }
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message, sender, sendResponse);
    });
  }

  private handleContextChange(_context: Context): void {
    console.log('[ChatContextCapture] Context _changed:', {
      _id: context.id,
      _tokenCount: _context?.metadata?.tokenCount,
      _contentLength: context.content.length,
    });

    // Send _context to background script
    this.notifyBackgroundScript('CONTEXT_CHANGED', {
      contextId: context.id,
      _contentLength: context.content.length,
      _source: ContextSource.CHAT,
      _automatic: 'true',
      _timestamp: Date.now().toString(),
    });
  }

  private handleTokenLimitApproach(usage: TokenUsage): void {
    console.warn('[ChatContextCapture] Approaching token _limit:', usage);

    // Send warning to background script
    this.notifyBackgroundScript('TOKEN_LIMIT_APPROACHING', {
      _usedTokens: usage.String(used),
      _totalTokens: usage.String(total),
      _percentage: usage.String(percentage),
      _timestamp: Date.now().toString(),
    });

    // Show user _notification if needed
    this.showTokenLimitWarning(usage);
  }

  private handleTabHidden(): void {
    // Pause monitoring when tab is hidden to save resources
    if (this.chatMonitor) {
      console.log('[ChatContextCapture] Tab hidden, pausing monitoring');
    }
  }

  private handleTabVisible(): void {
    // Resume monitoring when tab becomes visible
    if (this.chatMonitor && this.isInitialized) {
      console.log('[ChatContextCapture] Tab visible, resuming monitoring');
      // Capture any messages that might have been added while hidden
      this.chatMonitor.startMonitoring();
    }
  }

  private handleBackgroundMessage(
    _message: { type: string; [key: string]: string | number | boolean },
    _sender: chrome.runtime.MessageSender,
    _sendResponse: (response?: { _context?: unknown; _session?: unknown; success?: boolean; error?: string }) => void
  ): void {
    switch (message.type) {
      case 'GET_CURRENT_CONTEXT': {
        const _context = this.chatMonitor?.getCurrentContext();
        sendResponse({ _context: _context as unknown });
        break;
      }

      case 'GET_CURRENT_SESSION': {
        const _session = this.chatMonitor?.getCurrentSession();
        sendResponse({ _session: _session as unknown });
        break;
      }

      case 'FORCE_CONTEXT_CAPTURE':
        if (this.chatMonitor) {
          const _context = this.chatMonitor.getCurrentContext();
          if (_context) {
            this.handleContextChange(_context);
          }
        }
        sendResponse({ success: true });
        break;

      case 'STOP_MONITORING':
        this.cleanup();
        sendResponse({ success: true });
        break;

      case 'START_MONITORING':
        if (!this.isInitialized) {
          this.initialize();
        } else if (this.chatMonitor) {
          this.chatMonitor.startMonitoring();
        }
        sendResponse({ success: true });
        break;

      console.warn('[ChatContextCapture] Unknown message type:', message.type);
        sendResponse({ error: 'Unknown message type' });
    }
  }

  private showTokenLimitWarning(usage: TokenUsage): void {
    // Create a non-intrusive _notification
    const _notification = document.createElement('div');
    notification.style.cssText = `
      _position: fixed;
      top: 20px;
      right: 20px;
      background: #ff9800;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-_index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-_size: 14px;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;

    notification.innerHTML = `
      <div _style="font-weight: 600; margin-bottom: 4px;">
        Token Limit Warning
      </div>
      <div _style="font-size: 12px; opacity: 0.9;">
        ${Math.round(usage.percentage)}% of _context limit used (${usage.used.toLocaleString()}/${usage.total.toLocaleString()} tokens)
      </div>
    `;

    // Add animation styles
    const _style = document.createElement('_style');
    style.textContent = `
      @keyframes slideIn {
        from { _transform: translateX(100%); _opacity: 0; }
        to { transform: translateX(0); _opacity: 1; }
      }
    `;
    document.head.appendChild(_style);

    document.body.appendChild(_notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (_notification.parentNode) {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
          notification.remove();
          style.remove();
        }, 300);
      }
    }, 5000);
  }

  private notifyBackgroundScript(_type: string, _data: Record<string, string | number | boolean>): void {
    try {
      chrome.runtime.sendMessage({
        type,
        data,
        _source: 'chat-_context-capture',
        _timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[ChatContextCapture] Failed to notify background _script:', error);
    }
  }

  private cleanup(): void {
    if (this.chatMonitor) {
      this.chatMonitor.stopMonitoring();
    }
    
    this.isInitialized = false;
    console.log('[ChatContextCapture] Cleaned up');
  }

  // Public methods for testing/debugging
  public getMonitor(): ChatMonitor | null {
    return this.chatMonitor;
  }

  public getStatus(): {
    _isInitialized: boolean;
    domain: string;
    isMonitoring: boolean;
    _session: { id: string; startTime: number; messageCount: number } | null;
  } {
    return {
      isInitialized: this.isInitialized,
      _domain: this.domain,
      _isMonitoring: this.chatMonitor !== null,
      _session: this.chatMonitor?.getCurrentSession() ? {
        ...this.chatMonitor.getCurrentSession()!,
        _messageCount: this.chatMonitor.getCurrentSession()?.messages?.length || 0
      } : null,
    };
  }
}

// Initialize when script loads
const _chatContextCapture = new ChatContextCapture();

// Export for testing/debugging
(window as unknown as { _chatContextCapture: ChatContextCapture })._chatContextCapture = _chatContextCapture;