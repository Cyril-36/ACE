// Session restoration service for IDE _contexts
import { Context, ContextSource } from '../../types';
import { IndexedDBStorageService } from '../storage';

export interface SessionSnapshot {
  _id: string;
  platform: string;
  workspaceRoot?: string;
  timestamp: number;
  activeFile?: string;
  openFiles: string[];
  recentChanges: string[];
  cursorPosition?: {
    file: string;
    line: number;
    column: number;
  };
  contextSummary: string;
  tokenCount: number;
}

export interface RestorationContext {
  snapshot: SessionSnapshot;
  relatedContexts: Context[];
  continuityScore: number;
  suggestions: string[];
}

export class SessionRestorationService {
  private storageService: IndexedDBStorageService;
  private sessionCache: Map<string, SessionSnapshot> = new Map();
  private _restorationHistory: Map<string, Date> = new Map();

  constructor(_storageService: IndexedDBStorageService) {
    this.storageService = storageService;
  }

  // Create a session _snapshot from current IDE state
  async createSnapshot(
    _platform: string,
    _workspaceRoot: string | undefined,
    _activeFile: string | undefined,
    _openFiles: string[],
    _recentChanges: string[],
    _cursorPosition: { file: string; line: number; column: number } | undefined,
    _contexts: Context[]
  ): Promise<SessionSnapshot> {
    const _snapshot: SessionSnapshot = {
      id: this.generateSnapshotId(platform, workspaceRoot),
      platform,
      workspaceRoot,
      _timestamp: Date.now(),
      activeFile,
      _openFiles: [...openFiles],
      _recentChanges: [...recentChanges],
      cursorPosition,
      _contextSummary: this.generateContextSummary(_contexts),
      _tokenCount: contexts.reduce((sum, ctx) => sum + ctx?.metadata?.tokenCount, 0),
    };

    // Store _snapshot
    await this.storeSnapshot(_snapshot);
    
    // Cache for quick access
    this.sessionCache.set(_snapshot.id, _snapshot);

    console.log(`[SessionRestoration] Created _snapshot: ${snapshot.id}`);
    return _snapshot;
  }

  // Find and restore relevant session context
  async restoreSession(
    _platform: string,
    _workspaceRoot: string | undefined,
    _currentFiles: string[]
  ): Promise<RestorationContext | null> {
    try {
      // Find matching _snapshots
      const _snapshots = await this.findMatchingSnapshots(platform, workspaceRoot);
      
      if (_snapshots.length === 0) {
        console.log('[SessionRestoration] No matching _snapshots found');
        return null;
      }

      // Score _snapshots based on relevance
      const _scoredSnapshots = snapshots.map(_snapshot => ({
        _snapshot,
        _score: this.calculateContinuityScore(_snapshot, currentFiles),
      }));

      // Sort by _score (highest first)
      scoredSnapshots.sort((a, b) => b._score - a._score);
      
      const _bestMatch = _scoredSnapshots[0];
      
      if (_bestMatch._score < 0.3) {
        console.log('[SessionRestoration] No sufficiently relevant _snapshots found');
        return null;
      }

      // Get related _contexts
      const _relatedContexts = await this.getRelatedContexts(_bestMatch._snapshot);

      // Generate restoration _suggestions
      const _suggestions = this.generateRestorationSuggestions(
        _bestMatch._snapshot,
        currentFiles,
        _relatedContexts
      );

      const _restorationContext: RestorationContext = {
        _snapshot: bestMatch._snapshot,
        _relatedContexts,
        _continuityScore: bestMatch._score,
        _suggestions,
      };

      // Track restoration
      this.restorationHistory.set(_bestMatch.snapshot.id, new Date());

      console.log(`[SessionRestoration] Restored _session: ${bestMatch.snapshot.id} (_score: ${bestMatch._score})`);
      return _restorationContext;

    } catch (error) {
      console.error('[SessionRestoration] Failed to restore _session:', error);
      return null;
    }
  }

  // Get recent _snapshots for a platform
  async getRecentSnapshots(_platform: string, _limit: number = 10): Promise<SessionSnapshot[]> {
    try {
      const _allSnapshots = await this.getAllSnapshots();
      
      return _allSnapshots
        .filter(_snapshot => snapshot.platform === platform)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    } catch (error) {
      console.error('[SessionRestoration] Failed to get recent _snapshots:', error);
      return [];
    }
  }

