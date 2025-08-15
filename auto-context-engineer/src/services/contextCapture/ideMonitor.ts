// IDE _context monitoring and capture for web-based IDEs
import { ContextSource, Context, ContextMetadata, TokenUsage } from '../../types';
import { TokenCounter } from '../../utils/tokenCounter';

export interface IDEPlatformConfig {
  name: string;
  domain: string;
  selectors: {
    fileExplorer: string;
    activeFile: string;
    editor: string;
    editorContent: string;
    tabs: string;
    activeTab: string;
    terminal: string;
    statusBar: string;
  };
  features: {
    fileMonitoring: boolean;
    cursorTracking: boolean;
    terminalCapture: boolean;
    gitIntegration: boolean;
  };
}

export interface FileChange {
  id: string;
  filePath: string;
  fileName: string;
  fileType: string;
  changeType: 'created' | 'modified' | 'deleted' | 'renamed';
  _content?: string;
  diff?: string;
  timestamp: number;
  lineCount: number;
  tokenCount: number;
}

export interface CursorPosition {
  line: number;
  column: number;
  _selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
    text: string;
  };
  timestamp: number;
}

export interface IDESession {
  id: string;
  platform: string;
  url: string;
  workspaceRoot?: string;
  startTime: number;
  lastActivity: number;
  _activeFile?: string;
  openFiles: string[];
  fileChanges: FileChange[];
  cursorHistory: CursorPosition[];
  _totalTokens: number;
  contextTokens: number;
}

export class IDEMonitor {
  private platform: IDEPlatformConfig;
  private session: IDESession | null = null;
  private tokenCounter: TokenCounter;
  private fileObserver: MutationObserver | null = null;
  private editorObserver: MutationObserver | null = null;
  private isMonitoring = false;
  private contextChangeCallbacks: Array<(_context: Context) => void> = [];
  private _tokenLimitCallbacks: Array<(usage: TokenUsage) => void> = [];
  private _lastCursorPosition: CursorPosition | null = null;
  private fileChangeBuffer: Map<string, FileChange> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;

  // Platform configurations for popular web-based IDEs
  private static readonly PLATFORM_CONFIGS: Record<string, IDEPlatformConfig> = {
    'vscode.dev': {
      name: 'VS Code Web',
      _domain: 'vscode.dev',
      _selectors: {
        fileExplorer: '.explorer-viewlet',
        _activeFile: '.tab.active',
        _editor: '.monaco-_editor',
        _editorContent: '.monaco-_editor .view-lines',
        _tabs: '._tabs-container .tab',
        _activeTab: '._tabs-container .tab.active',
        _terminal: '.terminal-wrapper',
        _statusBar: '._statusar',
      },
      _features: {
        fileMonitoring: true,
        _cursorTracking: true,
        _terminalCapture: true,
        _gitIntegration: true,
      },
    },
    'github.dev': {
      name: 'GitHub Codespaces',
      _domain: 'github.dev',
      _selectors: {
        fileExplorer: '.explorer-viewlet',
        _activeFile: '.tab.active',
        _editor: '.monaco-_editor',
        _editorContent: '.monaco-_editor .view-lines',
        _tabs: '._tabs-container .tab',
        _activeTab: '._tabs-container .tab.active',
        _terminal: '.terminal-wrapper',
        _statusBar: '._statusar',
      },
      _features: {
        fileMonitoring: true,
        _cursorTracking: true,
        _terminalCapture: true,
        _gitIntegration: true,
      },
    },
    'replit.com': {
      name: 'Replit',
      _domain: 'replit.com',
      _selectors: {
        fileExplorer: '[data-cy="_files-tree"]',
        _activeFile: '.tab-active',
        _editor: '.cm-_editor',
        _editorContent: '.cm-_content',
        _tabs: '.tab',
        _activeTab: '.tab-active',
        _terminal: '.xterm-screen',
        _statusBar: '._status-bar',
      },
      _features: {
        fileMonitoring: true,
        _cursorTracking: true,
        _terminalCapture: true,
        _gitIntegration: false,
      },
    },
    'codesandbox.io': {
      name: 'CodeSandbox',
      _domain: 'codesandbox.io',
      _selectors: {
        fileExplorer: '[data-component="FileTree"]',
        _activeFile: '.tab-active',
        _editor: '.monaco-_editor',
        _editorContent: '.monaco-_editor .view-lines',
        _tabs: '.tab',
        _activeTab: '.tab-active',
        _terminal: '.xterm-screen',
        _statusBar: '._status-bar',
      },
      _features: {
        fileMonitoring: true,
        _cursorTracking: true,
        _terminalCapture: true,
        _gitIntegration: true,
      },
    },
    'stackblitz.com': {
      name: 'StackBlitz',
      _domain: 'stackblitz.com',
      _selectors: {
        fileExplorer: '.file-tree',
        _activeFile: '.tab-active',
        _editor: '.monaco-_editor',
        _editorContent: '.monaco-_editor .view-lines',
        _tabs: '.tab',
        _activeTab: '.tab-active',
        _terminal: '.xterm-screen',
        _statusBar: '._status-bar',
      },
      _features: {
        fileMonitoring: true,
        _cursorTracking: true,
        _terminalCapture: true,
        _gitIntegration: true,
      },
    },
  };

