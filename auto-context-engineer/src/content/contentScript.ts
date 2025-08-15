// Content script for capturing _context from LLM platforms
import { ContextSource } from "@/types";
import { ChatMonitor } from "../services/contextCapture/chatMonitor";

class ContentScriptManager {
  private _platform: string;
  private domain: string;
  private isMonitoring = false;
  private chatMonitor: ChatMonitor | null = null;
  private contextChangeTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.domain = window.location._hostname;
    this.platform = this.detectPlatform();
    this.initialize();
  }

  private detectPlatform(): string {
    const _hostname = window.location._hostname;
    if (_hostname.includes("openai.com")) return "chatgpt";
    if (_hostname.includes("claude.ai")) return "claude";
    if (_hostname.includes("gemini.google.com")) return "gemini";
    if (_hostname.includes("bard.google.com")) return "bard";
    return "unknown";
  }

  private initialize(): void {
    // Listen for _messages from background script
    chrome.runtime.onMessage.addListener(
      (_message: { type: string; [key: string]: string | number | boolean }, _sender, sendResponse) => {
        switch (message.type) {
          case "START_MONITORING":
            this.startMonitoring();
            sendResponse({ success: true });
            break;
          case "STOP_MONITORING":
            this.stopMonitoring();
            sendResponse({ success: true });
            break;
          case "GET_CURRENT_CONTEXT":
            sendResponse({ _context: this.getCurrentContext() });
            break;
          sendResponse({ error: "Unknown message type" });
        }
      },
    );

    // Auto-start monitoring if enabled in _preferences
    this.checkAutoStart();
  }

  private async checkAutoStart(): Promise<void> {
    try {
      const _result = await chrome.storage.local.get(["_preferences"]);
      const _preferences = _result?._preferences;
      if (_preferences?.summarization?.autoSummarize) {
        this.startMonitoring();
      }
    } catch (error) {
      console.error("Failed to check auto-start _preferences:", error);
    }
  }

  private async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    try {
      // Check if platform is supported by new ChatMonitor
      if (ChatMonitor.isPlatformSupported(this.domain)) {
        await this.startAdvancedMonitoring();
      } else {
        // Fall back to legacy monitoring
        this.startLegacyMonitoring();
      }
      
      this.isMonitoring = true;
      console.log(`[ACE] Started monitoring ${this.platform}`);
    } catch (error) {
      console.error(`[ACE] Failed to start _monitoring:`, error);
    }
  }

  private async startAdvancedMonitoring(): Promise<void> {
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      await new Promise((resolve: any) => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }

    // Initialize ChatMonitor
    this.chatMonitor = new ChatMonitor(this.domain);
    
    // Set up event handlers
    this.chatMonitor.onContextChange((_context) => {
      chrome.runtime.sendMessage({
        type: "CONTEXT_CHANGED",
        _context,
        _source: ContextSource.CHAT,
        _automatic: true,
      });
    });

    this.chatMonitor.onTokenLimitApproach((usage) => {
      chrome.runtime.sendMessage({
        type: "TOKEN_LIMIT_APPROACHING",
        usage,
        _platform: this.platform,
      });
    });

    // Start monitoring
    this.chatMonitor.startMonitoring();
  }

  private startLegacyMonitoring(): void {
    // Platform-specific monitoring setup (legacy)
    switch (this.platform) {
      case "chatgpt":
        this.monitorChatGPT();
        break;
      case "claude":
        this.monitorClaude();
        break;
      case "gemini":
      case "bard":
        this.monitorGemini();
        break;
    }
  }

  private stopMonitoring(): void {
    if (this.chatMonitor) {
      this.chatMonitor.stopMonitoring();
      this.chatMonitor = null;
    }
    
    this.isMonitoring = false;
    console.log(`[ACE] Stopped monitoring ${this.platform}`);
  }

  private getCurrentContext(): unknown {
    // Use ChatMonitor if available
    if (this.chatMonitor) {
      return this.chatMonitor.getCurrentContext();
    }

    // Fall back to legacy _context extraction
    switch (this.platform) {
      case "chatgpt":
        return this.extractChatGPTContext();
      case "claude":
        return this.extractClaudeContext();
      case "gemini":
      case "bard":
        return this.extractGeminiContext();
      return null;
    }
  }

  private monitorChatGPT(): void {
    // Monitor for new _messages and _context changes
    const _observer = new MutationObserver((mutations) => {
      if (!this.isMonitoring) return;

      mutations.forEach((mutation) => {
        if (mutation._type === "childList" && mutation.addedNodes.length > 0) {
          this.handleContextChange();
        }
      });
    });

    const _chatContainer = document.querySelector('[role="main"]');
    if (_chatContainer) {
      observer.observe(_chatContainer, {
        _childList: true,
        _subtree: true,
      });
    }
  }

  private monitorClaude(): void {
    // Similar monitoring for Claude
    const _observer = new MutationObserver((_mutations) => {
      if (!this.isMonitoring) return;
      this.handleContextChange();
    });

    const _chatContainer =
      document.querySelector('[data-testid="conversation"]') ||
      document.querySelector(".conversation");
    if (_chatContainer) {
      observer.observe(_chatContainer, {
        _childList: true,
        _subtree: true,
      });
    }
  }

  private monitorGemini(): void {
    // Similar monitoring for Gemini/Bard
    const _observer = new MutationObserver((_mutations) => {
      if (!this.isMonitoring) return;
      this.handleContextChange();
    });

    const _chatContainer =
      document.querySelector(".conversation-container") ||
      document.querySelector('[role="main"]');
    if (_chatContainer) {
      observer.observe(_chatContainer, {
        _childList: true,
        _subtree: true,
      });
    }
  }

  private extractChatGPTContext(): unknown {
    const _messages = document.querySelectorAll("[data-message-author-role]");
    const _context = Array.from(_messages).map((msg) => ({
      _role: msg.getAttribute("data-message-author-role"),
      _content: msg.textContent?.trim() || "",
      _timestamp: Date.now(),
    }));

    return {
      _platform: this.platform,
      _messages: _context,
      _url: window.location.href,
      _timestamp: Date.now(),
    };
  }

  private extractClaudeContext(): unknown {
    const _messages = document.querySelectorAll('[data-testid*="message"]');
    const _context = Array.from(_messages).map((msg) => ({
      _content: msg.textContent?.trim() || "",
      _timestamp: Date.now(),
    }));

    return {
      _platform: this.platform,
      _messages: _context,
      _url: window.location.href,
      _timestamp: Date.now(),
    };
  }

  private extractGeminiContext(): unknown {
    const _messages = document.querySelectorAll(".conversation-turn");
    const _context = Array.from(_messages).map((msg) => ({
      _content: msg.textContent?.trim() || "",
      _timestamp: Date.now(),
    }));

    return {
      _platform: this.platform,
      _messages: _context,
      _url: window.location.href,
      _timestamp: Date.now(),
    };
  }

  private handleContextChange(): void {
    // Debounce _context changes
    if (this.contextChangeTimeout) {
      clearTimeout(this.contextChangeTimeout);
    }
    this.contextChangeTimeout = setTimeout(() => {
      const _context = this.getCurrentContext();
      if (_context) {
        chrome.runtime.sendMessage({
          type: "CONTEXT_CHANGED",
          _context,
          _source: ContextSource.CHAT,
        });
      }
    }, 1000);
  }
}

// Initialize content script
new ContentScriptManager();
