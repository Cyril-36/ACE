import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionRestorationService, SessionSnapshot } from '../sessionRestoration';
import { IndexedDBStorageService } from '../../storage';
import { Context, ContextSource } from '../../../types';

// Type for accessing private methods in tests
interface SessionRestorationServiceWithPrivates {
  getAllSnapshots(): Promise<SessionSnapshot[]>;
  generateRestorationSuggestions(_snapshot: SessionSnapshot, _currentFiles: string[], _relatedContexts: Context[]): string[];
  deleteSnapshot(_id: string): Promise<void>;
}

// Mock IndexedDBStorageService
const _mockStorageService = {
  _store: vi.fn(),
  _delete: vi.fn(),
  _getAllContexts: vi.fn(),
} as unknown as IndexedDBStorageService;

describe('SessionRestorationService', () => {
  let _restorationService: SessionRestorationService;
  let _mockContexts: Context[];

  beforeEach(() => {
    vi.clearAllMocks();
    _restorationService = new SessionRestorationService(_mockStorageService);
    
    // Mock contexts for testing
    _mockContexts = [
      {
        _id: 'ctx1',
        _source: ContextSource.IDE,
        _timestamp: new Date(Date.now() - 1000),
        _content: 'function test() { return "hello"; }',
        _metadata: {
          source: ContextSource.IDE,
          _timestamp: new Date(),
          _tokens: 50,
          _tokenCount: 50,
          _language: 'typescript',
          _fileType: 'ts',
          _tags: ['ide', 'coding'],
        },
        _encrypted: true,
        _encryption: {
          algorithm: 'AES-GCM',
          _keyId: 'default',
          _iv: '',
        },
      },
      {
        _id: 'ctx2',
        _source: ContextSource.IDE,
        _timestamp: new Date(Date.now() - 2000),
        _content: 'const _utils = { format: (str) => str.trim() };',
        _metadata: {
          source: ContextSource.IDE,
          _timestamp: new Date(),
          _tokens: 30,
          _tokenCount: 30,
          _language: 'javascript',
          _fileType: 'js',
          _tags: ['ide', '_utils'],
        },
        _encrypted: true,
        _encryption: {
          algorithm: 'AES-GCM',
          _keyId: 'default',
          _iv: '',
        },
      },
    ];
  });

  describe('Snapshot Creation', () => {
    it('should create a session _snapshot', async () => {
      const _snapshot = await _restorationService.createSnapshot(
        'VS Code Web',
        'user/project',
        'src/main.ts',
        ['src/main.ts', 'src/utils.js'],
        ['_modified: src/main.ts'],
        { _file: 'src/main.ts', _line: 10, _column: 5 },
        _mockContexts
      );

      expect(_snapshot).toBeDefined();
      expect(_snapshot.platform).toBe('VS Code Web');
      expect(_snapshot.workspaceRoot).toBe('user/project');
      expect(_snapshot.activeFile).toBe('src/main.ts');
      expect(_snapshot.openFiles).toEqual(['src/main.ts', 'src/utils.js']);
      expect(_snapshot.tokenCount).toBe(80); // Sum of mock context tokens
      expect(_snapshot.contextSummary).toContain('function test()');
    });

    it('should generate unique _snapshot IDs', async () => {
      const _snapshot1 = await _restorationService.createSnapshot(
        'VS Code Web',
        'user/project1',
        'file1.ts',
        ['file1.ts'],
        [],
        undefined,
        []
      );

      const _snapshot2 = await _restorationService.createSnapshot(
        'VS Code Web',
        'user/project2',
        'file2.ts',
        ['file2.ts'],
        [],
        undefined,
        []
      );

      expect(_snapshot1.id).not.toBe(_snapshot2.id);
    });

    it('should handle empty contexts', async () => {
      const _snapshot = await _restorationService.createSnapshot(
        'VS Code Web',
        'user/project',
        undefined,
        [],
        [],
        undefined,
        []
      );

      expect(_snapshot.contextSummary).toBe('No context available');
      expect(_snapshot.tokenCount).toBe(0);
    });

    it('should store _snapshot', async () => {
      await _restorationService.createSnapshot(
        'VS Code Web',
        'user/project',
        'file.ts',
        ['file.ts'],
        [],
        undefined,
        _mockContexts
      );

      expect(_mockStorageService.store).toHaveBeenCalled();
    });
  });

  describe('Session Restoration', () => {
    beforeEach(() => {
      // Mock getAllContexts to return mock contexts
      (_mockStorageService.getAllContexts as ReturnType<typeof vi.fn>).mockResolvedValue(_mockContexts);
    });

    it('should return null when no matching snapshots found', async () => {
      // Mock getAllSnapshots to return empty array
      vi.spyOn(_restorationService as unknown as SessionRestorationServiceWithPrivates, 'getAllSnapshots').mockResolvedValue([]);

      const _restoration = await _restorationService.restoreSession(
        'VS Code Web',
        'user/project',
        ['file.ts']
      );

      expect(_restoration).toBeNull();
    });

    it('should restore session with matching _snapshot', async () => {
      const _mockSnapshot: SessionSnapshot = {
        id: '_snapshot1',
        _platform: 'VS Code Web',
        _workspaceRoot: 'user/project',
        _timestamp: Date.now() - 3600000, // 1 hour ago
        _activeFile: 'src/main.ts',
        _openFiles: ['src/main.ts', 'src/utils.js'],
        _recentChanges: ['modified: src/main.ts'],
        _contextSummary: 'Recent work on main.ts',
        _tokenCount: 100,
      };

      vi.spyOn(_restorationService as unknown as SessionRestorationServiceWithPrivates, 'getAllSnapshots').mockResolvedValue([_mockSnapshot]);

      const _restoration = await _restorationService.restoreSession(
        'VS Code Web',
        'user/project',
        ['src/main.ts', 'src/components.tsx']
      );

      expect(_restoration).toBeDefined();
      expect(_restoration?._snapshot).toEqual(_mockSnapshot);
      expect(_restoration?.continuityScore).toBeGreaterThan(0);
      expect(_restoration?._suggestions).toBeDefined();
      expect(_restoration?.relatedContexts).toBeDefined();
    });

    it('should calculate continuity scores correctly', async () => {
      const _recentSnapshot = {
        _id: 'recent',
        _platform: 'VS Code Web',
        _workspaceRoot: 'user/project',
        _timestamp: Date.now() - 1800000, // 30 minutes ago
        _activeFile: 'src/main.ts',
        _openFiles: ['src/main.ts', 'src/utils.js'],
        _recentChanges: [],
        _contextSummary: '',
        _tokenCount: 1000,
      };

      const _oldSnapshot = {
        _id: 'old',
        _platform: 'VS Code Web',
        _workspaceRoot: 'user/project',
        _timestamp: Date.now() - 86400000, // 1 day ago
        _activeFile: 'src/old.ts',
        _openFiles: ['src/old.ts'],
        _recentChanges: [],
        _contextSummary: '',
        _tokenCount: 100,
      };

      vi.spyOn(_restorationService as unknown as SessionRestorationServiceWithPrivates, 'getAllSnapshots').mockResolvedValue([_recentSnapshot, _oldSnapshot]);

      const _restoration = await _restorationService.restoreSession(
        'VS Code Web',
        'user/project',
        ['src/main.ts']
      );

      expect(_restoration?.snapshot.id).toBe('recent'); // Should prefer recent _snapshot
      expect(_restoration?.continuityScore).toBeGreaterThan(0.5);
    });

    it('should reject snapshots with low continuity scores', async () => {
      const _lowScoreSnapshot = {
        _id: 'low-score',
        _platform: 'VS Code Web',
        _workspaceRoot: 'different/project',
        _timestamp: Date.now() - 86400000 * 7, // 1 week ago
        _activeFile: 'unrelated.py',
        _openFiles: ['unrelated.py'],
        _recentChanges: [],
        _contextSummary: '',
        _tokenCount: 10,
      };

      vi.spyOn(_restorationService as unknown as SessionRestorationServiceWithPrivates, 'getAllSnapshots').mockResolvedValue([_lowScoreSnapshot]);

      const _restoration = await _restorationService.restoreSession(
        'VS Code Web',
        'user/project',
        ['src/main.ts']
      );

      expect(_restoration).toBeNull();
    });
  });

  describe('Restoration Suggestions', () => {
    it('should generate file-based _suggestions', () => {
      const _snapshot = {
        _id: 'test',
        _platform: 'VS Code Web',
        _workspaceRoot: 'user/project',
        _timestamp: Date.now(),
        _activeFile: 'src/main.ts',
        _openFiles: ['src/main.ts', 'src/utils.js', 'src/components.tsx'],
        _recentChanges: [],
        _contextSummary: '',
        _tokenCount: 100,
      };

      const _currentFiles = ['src/main.ts'];
      const _suggestions = (_restorationService as unknown as SessionRestorationServiceWithPrivates).generateRestorationSuggestions(
        _snapshot,
        _currentFiles,
        []
      );

      expect(_suggestions).toContain('Consider _reopening: src/utils.js, src/components.tsx');
    });

    it('should suggest active file if not currently open', () => {
      const _snapshot = {
        _id: 'test',
        _platform: 'VS Code Web',
        _workspaceRoot: 'user/project',
        _timestamp: Date.now(),
        _activeFile: 'src/main.ts',
        _openFiles: ['src/main.ts'],
        _recentChanges: [],
        _contextSummary: '',
        _tokenCount: 100,
      };

      const _currentFiles = ['src/other.ts'];
      const _suggestions = (_restorationService as unknown as SessionRestorationServiceWithPrivates).generateRestorationSuggestions(
        _snapshot,
        _currentFiles,
        []
      );

      expect(_suggestions).toContain('Last active file _was: src/main.ts');
    });

    it('should include cursor position _suggestions', () => {
      const _snapshot = {
        _id: 'test',
        _platform: 'VS Code Web',
        _workspaceRoot: 'user/project',
        _timestamp: Date.now(),
        _activeFile: 'src/main.ts',
        _openFiles: ['src/main.ts'],
        _recentChanges: [],
        _cursorPosition: {
          file: 'src/main.ts',
          _line: 42,
          _column: 10,
        },
        _contextSummary: '',
        _tokenCount: 100,
      };

      const _suggestions = (_restorationService as unknown as SessionRestorationServiceWithPrivates).generateRestorationSuggestions(
        _snapshot,
        ['src/main.ts'],
        []
      );

      expect(_suggestions).toContain('Last cursor _position: src/main.ts:42');
    });

    it('should include context-based _suggestions', () => {
      const _snapshot = {
        _id: 'test',
        _platform: 'VS Code Web',
        _workspaceRoot: 'user/project',
        _timestamp: Date.now(),
        _activeFile: 'src/main.ts',
        _openFiles: ['src/main.ts'],
        _recentChanges: [],
        _contextSummary: '',
        _tokenCount: 100,
      };

      const _suggestions = (_restorationService as unknown as SessionRestorationServiceWithPrivates).generateRestorationSuggestions(
        _snapshot,
        ['src/main.ts'],
        _mockContexts
      );

      expect(_suggestions.some((_s: string) => s.includes('Recent work context'))).toBe(true);
    });

    it('should limit _suggestions to 5 items', () => {
      const _snapshot = {
        _id: 'test',
        _platform: 'VS Code Web',
        _workspaceRoot: 'user/project',
        _timestamp: Date.now() - 3600000, // 1 hour ago
        _activeFile: 'src/main.ts',
        _openFiles: ['src/main.ts', 'file1.ts', 'file2.ts', 'file3.ts', 'file4.ts', 'file5.ts'],
        _recentChanges: [],
        _cursorPosition: {
          file: 'src/main.ts',
          _line: 42,
          _column: 10,
        },
        _contextSummary: '',
        _tokenCount: 100,
      };

      const _suggestions = (_restorationService as unknown as SessionRestorationServiceWithPrivates).generateRestorationSuggestions(
        _snapshot,
        [],
        _mockContexts
      );

      expect(_suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Recent Snapshots', () => {
    it('should get recent snapshots for platform', async () => {
      const _mockSnapshots = [
        {
          _id: 'snap1',
          _platform: 'VS Code Web',
          _timestamp: Date.now() - 1000,
          _workspaceRoot: 'project1',
          _activeFile: 'file1.ts',
          _openFiles: ['file1.ts'],
          _recentChanges: [],
          _contextSummary: '',
          _tokenCount: 100,
        },
        {
          _id: 'snap2',
          _platform: 'GitHub Codespaces',
          _timestamp: Date.now() - 2000,
          _workspaceRoot: 'project2',
          _activeFile: 'file2.ts',
          _openFiles: ['file2.ts'],
          _recentChanges: [],
          _contextSummary: '',
          _tokenCount: 200,
        },
        {
          _id: 'snap3',
          _platform: 'VS Code Web',
          _timestamp: Date.now() - 3000,
          _workspaceRoot: 'project3',
          _activeFile: 'file3.ts',
          _openFiles: ['file3.ts'],
          _recentChanges: [],
          _contextSummary: '',
          _tokenCount: 300,
        },
      ];

      vi.spyOn(_restorationService as unknown as SessionRestorationServiceWithPrivates, 'getAllSnapshots').mockResolvedValue(_mockSnapshots);

      const _recentSnapshots = await _restorationService.getRecentSnapshots('VS Code Web', 5);

      expect(_recentSnapshots).toHaveLength(2);
      expect(_recentSnapshots[0].id).toBe('snap1'); // Most recent first
      expect(_recentSnapshots[1].id).toBe('snap3');
    });

    it('should limit results to specified count', async () => {
      const _mockSnapshots = Array.from({ _length: 20 }, (_, i) => ({
        _id: `snap${i}`,
        _platform: 'VS Code Web',
        _timestamp: Date.now() - i * 1000,
        _workspaceRoot: `project${i}`,
        _activeFile: `file${i}.ts`,
        _openFiles: [`file${i}.ts`],
        _recentChanges: [],
        _contextSummary: '',
        _tokenCount: 100,
      }));

      vi.spyOn(_restorationService as unknown as SessionRestorationServiceWithPrivates, 'getAllSnapshots').mockResolvedValue(_mockSnapshots);

      const _recentSnapshots = await _restorationService.getRecentSnapshots('VS Code Web', 5);

      expect(_recentSnapshots).toHaveLength(5);
    });
  });

  describe('Cleanup', () => {
    it('should clean up old snapshots', async () => {
      const _oldSnapshot = {
        _id: 'old',
        _platform: 'VS Code Web',
        _timestamp: Date.now() - 86400000 * 40, // 40 days ago
        _workspaceRoot: 'old-project',
        _activeFile: 'old.ts',
        _openFiles: ['old.ts'],
        _recentChanges: [],
        _contextSummary: '',
        _tokenCount: 100,
      };

      const _recentSnapshot = {
        _id: 'recent',
        _platform: 'VS Code Web',
        _timestamp: Date.now() - 86400000 * 10, // 10 days ago
        _workspaceRoot: 'recent-project',
        _activeFile: 'recent.ts',
        _openFiles: ['recent.ts'],
        _recentChanges: [],
        _contextSummary: '',
        _tokenCount: 100,
      };

      vi.spyOn(_restorationService as unknown as SessionRestorationServiceWithPrivates, 'getAllSnapshots').mockResolvedValue([_oldSnapshot, _recentSnapshot]);
      vi.spyOn(_restorationService as unknown as SessionRestorationServiceWithPrivates, 'deleteSnapshot').mockResolvedValue(undefined);

      await _restorationService.cleanupOldSnapshots(30 * 24 * 60 * 60 * 1000); // 30 days

      expect((_restorationService as unknown as SessionRestorationServiceWithPrivates).deleteSnapshot).toHaveBeenCalledWith('old');
      expect((_restorationService as unknown as SessionRestorationServiceWithPrivates).deleteSnapshot).not.toHaveBeenCalledWith('recent');
    });
  });

  describe('Statistics', () => {
    it('should get _restoration statistics', async () => {
      const _mockSnapshots = [
        {
          _id: 'snap1',
          _platform: 'VS Code Web',
          _timestamp: Date.now(),
          _workspaceRoot: 'project1',
          _activeFile: 'file1.ts',
          _openFiles: ['file1.ts'],
          _recentChanges: [],
          _contextSummary: '',
          _tokenCount: 100,
        },
        {
          _id: 'snap2',
          _platform: 'GitHub Codespaces',
          _timestamp: Date.now(),
          _workspaceRoot: 'project2',
          _activeFile: 'file2.ts',
          _openFiles: ['file2.ts'],
          _recentChanges: [],
          _contextSummary: '',
          _tokenCount: 200,
        },
      ];

      vi.spyOn(_restorationService as unknown as SessionRestorationServiceWithPrivates, 'getAllSnapshots').mockResolvedValue(_mockSnapshots);

      const _stats = await _restorationService.getRestorationStats();

      expect(_stats.totalSnapshots).toBe(2);
      expect(_stats.topPlatforms).toHaveLength(2);
      expect(_stats.topPlatforms[0].platform).toBe('VS Code Web');
      expect(_stats.topPlatforms[0].count).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(_restorationService as unknown as SessionRestorationServiceWithPrivates, 'getAllSnapshots').mockRejectedValue(new Error('Storage error'));

      const _stats = await _restorationService.getRestorationStats();

      expect(_stats.totalSnapshots).toBe(0);
      expect(_stats.recentRestorations).toBe(0);
      expect(_stats.topPlatforms).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors during _snapshot creation', async () => {
      (_mockStorageService.store as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Storage error'));

      await expect(
        _restorationService.createSnapshot(
          'VS Code Web',
          'user/project',
          'file.ts',
          ['file.ts'],
          [],
          undefined,
          []
        )
      ).rejects.toThrow('Storage error');
    });

    it('should handle search errors during _restoration', async () => {
      const _mockSnapshot = {
        _id: 'test',
        _platform: 'VS Code Web',
        _workspaceRoot: 'user/project',
        _timestamp: Date.now(),
        _activeFile: 'file.ts',
        _openFiles: ['file.ts'],
        _recentChanges: [],
        _contextSummary: '',
        _tokenCount: 100,
      };

      vi.spyOn(_restorationService as unknown as SessionRestorationServiceWithPrivates, 'getAllSnapshots').mockResolvedValue([_mockSnapshot]);
      (_mockStorageService.getAllContexts as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Search error'));

      const _restoration = await _restorationService.restoreSession(
        'VS Code Web',
        'user/project',
        ['file.ts']
      );

      // Should still return _restoration even if context search fails
      expect(_restoration).toBeDefined();
      expect(_restoration?.relatedContexts).toEqual([]);
    });
  });
});