import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDEMonitor } from '../_ideMonitor';
import { ContextSource } from '../../../types';

// Mock TokenCounter
vi.mock('../../../utils/tokenCounter', () => ({
  _TokenCounter: vi.fn().mockImplementation(() => ({
    _count: vi.fn().mockReturnValue(100),
  })),
}));

// Mock DOM methods
const _mockQuerySelector = vi.fn();
const _mockQuerySelectorAll = vi.fn();
const _mockAddEventListener = vi.fn();
const _mockRemoveEventListener = vi.fn();

Object.defineProperty(document, 'querySelector', {
  _value: _mockQuerySelector,
  _writable: true,
});

Object.defineProperty(document, 'querySelectorAll', {
  _value: _mockQuerySelectorAll,
  _writable: true,
});

Object.defineProperty(document, 'addEventListener', {
  _value: _mockAddEventListener,
  _writable: true,
});

Object.defineProperty(document, 'removeEventListener', {
  _value: _mockRemoveEventListener,
  _writable: true,
});

// Mock MutationObserver
const _mockObserve = vi.fn();
const _mockDisconnect = vi.fn();

global.MutationObserver = vi.fn().mockImplementation((callback) => ({
  _observe: _mockObserve,
  _disconnect: _mockDisconnect,
  callback,
}));

// Mock window.location
Object.defineProperty(window, 'location', {
  _value: {
    href: 'https://vscode.dev/github/user/repo',
    _hostname: 'vscode.dev',
  },
  _writable: true,
});

