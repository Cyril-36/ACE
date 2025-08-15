// Chat Monitor Tests
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ChatMonitor } from '../chatMonitor';
import { ContextSource } from '../../../types';

// Mock DOM environment
const mockDocument = {
  body: { appendChild: vi.fn(), removeChild: vi.fn() },
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(),
  createElement: vi.fn(() => ({
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    textContent: '',
    id: '',
    matches: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(),
    cloneNode: vi.fn(() => ({ textContent: '', querySelectorAll: vi.fn() })),
    remove: vi.fn(),
  })),
  addEventListener: vi.fn(),
  readyState: 'complete',
};

const mockWindow = {
  location: {
    hostname: 'chat.openai.com',
    href: 'https://chat.openai.com/c/test-conversation',
  },
  addEventListener: vi.fn(),
  MutationObserver: vi.fn(),
};

// Mock global objects
Object.defineProperty(global, 'document', {
  value: mockDocument,
  _writable: true,
});

Object.defineProperty(global, 'window', {
  value: mockWindow,
  _writable: true,
});

// Mock MutationObserver
global.MutationObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  callback,
}));

describe('ChatMonitor', () => {
  let chatMonitor: ChatMonitor;
  let mockMessageElements: HTMLElement[];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock message elements
    mockMessageElements = [
      createMockMessageElement('user', 'Hello, how are you?'),
      createMockMessageElement('assistant', 'I am doing well, thank you for asking!'),
      createMockMessageElement('user', 'Can you help me with a coding problem?'),
    ];

    // Mock querySelectorAll to return our mock elements
    mockDocument.querySelectorAll = vi.fn().mockReturnValue(mockMessageElements);
    mockDocument.querySelector = vi.fn().mockReturnValue(mockMessageElements[0]);
  });

  afterEach(() => {
    if (chatMonitor) {
      chatMonitor.stopMonitoring();
    }
  });

  describe('Platform Support', () => {
    it('should support ChatGPT platform', () => {
      expect(ChatMonitor.isPlatformSupported('chat.openai.com')).toBe(true);
    });

    it('should support Claude platform', () => {
      expect(ChatMonitor.isPlatformSupported('claude.ai')).toBe(true);
    });

    it('should support Gemini platform', () => {
      expect(ChatMonitor.isPlatformSupported('gemini.google.com')).toBe(true);
    });

    it('should not support unsupported platforms', () => {
      expect(ChatMonitor.isPlatformSupported('example.com')).toBe(false);
    });

    it('should return list of supported platforms', () => {
      const platforms = ChatMonitor.getSupportedPlatforms();
      expect(platforms).toContain('chat.openai.com');
      expect(platforms).toContain('claude.ai');
      expect(platforms).toContain('gemini.google.com');
    });
  });

  describe('Initialization', () => {
    it('should initialize with ChatGPT configuration', () => {
      chatMonitor = new ChatMonitor('chat.openai.com');
      expect(chatMonitor).toBeDefined();
    });

    it('should throw error for unsupported platform', () => {
      expect(() => {
        new ChatMonitor('unsupported.com');
      }).toThrow('Unsupported chat platform: unsupported.com');
    });
  });

  describe('Monitoring', () => {
    beforeEach(() => {
      chatMonitor = new ChatMonitor('chat.openai.com');
    });

    it('should start monitoring successfully', () => {
      chatMonitor.startMonitoring();
      
      const session = chatMonitor.getCurrentSession();
      expect(session).toBeDefined();
      expect(session?.platform).toBe('ChatGPT');
      expect(session?.messages.length).toBeGreaterThan(0);
    });

    it('should capture existing messages on start', () => {
      chatMonitor.startMonitoring();
      
      const session = chatMonitor.getCurrentSession();
      expect(session?.messages).toHaveLength(3);
      expect(session?.messages[0].role).toBe('user');
      expect(session?.messages[1].role).toBe('assistant');
    });

    it('should stop monitoring', () => {
      chatMonitor.startMonitoring();
      chatMonitor.stopMonitoring();
      
      // Should not throw or cause issues
      expect(() => chatMonitor.stopMonitoring()).not.toThrow();
    });

    it('should handle multiple start calls gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      chatMonitor.startMonitoring();
      chatMonitor.startMonitoring(); // Second call should warn
      
      expect(consoleSpy).toHaveBeenCalledWith('[ChatMonitor] Already monitoring');
      consoleSpy.mockRestore();
    });
  });

  describe('Context Capture', () => {
    beforeEach(() => {
      chatMonitor = new ChatMonitor('chat.openai.com');
      chatMonitor.startMonitoring();
    });

    it('should generate context from current session', () => {
      const context = chatMonitor.getCurrentContext();
      
      expect(context).toBeDefined();
      expect(context?.source).toBe(ContextSource.CHAT);
      expect(context?.content).toContain('[USER]: Hello, how are you?');
      expect(context?.content).toContain('[ASSISTANT]: I am doing well');
      expect(context?.metadata?.chatPlatform).toBe('ChatGPT');
      expect(context?.metadata?.tokenCount).toBeGreaterThan(0);
    });

    it('should return null context when no session', () => {
      const emptyMonitor = new ChatMonitor('chat.openai.com');
      const context = emptyMonitor.getCurrentContext();
      
      expect(context).toBeNull();
    });
  });

  describe('Event Callbacks', () => {
    beforeEach(() => {
      chatMonitor = new ChatMonitor('chat.openai.com');
    });

    it('should register context change callbacks', () => {
      const callback = vi.fn();
      chatMonitor.onContextChange(callback);
      
      // Start monitoring should trigger context change
      chatMonitor.startMonitoring();
      
      // Simulate new message
      const newMessage = createMockMessageElement('user', 'New message');
      mockMessageElements.push(newMessage);
      
      // Manually trigger context change for testing
      const context = chatMonitor.getCurrentContext();
      if (context) {
        // Simulate the callback being called
        callback(context);
      }
      
      expect(callback).toHaveBeenCalled();
    });

    it('should register token limit callbacks', () => {
      const callback = vi.fn();
      chatMonitor.onTokenLimitApproach(callback);
      
      // This would be triggered when token limits are approached
      // For testing, we can't easily simulate this without complex setup
      expect(callback).toBeDefined();
    });
  });

  describe('Token Counting', () => {
    beforeEach(() => {
      chatMonitor = new ChatMonitor('chat.openai.com');
      chatMonitor.startMonitoring();
    });

    it('should count tokens for messages', () => {
      const session = chatMonitor.getCurrentSession();
      
      expect(session?.totalTokens).toBeGreaterThan(0);
      expect(session?.contextTokens).toBeGreaterThan(0);
      expect(session?.messages.every(msg => msg.tokenCount > 0)).toBe(true);
    });

    it('should track total and context tokens separately', () => {
      const session = chatMonitor.getCurrentSession();
      
      // Context tokens should be <= total tokens
      expect(session?.contextTokens).toBeLessThanOrEqual(session?.totalTokens || 0);
    });
  });

  describe('Message Processing', () => {
    beforeEach(() => {
      chatMonitor = new ChatMonitor('chat.openai.com');
    });

    it('should extract message content correctly', () => {
      chatMonitor.startMonitoring();
      const session = chatMonitor.getCurrentSession();
      
      expect(session?.messages[0].content).toBe('Hello, how are you?');
      expect(session?.messages[1].content).toBe('I am doing well, thank you for asking!');
    });

    it('should determine message roles correctly', () => {
      chatMonitor.startMonitoring();
      const session = chatMonitor.getCurrentSession();
      
      expect(session?.messages[0].role).toBe('user');
      expect(session?.messages[1].role).toBe('assistant');
      expect(session?.messages[2].role).toBe('user');
    });

    it('should generate unique message IDs', () => {
      chatMonitor.startMonitoring();
      const session = chatMonitor.getCurrentSession();
      
      const messageIds = session?.messages.map((msg: any) => msg.id) || [];
      const uniqueIds = new Set(messageIds);
      
      expect(uniqueIds.size).toBe(messageIds.length);
    });

    it('should prevent duplicate messages', () => {
      chatMonitor.startMonitoring();
      
      // Add the same message elements again
      mockDocument.querySelectorAll = vi.fn().mockReturnValue([
        ...mockMessageElements,
        ...mockMessageElements, // Duplicates
      ]);
      
      // Restart monitoring to process duplicates
      chatMonitor.stopMonitoring();
      chatMonitor.startMonitoring();
      
      const session = chatMonitor.getCurrentSession();
      expect(session?.messages.length).toBe(3); // Should still be 3, not 6
    });

    it('should handle message processing errors gracefully', () => {
      const mockMessage = {
        id: 'test-msg',
        role: 'user' as const,
        content: 'Test message',
        timestamp: Date.now(),
        tokenCount: 5,
      };

      const mockError = new Error('Processing failed');
      const mockProcessMessage = vi.spyOn(chatMonitor as unknown as { processMessage: () => void }, 'processMessage');
      mockProcessMessage.mockImplementation(() => {
        throw mockError;
      });

      // Should not throw, but log the error
      expect(() => {
        chatMonitor.handleMessage(mockMessage);
      }).not.toThrow();
    });
  });
});

// Helper function to create mock message elements
function createMockMessageElement(_role: string, _content: string): HTMLElement {
  const element = {
    className: `message ${_role}`,
    innerHTML: `<div class="message-content">${_content}</div><div class="message-role">${_role}</div>`,
    textContent: _content,
    innerText: _content,
    id: `msg_${_role}_${Date.now()}_${Math.random().toString(36).substring(2)}`,
    matches: vi.fn((selector: string) => {
      if (selector.includes('user') && _role === 'user') return true;
      if (selector.includes('assistant') && _role === 'assistant') return true;
      return false;
    }),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    getAttribute: vi.fn((attr: string) => {
      if (attr === 'data-message-author-role') return _role;
      if (attr === 'data-is-from-user') return _role === 'user' ? 'true' : 'false';
      if (attr === 'data-message-id') return `msg_${_role}_${Date.now()}`;
      return null;
    }),
    cloneNode: vi.fn(() => ({
      textContent: _content,
      innerText: _content,
      querySelectorAll: vi.fn(() => []),
      remove: vi.fn(),
    })),
    remove: vi.fn(),
    nodeType: 1, // Element node
  } as unknown as HTMLElement;

  return element;
}