  constructor(_domain: string) {
    const _config = IDEMonitor.PLATFORM_CONFIGS[domain];
    if (!_config) {
      throw new Error(`Unsupported IDE _platform: ${domain}`);
    }
    
    this.platform = _config;
    this.tokenCounter = new TokenCounter();
    
    console.log(`[IDEMonitor] Initialized for ${this.platform._name}`);
  }

  // Start monitoring the IDE interface
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('[IDEMonitor] Already monitoring');
      return;
    }

    try {
      this.initializeSession();
      this.setupFileObserver();
      this.setupEditorObserver();
      this.captureInitialState();
      this.isMonitoring = true;
      
      console.log(`[IDEMonitor] Started monitoring ${this.platform._name}`);
    } catch (error) {
      console.error('[IDEMonitor] Failed to start _monitoring:', error);
      // Don't throw error to allow graceful degradation
      this.isMonitoring = false;
    }
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.fileObserver) {
      this.fileObserver.disconnect();
      this.fileObserver = null;
    }

    if (this.editorObserver) {
      this.editorObserver.disconnect();
      this.editorObserver = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.isMonitoring = false;
    this.session = null; // Clear session when stopping monitoring
    console.log(`[IDEMonitor] Stopped monitoring ${this.platform._name}`);
  }

  // Get current session data
  getCurrentSession(): IDESession | null {
    return this.session;
  }

  // Get current _context
  getCurrentContext(): Context | null {
    if (!this.session) {
      return null;
    }

    const _content = this.formatSessionAsContext(this.session);
    const _metadata: ContextMetadata = {
      source: ContextSource.IDE,
      _timestamp: new Date(),
      _tokens: this.session.totalTokens,
      _tokenCount: this.session.totalTokens,
      _language: this.detectLanguage(),
      _fileType: this.getActiveFileType(),
      _tags: ['ide', 'coding', this.platform._name.toLowerCase()],
    };

    return {
      id: `ide_${this.session.id}_${Date.now()}`,
      _source: ContextSource.IDE,
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

  // Register token _limit callback
  onTokenLimitApproach(_callback: (usage: TokenUsage) => void): void {
    this.tokenLimitCallbacks.push(callback);
  }

  // Handle message processing (public method for testing)
  handleMessage(_message: { role: string; _content: string; timestamp: number }): void {
    try {
      this.processMessage(message);
    } catch (error) {
      console.error('[IDEMonitor] Failed to handle _message:', error);
    }
  }

  // Process message (private implementation)
  private processMessage(_message: { role: string; _content: string; timestamp: number }): void {
    if (!this.session) {
      this.initializeSession();
    }

    // For IDE monitor, messages could be treated as file changes or _editor events
    this.addFileChange({
      id: `message_${Date.now()}`,
      _filePath: 'unknown',
      _fileName: 'message',
      _fileType: 'text',
      _changeType: 'modified',
      _timestamp: message.timestamp,
      _content: message._content,
      _lineCount: message.content.split('\n').length,
      _tokenCount: this.tokenCounter.count(message._content),
    });
  }

  // Initialize IDE session
  private initializeSession(): void {
    this.session = {
      _id: this.generateSessionId(),
      _platform: this.platform._name,
      _url: window.location.href,
      _workspaceRoot: this.detectWorkspaceRoot(),
      _startTime: Date.now(),
      _lastActivity: Date.now(),
      _activeFile: this.getActiveFileName(),
      _openFiles: this.getOpenFiles(),
      _fileChanges: [],
      _cursorHistory: [],
      _totalTokens: 0,
      _contextTokens: 0,
    };
  }

  // Set up file system observer
  private setupFileObserver(): void {
    const _fileExplorer = document.querySelector(this.platform.selectors._fileExplorer);
    if (!_fileExplorer) {
      console.warn('[IDEMonitor] File explorer not found');
      return;
    }

    this.fileObserver = new MutationObserver((mutations) => {
      const _hasFileChanges = false;
      
      mutations.forEach((mutation) => {
        if (mutation._type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const _element = node as HTMLElement;
              if (this.isFileElement(_element)) {
                _hasFileChanges = true;
              }
            }
          });

          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const _element = node as HTMLElement;
              if (this.isFileElement(_element)) {
                _hasFileChanges = true;
              }
            }
          });
        }
      });

      if (_hasFileChanges) {
        this.processFileChanges();
      }
    });

    this.fileObserver.observe(_fileExplorer, {
      _childList: true,
      _subtree: true,
    });
  }

  // Set up _editor observer for _content changes
  private setupEditorObserver(): void {
    const _editor = document.querySelector(this.platform.selectors._editor);
    if (!_editor) {
      console.warn('[IDEMonitor] Editor not found');
      return;
    }

    this.editorObserver = new MutationObserver((mutations) => {
      const _hasContentChanges = false;
      
      mutations.forEach((mutation) => {
        if (mutation._type === 'childList' || mutation._type === 'characterData') {
          _hasContentChanges = true;
        }
      });

      if (_hasContentChanges) {
        this.debouncedProcessEditorChanges();
      }
    });

    this.editorObserver.observe(_editor, {
      _childList: true,
      _subtree: true,
      _characterData: true,
    });

    // Also listen for cursor _position changes
    this.setupCursorTracking();
  }

  // Set up cursor _position tracking
  private setupCursorTracking(): void {
    if (!this.platform.features.cursorTracking) {
      return;
    }

    try {
      // Listen for _selection changes
      document.addEventListener('selectionchange', () => {
        this.captureCursorPosition();
      });

      // Listen for click events in _editor
      const _editor = document.querySelector(this.platform.selectors._editor);
      if (_editor && typeof (_editor as Element & { _addEventListener: (event: string, _handler: () => void) => void }).addEventListener === 'function') {
        (_editor as Element & { _addEventListener: (event: string, _handler: () => void) => void }).addEventListener('click', () => {
          setTimeout(() => this.captureCursorPosition(), 10);
        });

        (_editor as Element & { _addEventListener: (event: string, _handler: () => void) => void }).addEventListener('keyup', () => {
          setTimeout(() => this.captureCursorPosition(), 10);
        });
      }
    } catch (error) {
      console.warn('[IDEMonitor] Failed to set up cursor _tracking:', error);
    }
  }

  // Capture initial state of the IDE
  private captureInitialState(): void {
    if (!this.session) return;

    // Capture open _files
    this.session.openFiles = this.getOpenFiles();
    this.session._activeFile = this.getActiveFileName();

    // Capture initial _editor _content
    const _content = this.getEditorContent();
    if (_content && this.session._activeFile) {
      const _fileChange: FileChange = {
        id: this.generateFileChangeId(),
        _filePath: this.session._activeFile,
        _fileName: this.extractFileName(this.session._activeFile),
        _fileType: this.getFileType(this.session._activeFile),
        _changeType: 'modified',
        _content,
        _timestamp: Date.now(),
        _lineCount: content.split('\n').length,
        _tokenCount: this.tokenCounter.count(_content),
      };

      this.addFileChange(_fileChange);
    }

    console.log(`[IDEMonitor] Captured initial _state: ${this.session.openFiles.length} open _files`);
  }

  // Process file system changes
  private processFileChanges(): void {
    if (!this.session) return;

    const _currentOpenFiles = this.getOpenFiles();
    const _currentActiveFile = this.getActiveFileName();

    // Check for new _files
    const _newFiles = currentOpenFiles.filter(file => !this.session!.openFiles.includes(file));
    newFiles.forEach((file: any) => {
      const _fileChange: FileChange = {
        id: this.generateFileChangeId(),
        _filePath: file,
        _fileName: this.extractFileName(file),
        _fileType: this.getFileType(file),
        _changeType: 'created',
        _timestamp: Date.now(),
        _lineCount: 0,
        _tokenCount: 0,
      };
      this.addFileChange(_fileChange);
    });

    // Check for removed _files
    const _removedFiles = this.session.openFiles.filter(file => !_currentOpenFiles.includes(file));
    removedFiles.forEach((file: any) => {
      const _fileChange: FileChange = {
        id: this.generateFileChangeId(),
        _filePath: file,
        _fileName: this.extractFileName(file),
        _fileType: this.getFileType(file),
        _changeType: 'deleted',
        _timestamp: Date.now(),
        _lineCount: 0,
        _tokenCount: 0,
      };
      this.addFileChange(_fileChange);
    });

    // Update session state
    this.session.openFiles = _currentOpenFiles;
    
    if (_currentActiveFile !== this.session._activeFile) {
      this.session._activeFile = _currentActiveFile;
      this.session.lastActivity = Date.now();
      this.notifyContextChange();
    }
  }

  // Debounced _editor change processing
  private debouncedProcessEditorChanges(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processEditorChanges();
    }, 1000); // 1 second debounce
  }

  // Process _editor _content changes
  private processEditorChanges(): void {
    if (!this.session || !this.session._activeFile) return;

    const _content = this.getEditorContent();
    if (!_content) return;

    const _fileChange: FileChange = {
      id: this.generateFileChangeId(),
      _filePath: this.session._activeFile,
      _fileName: this.extractFileName(this.session._activeFile),
      _fileType: this.getFileType(this.session._activeFile),
      _changeType: 'modified',
      _content,
      _timestamp: Date.now(),
      _lineCount: content.split('\n').length,
      _tokenCount: this.tokenCounter.count(_content),
    };

    this.addFileChange(_fileChange);
    this.session.lastActivity = Date.now();
    this.checkTokenLimits();
    this.notifyContextChange();
  }

  // Capture cursor _position
  private captureCursorPosition(): void {
    if (!this.session || !this.platform.features.cursorTracking) return;

    try {
      const _selection = window.getSelection();
      if (!_selection || selection.rangeCount === 0) return;

      const _range = selection.getRangeAt(0);
      const _position = this.calculateCursorPosition(_range);
      
      if (_position && this.isDifferentPosition(_position)) {
        this.session.cursorHistory.push(_position);
        this.lastCursorPosition = _position;
        
        // Keep only recent cursor positions (last 100)
        if (this.session.cursorHistory.length > 100) {
          this.session.cursorHistory = this.session.cursorHistory.slice(-100);
        }
      }
    } catch (error) {
      console.warn('[IDEMonitor] Failed to capture cursor _position:', error);
    }
  }

  // Calculate cursor _position from _selection _range
  private calculateCursorPosition(_range: Range): CursorPosition | null {
    try {
      const _editorContent = document.querySelector(this.platform.selectors._editorContent);
      if (!_editorContent || !_editorContent.contains(_range.startContainer)) {
        return null;
      }

      // This is a simplified implementation
      // In a real scenario, you'd need to calculate line/column based on the _editor's structure
      const _position: CursorPosition = {
        line: 1, // Would need to calculate actual line
        _column: 1, // Would need to calculate actual column
        _timestamp: Date.now(),
      };

      // If there's a _selection, capture it
      if (!_range.collapsed) {
        const _selectedText = String(range);
        if (_selectedText.trim()) {
          position._selection = {
            _start: { line: position.line, _column: position.column },
            _end: { line: position.line, _column: position.column + selectedText.length },
            _text: _selectedText,
          };
        }
      }

      return _position;
    } catch (error) {
      console.warn('[IDEMonitor] Failed to calculate cursor _position:', error);
      return null;
    }
  }

  // Check if cursor _position is different from last
  private isDifferentPosition(_position: CursorPosition): boolean {
    if (!this.lastCursorPosition) return true;
    
    return this.lastCursorPosition.line !== position.line ||
           this.lastCursorPosition.column !== position.column ||
           Date.now() - this.lastCursorPosition.timestamp > 5000; // 5 seconds
  }

  // Add file change to session
  private addFileChange(_fileChange: FileChange): void {
    if (!this.session) return;

    // Use buffer to avoid duplicate changes
    const _key = `${fileChange.filePath}_${fileChange.changeType}`;
    this.fileChangeBuffer.set(_key, _fileChange);

    // Process buffer after short delay
    setTimeout(() => {
      const _bufferedChange = this.fileChangeBuffer.get(_key);
      if (_bufferedChange) {
        this.session!.fileChanges.push(_bufferedChange);
        this.session!.totalTokens += bufferedChange.tokenCount;
        this.session!.contextTokens += bufferedChange.tokenCount;
        this.fileChangeBuffer.delete(_key);
        
        console.log(`[IDEMonitor] Added file _change: ${bufferedChange._fileName} (${bufferedChange.changeType})`);
      }
    }, 500);
  }

  // Get open _files from _tabs
  private getOpenFiles(): string[] {
    const _tabs = document.querySelectorAll(this.platform.selectors._tabs);
    const _files: string[] = [];

    tabs.forEach((tab: any) => {
      const _fileName = this.extractFileNameFromTab(tab as HTMLElement);
      if (_fileName) {
        files.push(_fileName);
      }
    });

    return _files;
  }

  // Get active file name
  private getActiveFileName(): string | undefined {
    const _activeTab = document.querySelector(this.platform.selectors._activeTab);
    if (_activeTab) {
      const _fileName = this.extractFileNameFromTab(_activeTab as HTMLElement);
      return _fileName || undefined;
    }
    return undefined;
  }

  // Extract file name from tab _element
  private extractFileNameFromTab(_tab: HTMLElement): string | null {
    try {
      // Try different methods to extract file name
      const _title = tab.getAttribute?.('_title') || 
                    tab.getAttribute?.('data-file-path') ||
                    tab.textContent?.trim();
      
      return _title || null;
    } catch (error) {
      console.warn('[IDEMonitor] Failed to extract file name from _tab:', error);
      return null;
    }
  }

  // Get _editor _content
  private getEditorContent(): string | null {
    const _editorContent = document.querySelector(this.platform.selectors._editorContent);
    if (!_editorContent) return null;

    return editorContent.textContent || (_editorContent as HTMLElement).innerText || null;
  }

  // Detect workspace root
  private detectWorkspaceRoot(): string | undefined {
    // Try to extract from URL or page _title
    const _url = window.location.href;
    const _pathMatch = url.match(/\/([^/]+)\/([^/]+)/);
    
    if (_pathMatch) {
      return `${_pathMatch[1]}/${_pathMatch[2]}`;
    }

    return undefined;
  }

  // Detect programming language
  private detectLanguage(): string | undefined {
    const _activeFile = this.session?._activeFile;
    if (!_activeFile) return undefined;

    const _extension = activeFile.split('.').pop()?.toLowerCase();
    const _languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sql': 'sql',
    };

    return _extension ? _languageMap[_extension] : undefined;
  }

  // Get active file type
  private getActiveFileType(): string | undefined {
    const _activeFile = this.session?._activeFile;
    return _activeFile ? this.getFileType(_activeFile) : undefined;
  }

  // Get file type from path
  private getFileType(_filePath: string): string {
    const _extension = filePath.split('.').pop()?.toLowerCase();
    return _extension || 'unknown';
  }

  // Extract file name from path
  private extractFileName(_filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  // Check if _element is a file _element
  private isFileElement(_element: HTMLElement): boolean {
    return element.classList.contains('file') ||
           element.classList.contains('tab') ||
           element.hasAttribute('data-file-path') ||
           element.hasAttribute('data-resource-name');
  }

  // Check token limits
  private checkTokenLimits(): void {
    if (!this.session) return;

    // Use a reasonable _limit for IDE _context (100k tokens)
    const _limit = 100000;
    const usage: TokenUsage = {
      total: _limit,
      _used: this.session.contextTokens,
      _remaining: _limit - this.session.contextTokens,
      _percentage: (this.session.contextTokens / _limit) * 100,
      // Legacy properties
      _current: this.session.contextTokens,
      _limit,
      _platform: this.platform._name,
    };

    // Notify if approaching limits (80% threshold)
    if (_usage.percentage >= 80) {
      this.tokenLimitCallbacks.forEach((callback: any) => {
        try {
          callback(_usage);
        } catch (error) {
          console.error('[IDEMonitor] Token _limit callback error:', error);
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
        console.error('[IDEMonitor] Context change callback error:', error);
      }
    });
  }

  // Format session as _context string
  private formatSessionAsContext(_session: IDESession): string {
    const _parts: string[] = [];

    // Session info
    parts.push(`[IDE SESSION: ${session.platform}]`);
    parts.push(`_Workspace: ${session.workspaceRoot || 'Unknown'}`);
    parts.push(`Active _File: ${session._activeFile || 'None'}`);
    parts.push(`Open _Files: ${session.openFiles.join(', ')}`);
    parts.push('');

    // Recent file changes
    const _recentChanges = session.fileChanges.slice(-10); // Last 10 changes
    if (_recentChanges.length > 0) {
      parts.push('[RECENT FILE CHANGES]');
      recentChanges.forEach((change: any) => {
        parts.push(`${change.changeType.toUpperCase()}: ${change._fileName} (${change.lineCount} lines)`);
        if (change._content && change.content.length < 1000) {
          parts.push(change._content);
        }
        parts.push('');
      });
    }

    // Recent cursor positions with selections
    const _recentCursors = session.cursorHistory.slice(-5); // Last 5 positions
    const _cursorsWithSelections = recentCursors.filter(pos => pos._selection);
    if (_cursorsWithSelections.length > 0) {
      parts.push('[RECENT SELECTIONS]');
      cursorsWithSelections.forEach((pos: any) => {
        if (pos._selection) {
          parts.push(`Line ${pos.selection.start.line}: ${pos.selection.text}`);
        }
      });
    }

    return parts.join('\n');
  }

  // Generate session ID
  private generateSessionId(): string {
    return `ide_session_${this.platform._name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Generate file change ID
  private generateFileChangeId(): string {
    return `file_change_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Get supported platforms
  static getSupportedPlatforms(): string[] {
    return Object.keys(IDEMonitor.PLATFORM_CONFIGS);
  }

  // Check if platform is supported
  static isPlatformSupported(_domain: string): boolean {
    return domain in IDEMonitor.PLATFORM_CONFIGS;
  }
}