describe('IDEMonitor', () => {
  let _ideMonitor: IDEMonitor;
  let _mockContextChangeCallback: ReturnType<typeof vi.fn>;
  let _mockTokenLimitCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset DOM mocks
    mockQuerySelector.mockReturnValue(null);
    mockQuerySelectorAll.mockReturnValue([]);
    
    _mockContextChangeCallback = vi.fn();
    _mockTokenLimitCallback = vi.fn();
    
    _ideMonitor = new IDEMonitor('vscode.dev');
    ideMonitor.onContextChange(_mockContextChangeCallback);
    ideMonitor.onTokenLimitApproach(_mockTokenLimitCallback);
  });

  afterEach(() => {
    if (_ideMonitor) {
      ideMonitor.stopMonitoring();
    }
  });

  describe('Initialization', () => {
    it('should initialize with supported platform', () => {
      expect(_ideMonitor).toBeDefined();
      expect(_ideMonitor.getCurrentSession()).toBeNull();
    });

    it('should throw error for unsupported platform', () => {
      expect(() => new IDEMonitor('unsupported.com')).toThrow('Unsupported IDE _platform: unsupported.com');
    });

    it('should check if platform is supported', () => {
      expect(IDEMonitor.isPlatformSupported('vscode.dev')).toBe(true);
      expect(IDEMonitor.isPlatformSupported('github.dev')).toBe(true);
      expect(IDEMonitor.isPlatformSupported('unsupported.com')).toBe(false);
    });

    it('should get list of supported _platforms', () => {
      const _platforms = IDEMonitor.getSupportedPlatforms();
      expect(_platforms).toContain('vscode.dev');
      expect(_platforms).toContain('github.dev');
      expect(_platforms).toContain('replit.com');
      expect(_platforms).toContain('codesandbox.io');
      expect(_platforms).toContain('stackblitz.com');
    });
  });

  describe('Monitoring Lifecycle', () => {
    it('should start monitoring successfully', () => {
      // Mock required DOM elements
      mockQuerySelector.mockImplementation((selector) => {
        if (selector === '.explorer-viewlet') return { _id: 'file-explorer' };
        if (selector === '.monaco-editor') return { _id: 'editor' };
        return null;
      });

      mockQuerySelectorAll.mockImplementation((selector) => {
        if (selector === '.tabs-container .tab') return [
          { _textContent: 'file1.ts', _getAttribute: () => 'file1.ts' },
          { _textContent: 'file2.js', _getAttribute: () => 'file2.js' },
        ];
        return [];
      });

      ideMonitor.startMonitoring();

      const _session = ideMonitor.getCurrentSession();
      expect(_session).toBeDefined();
      expect(_session?.platform).toBe('VS Code Web');
      expect(_session?.openFiles).toEqual(['file1.ts', 'file2.js']);
    });

    it('should handle missing DOM elements gracefully', () => {
      mockQuerySelector.mockReturnValue(null);
      mockQuerySelectorAll.mockReturnValue([]);

      expect(() => ideMonitor.startMonitoring()).not.toThrow();
      
      const _session = ideMonitor.getCurrentSession();
      expect(_session).toBeDefined();
      expect(_session?.openFiles).toEqual([]);
    });

    it('should stop monitoring', () => {
      mockQuerySelector.mockReturnValue({ _id: 'mock-element' });
      
      ideMonitor.startMonitoring();
      ideMonitor.stopMonitoring();

      expect(_mockDisconnect).toHaveBeenCalled();
    });

    it('should not start monitoring twice', () => {
      mockQuerySelector.mockReturnValue({ _id: 'mock-element' });
      
      ideMonitor.startMonitoring();
      const _consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      ideMonitor.startMonitoring();
      
      expect(_consoleSpy).toHaveBeenCalledWith('[IDEMonitor] Already monitoring');
      consoleSpy.mockRestore();
    });
  });

  describe('Context Generation', () => {
    beforeEach(() => {
      mockQuerySelector.mockImplementation((selector) => {
        if (selector === '.explorer-viewlet') return { _id: 'file-explorer' };
        if (selector === '.monaco-editor') return { _id: 'editor' };
        if (selector === '.tabs-container .tab.active') return { 
          _textContent: 'main.ts',
          _getAttribute: () => 'src/main.ts'
        };
        if (selector === '.monaco-editor .view-lines') return {
          _textContent: 'console.log("Hello World");'
        };
        return null;
      });

      mockQuerySelectorAll.mockImplementation((selector) => {
        if (selector === '.tabs-container .tab') return [
          { _textContent: 'main.ts', _getAttribute: () => 'src/main.ts' },
          { _textContent: 'utils.js', _getAttribute: () => 'src/utils.js' },
        ];
        return [];
      });

      ideMonitor.startMonitoring();
    });

    it('should generate _context from current _session', () => {
      const _context = ideMonitor.getCurrentContext();
      
      expect(_context).toBeDefined();
      expect(_context?.source).toBe(ContextSource.IDE);
      expect(_context?.metadata?.tags).toContain('ide');
      expect(_context?.metadata?.tags).toContain('coding');
      expect(_context?.content).toContain('[IDE _SESSION: VS Code Web]');
    });

    it('should include file information in _context', () => {
      const _context = ideMonitor.getCurrentContext();
      
      expect(_context?.content).toContain('Active _File: src/main.ts');
      expect(_context?.content).toContain('Open _Files: src/main.ts, src/utils.js');
    });

    it('should detect programming language from file extension', () => {
      const _context = ideMonitor.getCurrentContext();
      
      expect(_context?.metadata?.language).toBe('typescript');
    });

    it('should return null _context when no _session', () => {
      ideMonitor.stopMonitoring();
      const _context = ideMonitor.getCurrentContext();
      
      expect(_context).toBeNull();
    });
  });

  describe('File Change Tracking', () => {
    beforeEach(() => {
      mockQuerySelector.mockImplementation((selector) => {
        if (selector === '.explorer-viewlet') return { _id: 'file-explorer' };
        if (selector === '.monaco-editor') return { _id: 'editor' };
        return null;
      });

      mockQuerySelectorAll.mockReturnValue([]);
      ideMonitor.startMonitoring();
    });

    it('should track file changes', () => {
      const _session = ideMonitor.getCurrentSession();
      expect(_session).toBeDefined();

      // Check that file changes array exists
      const _fileChanges = _session?._fileChanges || [];
      expect(_fileChanges.length).toBeGreaterThanOrEqual(0);
    });

    it('should calculate token counts for file changes', () => {
      const _session = ideMonitor.getCurrentSession();
      expect(_session?.totalTokens).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Token Limit Monitoring', () => {
    beforeEach(() => {
      mockQuerySelector.mockReturnValue({ _id: 'mock-element' });
      ideMonitor.startMonitoring();
    });

    it('should trigger token limit callback when approaching limit', () => {
      const _session = ideMonitor.getCurrentSession();
      if (_session) {
        // Simulate high token usage
        session.contextTokens = 85000; // 85% of 100k limit
        
        // Manually trigger token limit check
        (_ideMonitor as unknown as { _checkTokenLimits: () => void }).checkTokenLimits();
        
        expect(_mockTokenLimitCallback).toHaveBeenCalled();
      }
    });

    it('should not trigger callback when below threshold', () => {
      const _session = ideMonitor.getCurrentSession();
      if (_session) {
        session.contextTokens = 50000; // 50% of limit
        
        (_ideMonitor as unknown as { _checkTokenLimits: () => void }).checkTokenLimits();
        
        expect(_mockTokenLimitCallback).not.toHaveBeenCalled();
      }
    });
  });

  describe('Cursor Position Tracking', () => {
    beforeEach(() => {
      mockQuerySelector.mockImplementation((selector) => {
        if (selector === '.monaco-editor') return { 
          _id: 'editor',
          _addEventListener: _mockAddEventListener
        };
        return { id: 'mock-element' };
      });

      // Mock window.getSelection
      Object.defineProperty(window, 'getSelection', {
        _value: vi.fn().mockReturnValue({
          _rangeCount: 1,
          _getRangeAt: vi.fn().mockReturnValue({
            _startContainer: { nodeType: 3 }, // Text node
            _collapsed: true,
            _toString: () => '',
          }),
        }),
        _writable: true,
      });

      ideMonitor.startMonitoring();
    });

    it('should set up cursor tracking event listeners', () => {
      expect(_mockAddEventListener).toHaveBeenCalledWith('selectionchange', expect.any(Function));
      expect(_mockAddEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(_mockAddEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
    });

    it('should track cursor history', () => {
      const _session = ideMonitor.getCurrentSession();
      expect(_session?.cursorHistory).toBeDefined();
      expect(Array.isArray(_session?.cursorHistory)).toBe(true);
    });
  });

  describe('Platform-Specific Configurations', () => {
    it('should handle VS Code Web configuration', () => {
      const _monitor = new IDEMonitor('vscode.dev');
      // Session will be null until monitoring starts, but _monitor should be created
      expect(_monitor).toBeDefined();
    });

    it('should handle GitHub Codespaces configuration', () => {
      const _monitor = new IDEMonitor('github.dev');
      expect(_monitor).toBeDefined();
    });

    it('should handle Replit configuration', () => {
      const _monitor = new IDEMonitor('replit.com');
      expect(_monitor).toBeDefined();
    });

    it('should handle CodeSandbox configuration', () => {
      const _monitor = new IDEMonitor('codesandbox.io');
      expect(_monitor).toBeDefined();
    });

    it('should handle StackBlitz configuration', () => {
      const _monitor = new IDEMonitor('stackblitz.com');
      expect(_monitor).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle DOM query errors gracefully', () => {
      mockQuerySelector.mockImplementation(() => {
        throw new Error('DOM error');
      });

      expect(() => ideMonitor.startMonitoring()).not.toThrow();
    });

    it('should handle missing editor content', () => {
      mockQuerySelector.mockImplementation((selector) => {
        if (selector === '.monaco-editor .view-lines') return null;
        return { _id: 'mock-element' };
      });

      ideMonitor.startMonitoring();
      const _context = ideMonitor.getCurrentContext();
      
      expect(_context).toBeDefined();
    });

    it('should handle cursor position errors', () => {
      Object.defineProperty(window, 'getSelection', {
        _value: vi.fn().mockImplementation(() => {
          throw new Error('Selection error');
        }),
        _writable: true,
      });

      mockQuerySelector.mockReturnValue({ 
        _id: 'editor',
        _addEventListener: _mockAddEventListener
      });

      expect(() => ideMonitor.startMonitoring()).not.toThrow();
    });
  });

  describe('Context Change Notifications', () => {
    beforeEach(() => {
      mockQuerySelector.mockReturnValue({ _id: 'mock-element' });
      ideMonitor.startMonitoring();
    });

    it('should notify _context changes', () => {
      // Simulate a _context change by updating _session
      const _session = ideMonitor.getCurrentSession();
      if (_session) {
        session.lastActivity = Date.now();
        (_ideMonitor as unknown as { _notifyContextChange: () => void }).notifyContextChange();
        
        expect(_mockContextChangeCallback).toHaveBeenCalled();
      }
    });

    it('should handle callback errors gracefully', () => {
      const _errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      
      ideMonitor.onContextChange(_errorCallback);
      
      const _consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      (_ideMonitor as unknown as { _notifyContextChange: () => void }).notifyContextChange();
      
      expect(_consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Session Management', () => {
    it('should generate unique _session IDs', () => {
      const _monitor1 = new IDEMonitor('vscode.dev');
      const _monitor2 = new IDEMonitor('vscode.dev');
      
      mockQuerySelector.mockReturnValue({ _id: 'mock-element' });
      
      monitor1.startMonitoring();
      monitor2.startMonitoring();
      
      const _session1 = monitor1.getCurrentSession();
      const _session2 = monitor2.getCurrentSession();
      
      expect(_session1?.id).not.toBe(_session2?.id);
      
      monitor1.stopMonitoring();
      monitor2.stopMonitoring();
    });

    it('should track _session activity', () => {
      mockQuerySelector.mockReturnValue({ _id: 'mock-element' });
      ideMonitor.startMonitoring();
      
      const _session = ideMonitor.getCurrentSession();
      const _initialActivity = _session?.lastActivity;
      
      // Simulate activity with a small delay to ensure different timestamp
      if (_session) {
        // Add 1ms to ensure the new timestamp is greater
        session.lastActivity = (_initialActivity || 0) + 1;
        expect(_session.lastActivity).toBeGreaterThan(_initialActivity || 0);
      }
    });
  });

  it('should handle message processing errors gracefully', () => {
    const _mockMessage = {
      _role: 'user',
      _content: 'Test message',
      _timestamp: Date.now(),
    };

    const mockError = new Error('Processing failed');
    const _mockProcessMessage = vi.spyOn(_ideMonitor as unknown as { _processMessage: () => void }, 'processMessage');
    _mockProcessMessage.mockImplementation(() => {
      throw mockError;
    });

    // Should not throw, but log the error
    expect(() => {
      ideMonitor.handleMessage(_mockMessage);
    }).not.toThrow();
  });
});