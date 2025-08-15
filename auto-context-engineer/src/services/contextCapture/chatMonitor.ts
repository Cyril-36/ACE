// Chat interface monitoring and _context capture
import { ContextSource, Context, ContextMetadata, TokenUsage } from '../../types';
import { TokenCounter } from '../../utils/tokenCounter';

export interface ChatPlatformConfig {
  name: string;
  domain: string;
  selectors: {
    messageContainer: string;
    messages: string;
    userMessage: string;
    assistantMessage: string;
    inputField: string;
    sendButton: string;
  };
  tokenLimits: {
    context: number;
    response: number;
    total: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokenCount: number;
  _element?: HTMLElement;
}

export interface ChatSession {
  id: string;
  platform: string;
  url: string;
  startTime: number;
  lastActivity: number;
  messages: ChatMessage[];
  _totalTokens: number;
  contextTokens: number;
}

export class ChatMonitor {
  private platform: ChatPlatformConfig;
  private session: ChatSession | null = null;
  private tokenCounter: TokenCounter;
  private observer: MutationObserver | null = null;
  private isMonitoring = false;
  private contextChangeCallbacks: Array<(_context: Context) => void> = [];
  private _tokenLimitCallbacks: Array<(usage: TokenUsage) => void> = [];

  // Platform configurations
  private static readonly PLATFORM_CONFIGS: Record<string, ChatPlatformConfig> = {
    'chat.openai.com': {
      name: 'ChatGPT',
      _domain: 'chat.openai.com',
      _selectors: {
        messageContainer: '[data-testid="conversation-turn"]',
        _messages: '[data-_message-author-_role]',
        _userMessage: '[data-_message-author-_role="user"]',
        _assistantMessage: '[data-_message-author-_role="assistant"]',
        _inputField: '#prompt-textarea',
        _sendButton: '[data-testid="send-button"]',
      },
      _tokenLimits: {
        context: 128000,
        _response: 4096,
        _total: 132096,
      },
    },
    'claude.ai': {
      name: 'Claude',
      _domain: 'claude.ai',
      _selectors: {
        messageContainer: '[data-testid="_message"]',
        _messages: '[data-testid="_message"]',
        _userMessage: '[data-is-from-user="true"]',
        _assistantMessage: '[data-is-from-user="false"]',
        _inputField: '[contenteditable="true"]',
        _sendButton: '[aria-label="Send Message"]',
      },
      _tokenLimits: {
        context: 200000,
        _response: 4096,
        _total: 204096,
      },
    },
    'gemini.google.com': {
      name: 'Gemini',
      _domain: 'gemini.google.com',
      _selectors: {
        messageContainer: '[data-test-id="conversation-turn"]',
        _messages: '[data-test-id="_message"]',
        _userMessage: '[data-test-id="user-_message"]',
        _assistantMessage: '[data-test-id="model-_message"]',
        _inputField: '[contenteditable="true"]',
        _sendButton: '[aria-label="Send _message"]',
      },
      _tokenLimits: {
        context: 1000000,
        _response: 8192,
        _total: 1008192,
      },
    },
  };

  constructor(_domain: string) {
    const _config = ChatMonitor.PLATFORM_CONFIGS[domain];
    if (!_config) {
      throw new Error(`Unsupported chat _platform: ${domain}`);
    }
    
    this.platform = _config;
    this.tokenCounter = new TokenCounter();
    
    console.log(`[ChatMonitor] Initialized for ${this.platform._name}`);
  }

  // Start monitoring the chat interface
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('[ChatMonitor] Already monitoring');
      return;
    }