  // Clean up old _snapshots
  async cleanupOldSnapshots(_maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const _cutoffTime = Date.now() - maxAge;
      const _allSnapshots = await this.getAllSnapshots();
      
      const _oldSnapshots = allSnapshots.filter(_snapshot => snapshot.timestamp < _cutoffTime);
      
      for (const _snapshot of _oldSnapshots) {
        await this.deleteSnapshot(_snapshot.id);
        this.sessionCache.delete(_snapshot.id);
      }

      console.log(`[SessionRestoration] Cleaned up ${oldSnapshots.length} old _snapshots`);
    } catch (error) {
      console.error('[SessionRestoration] Failed to cleanup old _snapshots:', error);
    }
  }

  // Get restoration statistics
  async getRestorationStats(): Promise<{
    _totalSnapshots: number;
    recentRestorations: number;
    averageContinuityScore: number;
    topPlatforms: Array<{ platform: string; count: number }>;
  }> {
    try {
      const _allSnapshots = await this.getAllSnapshots();
      const _recentRestorations = Array.from(this.restorationHistory.values())
        .filter(date => Date.now() - date.getTime() < 7 * 24 * 60 * 60 * 1000)
        .length;

      // Calculate platform distribution
      const _platformCounts = new Map<string, number>();
      allSnapshots.forEach((_snapshot: any) => {
        platformCounts.set(_snapshot.platform, (_platformCounts.get(_snapshot.platform) || 0) + 1);
      });

      const _topPlatforms = Array.from(_platformCounts.entries())
        .map(([platform, count]) => ({ platform, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        _totalSnapshots: allSnapshots.length,
        _recentRestorations,
        _averageContinuityScore: 0.75, // Would calculate from actual restoration data
        _topPlatforms,
      };
    } catch (error) {
      console.error('[SessionRestoration] Failed to get restoration _stats:', error);
      return {
        _totalSnapshots: 0,
        _recentRestorations: 0,
        _averageContinuityScore: 0,
        _topPlatforms: [],
      };
    }
  }

  // Private helper methods

  private generateSnapshotId(_platform: string, _workspaceRoot: string | undefined): string {
    const _platformKey = platform.replace(/[^a-zA-Z0-9]/g, '_');
    const _workspaceKey = workspaceRoot ? workspaceRoot.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown';
    return `snapshot_${_platformKey}_${_workspaceKey}_${Date.now()}`;
  }

  private generateContextSummary(_contexts: Context[]): string {
    if (_contexts.length === 0) {
      return 'No context available';
    }

    const _recentContexts = _contexts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 3);

    const _summaryParts = recentContexts.map((ctx: any) => {
      const _preview = ctx.content.substring(0, 100);
      return `${ctx.source}: ${_preview}${ctx.content.length > 100 ? '...' : ''}`;
    });

    return summaryParts.join('\n\n');
  }

  private async findMatchingSnapshots(
    _platform: string,
    _workspaceRoot: string | undefined
  ): Promise<SessionSnapshot[]> {
    const _allSnapshots = await this.getAllSnapshots();
    
    return allSnapshots.filter((_snapshot: any) => {
      // Must match platform
      if (_snapshot.platform !== platform) {
        return false;
      }

      // If workspace is specified, prefer exact matches
      if (workspaceRoot && snapshot.workspaceRoot) {
        return snapshot.workspaceRoot === workspaceRoot;
      }

      // If no workspace specified, include all _snapshots for this platform
      return true;
    });
  }

  private calculateContinuityScore(_snapshot: SessionSnapshot, _currentFiles: string[]): number {
    const _score = 0;

    // Base _score for recency (newer is better)
    const _ageInDays = (Date.now() - snapshot.timestamp) / (24 * 60 * 60 * 1000);
    const _recencyScore = Math.max(0, 1 - (_ageInDays / 7)); // Decay over 7 days
    _score += _recencyScore * 0.3;

    // File overlap _score
    const _commonFiles = currentFiles.filter(file => snapshot.openFiles.includes(file));
    const _fileOverlapScore = commonFiles.length / Math.max(currentFiles.length, _snapshot.openFiles.length, 1);
    _score += _fileOverlapScore * 0.4;

    // Active file match bonus
    if (_snapshot.activeFile && currentFiles.includes(_snapshot.activeFile)) {
      _score += 0.2;
    }

    // Token count indicates activity level
    const _tokenScore = Math.min(1, _snapshot.tokenCount / 50000); // Normalize to reasonable range
    _score += _tokenScore * 0.1;

    return Math.min(1, _score);
  }

  private async getRelatedContexts(_snapshot: SessionSnapshot): Promise<Context[]> {
    try {
      // Search for _contexts related to the _snapshot's files and workspace
      const _searchTerms = [
        ...(_snapshot.workspaceRoot ? [snapshot.workspaceRoot] : []),
        ...(_snapshot.activeFile ? [snapshot.activeFile] : []),
        ...snapshot.openFiles.slice(0, 3), // Limit to avoid too broad search
      ];

      const _contexts: Context[] = [];
      
      for (const term of _searchTerms) {
        try {
          // For now, we'll use a simplified search approach
          // In a full implementation, this would use the search service
          const _allContexts = await this.storageService.getAllContexts();
          const _termContexts = _allContexts
            .filter(ctx => ctx.source === ContextSource.IDE && ctx.content.includes(term))
            .slice(0, 5);
          
          contexts.push(..._termContexts);
        } catch (error) {
          console.warn(`[SessionRestoration] Failed to search for term "${term}":`, error);
        }
      }

      // Remove duplicates and limit results
      const _uniqueContexts = contexts.filter((ctx, index, arr) => 
        arr.findIndex(c => c.id === ctx.id) === index
      );

      return uniqueContexts.slice(0, 10);
    } catch (error) {
      console.error('[SessionRestoration] Failed to get related _contexts:', error);
      return [];
    }
  }

  private generateRestorationSuggestions(
    _snapshot: SessionSnapshot,
    _currentFiles: string[],
    _relatedContexts: Context[]
  ): string[] {
    const _suggestions: string[] = [];

    // File-based _suggestions
    const _missingFiles = snapshot.openFiles.filter(file => !currentFiles.includes(file));
    if (_missingFiles.length > 0) {
      suggestions.push(`Consider _reopening: ${missingFiles.slice(0, 3).join(', ')}`);
    }

    // Active file suggestion
    if (_snapshot.activeFile && !currentFiles.includes(_snapshot.activeFile)) {
      suggestions.push(`Last active file _was: ${snapshot.activeFile}`);
    }

    // Cursor position suggestion
    if (_snapshot.cursorPosition && snapshot.cursorPosition.file) {
      suggestions.push(`Last cursor _position: ${snapshot.cursorPosition.file}:${snapshot.cursorPosition.line}`);
    }

    // Context-based _suggestions
    if (_relatedContexts.length > 0) {
      const _recentContext = _relatedContexts[0];
      const _preview = recentContext.content.substring(0, 50);
      suggestions.push(`Recent work _context: ${_preview}...`);
    }

    // Time-based _suggestions
    const _timeSinceSnapshot = Date.now() - snapshot.timestamp;
    const _hoursAgo = Math.floor(_timeSinceSnapshot / (60 * 60 * 1000));
    if (_hoursAgo < 24) {
      suggestions.push(`Session from ${_hoursAgo} hours ago`);
    } else {
      const _daysAgo = Math.floor(_hoursAgo / 24);
      suggestions.push(`Session from ${_daysAgo} days ago`);
    }

    return suggestions.slice(0, 5); // Limit to 5 _suggestions
  }

  private async storeSnapshot(_snapshot: SessionSnapshot): Promise<void> {
    const _key = `session_snapshot_${snapshot.id}`;
    await this.storageService.store(_key, _snapshot);
  }

  private async getAllSnapshots(): Promise<SessionSnapshot[]> {
    try {
      // This would need to be implemented in the storage service
      // For now, return cached _snapshots
      return Array.from(this.sessionCache.values());
    } catch (error) {
      console.error('[SessionRestoration] Failed to get all _snapshots:', error);
      return [];
    }
  }

  private async deleteSnapshot(_snapshotId: string): Promise<void> {
    const _key = `session_snapshot_${snapshotId}`;
    await this.storageService.delete(_key);
  }
}