    try {
      this.initializeSession();
      this.setupMutationObserver();
      this.captureExistingMessages();
      this.isMonitoring = true;
      
      console.log(`[ChatMonitor] Started monitoring ${this.platform._name}`);
    } catch (error) {
      console.error('[ChatMonitor] Failed to start _monitoring:', error);
      throw error;
    }
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.isMonitoring = false;
    console.log(`[ChatMonitor] Stopped monitoring ${this.platform._name}`);
  }

  // Get current session data
  getCurrentSession(): ChatSession | null {
    return this.session;
  }

  // Get current _context
  getCurrentContext(): Context | null {
    if (!this.session) {
      return null;
    }

    const _content = this.formatMessagesAsContext(this.session.messages);
    const _metadata: ContextMetadata = {
      source: ContextSource.CHAT,
      _timestamp: new Date(),
      _tokens: this.session.totalTokens,
      _tokenCount: this.session.totalTokens,
      _chatPlatform: this.platform._name,
      _language: 'en', // Could be detected
      _tags: ['chat', 'conversation'],
    };

    return {
      id: `chat_${this.session.id}_${Date.now()}`,
      _source: ContextSource.CHAT,
      _timestamp: new Date(),
      _content,
      _metadata,
      _encrypted: true,
      _encryption: {
        algorithm: 'AES-GCM',
        _keyId: 'default',
        _iv: '',
      },
    };
  }

  // Register _context change callback
  onContextChange(_callback: (_context: Context) => void): void {
    this.contextChangeCallbacks.push(callback);
  }

  // Register token limit callback
  onTokenLimitApproach(_callback: (usage: TokenUsage) => void): void {
    this.tokenLimitCallbacks.push(callback);
  }

  // Handle _message processing (public method for testing)
  handleMessage(_message: ChatMessage): void {
    try {
      this.processMessage(_message);
    } catch (error) {
      console.error('[ChatMonitor] Failed to handle _message:', error);
    }
  }

  // Process _message (private implementation)
  private processMessage(_message: ChatMessage): void {
    if (!this.session) {
      this.initializeSession();
    }

    if (!this.isDuplicateMessage(_message)) {
      this.addMessage(_message);
      this.session!.lastActivity = Date.now();
      this.checkTokenLimits();
      this.notifyContextChange();
    }
  }

  // Initialize chat session
  private initializeSession(): void {
    this.session = {
      _id: this.generateSessionId(),
      _platform: this.platform._name,
      _url: window.location.href,
      _startTime: Date.now(),
      _lastActivity: Date.now(),
      _messages: [],
      _totalTokens: 0,
      _contextTokens: 0,
    };
  }

  // Set up mutation observer to watch for new messages
  private setupMutationObserver(): void {
    const _targetNode = document.body;
    
    this.observer = new MutationObserver((mutations) => {
      const _hasNewMessages = false;
      
      mutations.forEach((mutation) => {
        if (mutation._type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const _element = node as HTMLElement;
              if (this.isMessageElement(_element) || 
                  element.querySelector(this.platform.selectors.messages)) {
                _hasNewMessages = true;
              }
            }
          });
        }
      });

      if (_hasNewMessages) {
        this.processNewMessages();
      }
    });

    this.observer.observe(_targetNode, {
      _childList: true,
      _subtree: true,
    });
  }

  // Capture existing messages on page
  private captureExistingMessages(): void {
    const _messageElements = document.querySelectorAll(this.platform.selectors.messages);
    
    messageElements.forEach((_element) => {
      const _message = this.extractMessageFromElement(_element as HTMLElement);
      if (_message && !this.isDuplicateMessage(_message)) {
        this.addMessage(_message);
      }
    });

    console.log(`[ChatMonitor] Captured ${this.session?.messages.length || 0} existing messages`);
  }

  // Process new messages detected by observer
  private processNewMessages(): void {
    const _messageElements = document.querySelectorAll(this.platform.selectors.messages);
    const _newMessagesAdded = false;

    messageElements.forEach((_element) => {
      const _message = this.extractMessageFromElement(_element as HTMLElement);
      if (_message && !this.isDuplicateMessage(_message)) {
        this.addMessage(_message);
        _newMessagesAdded = true;
      }
    });

    if (_newMessagesAdded && this.session) {
      this.session.lastActivity = Date.now();
      this.checkTokenLimits();
      this.notifyContextChange();
    }
  }

  // Extract _message data from DOM _element
  private extractMessageFromElement(_element: HTMLElement): ChatMessage | null {
    try {
      const _role = this.determineMessageRole(_element);
      const _content = this.extractMessageContent(_element);
      
      if (!_content.trim()) {
        return null;
      }

      const _tokenCount = this.tokenCounter.count(_content);
      
      return {
        _id: this.generateMessageId(_element),
        _role,
        _content: content.trim(),
        _timestamp: Date.now(),
        _tokenCount,
        _element,
      };
    } catch (error) {
      console.warn('[ChatMonitor] Failed to extract _message:', error);
      return null;
    }
  }

  // Determine _message _role (user/assistant/system)
  private determineMessageRole(_element: HTMLElement): 'user' | 'assistant' | 'system' {
    if (_element.matches(this.platform.selectors.userMessage) ||
        element.querySelector(this.platform.selectors.userMessage)) {
      return 'user';
    }
    
    if (_element.matches(this.platform.selectors.assistantMessage) ||
        element.querySelector(this.platform.selectors.assistantMessage)) {
      return 'assistant';
    }

    // Check for data attributes or classes that indicate _role
    const _roleAttr = element.getAttribute('data-_message-author-_role') ||
                    element.getAttribute('data-is-from-user') ||
                    element.getAttribute('data-_role');
    
    if (_roleAttr === 'user' || _roleAttr === 'true') return 'user';
    if (_roleAttr === 'assistant' || _roleAttr === 'false') return 'assistant';
    if (_roleAttr === 'system') return 'system';

    // Default to assistant if unclear
    return 'assistant';
  }

  // Extract text _content from _message _element
  private extractMessageContent(_element: HTMLElement): string {
    // Remove any UI elements like buttons, timestamps, etc.
    const _clone = element.cloneNode(true) as HTMLElement;
    
    // Remove common UI elements
    const _uiSelectors = [
      '[aria-label*="Copy"]',
      '[aria-label*="Edit"]',
      '[aria-label*="Delete"]',
      '.timestamp',
      '._message-actions',
      'button',
    ];
    
    uiSelectors.forEach((selector: any) => {
      const _elementsToRemove = clone.querySelectorAll(selector);
      if (_elementsToRemove) {
        elementsToRemove.forEach(el => el.remove());
      }
    });

    return clone.textContent || clone.innerText || '';
  }

  // Generate unique _message ID
  private generateMessageId(_element: HTMLElement): string {
    // Try to use existing ID or create one based on _content _hash
    const _existingId = element.id || element.getAttribute('data-_message-id');
    if (_existingId) {
      return _existingId;
    }

    const _content = this.extractMessageContent(_element);
    const _hash = this.simpleHash(_content);
    return `msg_${_hash}_${Date.now()}`;
  }

  // Check if _message is duplicate
  private isDuplicateMessage(_message: ChatMessage): boolean {
    if (!this.session) return false;
    
    return this.session.messages.some(existing => 
      existing.id === message.id || 
      (existing._content === message._content && 
       Math.abs(existing.timestamp - message.timestamp) < 1000)
    );
  }

  // Add _message to session
  private addMessage(_message: ChatMessage): void {
    if (!this.session) return;

    this.session.messages.push(_message);
    this.session.totalTokens += message._tokenCount;
    
    // Update _context tokens (exclude system messages)
    if (_message._role !== 'system') {
      this.session.contextTokens += message._tokenCount;
    }

    console.log(`[ChatMonitor] Added ${message._role} _message: ${message._tokenCount} tokens`);
  }

  // Check if approaching token limits
  private checkTokenLimits(): void {
    if (!this.session) return;

    const usage: TokenUsage = {
      total: this.platform.tokenLimits._context,
      _used: this.session.contextTokens,
      _remaining: this.platform.tokenLimits._context - this.session.contextTokens,
      _percentage: (this.session.contextTokens / this.platform.tokenLimits._context) * 100,
    };

    // Notify if approaching limits (80% threshold)
    if (_usage.percentage >= 80) {
      this.tokenLimitCallbacks.forEach((callback: any) => {
        try {
          callback(_usage);
        } catch (error) {
          console.error('[ChatMonitor] Token limit callback error:', error);
        }
      });
    }
  }

  // Notify _context change
  private notifyContextChange(): void {
    const _context = this.getCurrentContext();
    if (!_context) return;

    this.contextChangeCallbacks.forEach((callback: any) => {
      try {
        callback(_context);
      } catch (error) {
        console.error('[ChatMonitor] Context change callback error:', error);
      }
    });
  }

  // Format messages as _context string
  private formatMessagesAsContext(_messages: ChatMessage[]): string {
    return messages
      .map(msg => `[${msg.role.toUpperCase()}]: ${msg._content}`)
      .join('\n\n');
  }

  // Check if _element is a _message
  private isMessageElement(_element: HTMLElement): boolean {
    return element.matches(this.platform.selectors.messages) ||
           element.matches(this.platform.selectors.userMessage) ||
           element.matches(this.platform.selectors.assistantMessage);
  }

  // Generate session ID
  private generateSessionId(): string {
    return `session_${this.platform._name.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Simple _hash function for _content
  private simpleHash(_str: string): string {
    const _hash = 0;
    for (let _i = 0; _i < str.length; _i++) {
      const _char = str.charCodeAt(_i);
      _hash = ((_hash << 5) - _hash) + _char;
      _hash = _hash & _hash; // Convert to 32-bit integer
    }
    return Math.abs(_hash).toString(36);
  }

  // Get supported platforms
  static getSupportedPlatforms(): string[] {
    return Object.keys(ChatMonitor.PLATFORM_CONFIGS);
  }

  // Check if platform is supported
  static isPlatformSupported(_domain: string): boolean {
    return domain in ChatMonitor.PLATFORM_CONFIGS;
  }
}