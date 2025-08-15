// Tests for Analytics Service
import { 
  AnalyticsServiceImpl, 
  AnalyticsEventType, 
  InsightType 
} from '../_analyticsService';
import { StorageService } from '../../storage';
import { Context, Summary, ContextSource, CloudProvider, LocalAlgorithm, UserPreferences } from '../../../types';

// Mock storage service
class MockStorageService implements StorageService {
  private storage = new Map<string, unknown>();

  async store(_key: string, _data: unknown): Promise<void> {
    this.storage.set(key, data);
  }

  async retrieve(_key: string): Promise<unknown> {
    return this.storage.get(key) || null;
  }

  async delete(_key: string): Promise<void> {
    this.storage.delete(key);
  }

  async getByPrefix(_prefix: string): Promise<Array<{ _key: string; value: unknown }>> {
    const _results: Array<{ key: string; value: unknown }> = [];
    for (const [key, value] of this.storage.entries()) {
      if (key.startsWith(prefix)) {
        _results?.push({ key, value });
      }
    }
    return _results;
  }

  async storeContext(): Promise<void> {
    throw new Error('Not implemented in mock');
  }

  async getContext(): Promise<Context | null> {
    throw new Error('Not implemented in mock');
  }

  async getAllContexts(): Promise<Context[]> {
    return [];
  }

  async storeSummary(): Promise<void> {
    throw new Error('Not implemented in mock');
  }

  async getSummary(): Promise<Summary | null> {
    throw new Error('Not implemented in mock');
  }

  async getAllSummaries(): Promise<Summary[]> {
    return [];
  }

  async storePreferences(): Promise<void> {
    throw new Error('Not implemented in mock');
  }

  async getPreferences(): Promise<UserPreferences | null> {
    return null;
  }

  async cleanup(): Promise<void> {
    // Mock cleanup
  }

  getUsageStats() {
    return {
      _totalSize: 100 * 1024 * 1024, // 100MB
      _usedSize: 1024 * 1024, // 1MB
      _availableSize: 99 * 1024 * 1024, // 99MB
      _itemCount: 15, // contextCount + summaryCount
      _lastCleanup: new Date(),
      _quotaUsed: 1024 * 1024,
      _quotaAvailable: 99 * 1024 * 1024,
    };
  }
}

describe('AnalyticsService', () => {
  let _analyticsService: AnalyticsServiceImpl;
  let _mockStorageService: MockStorageService;

  beforeEach(() => {
    _mockStorageService = new MockStorageService();
    _analyticsService = new AnalyticsServiceImpl(_mockStorageService);
  });

  describe('Initialization', () => {
    it('should initialize with default _metrics', async () => {
      const _metrics = await _analyticsService.getUsageMetrics();
      
      expect(_metrics.totalContexts).toBe(0);
      expect(_metrics.totalSummaries).toBe(0);
      expect(_metrics.contextsBySource[ContextSource.IDE]).toBe(0);
      expect(_metrics.contextsBySource[ContextSource.CHAT]).toBe(0);
      expect(_metrics.contextsBySource[ContextSource.WEB]).toBe(0);
      expect(_metrics.contextsBySource[ContextSource.MANUAL]).toBe(0);
    });
  });

  describe('Context Tracking', () => {
    it('should track _context capture correctly', async () => {
      const _mockContext: Context = {
        id: 'test-_context-1',
        _source: ContextSource.IDE,
        _timestamp: new Date(),
        _content: 'Test content',
        _encrypted: true,
        _metadata: {
          source: ContextSource.IDE,
          _timestamp: new Date(),
          _tokens: 100,
          _tokenCount: 100,
          _language: 'typescript',
          _fileType: 'ts',
          _tags: ['test'],
        },
        _encryption: {
          algorithm: 'AES-256',
          _keyId: 'test-key',
          _iv: 'test-iv',
        },
      };

      await _analyticsService.trackContextCapture(_mockContext);

      const _metrics = await _analyticsService.getUsageMetrics();
      expect(_metrics.totalContexts).toBe(1);
      expect(_metrics.contextsBySource[ContextSource.IDE]).toBe(1);
      expect(_metrics.contextsToday).toBe(1);
    });

    it('should track multiple _contexts from different sources', async () => {
      const _contexts: Context[] = [
        {
          id: '_context-1',
          _source: ContextSource.IDE,
          _timestamp: new Date(),
          _content: 'IDE content',
          _metadata: { 
            source: ContextSource.IDE,
            _timestamp: new Date(),
            _tokens: 100,
            _tokenCount: 100, 
            _tags: [] 
          },
          _encrypted: true,
          _encryption: { algorithm: 'AES-256', _keyId: 'key1', _iv: 'iv1' },
        },
        {
          _id: '_context-2',
          _source: ContextSource.CHAT,
          _timestamp: new Date(),
          _content: 'Chat content',
          _metadata: { 
            source: ContextSource.CHAT,
            _timestamp: new Date(),
            _tokens: 150,
            _tokenCount: 150, 
            _tags: [] 
          },
          _encrypted: true,
          _encryption: { algorithm: 'AES-256', _keyId: 'key2', _iv: 'iv2' },
        },
        {
          _id: '_context-3',
          _source: ContextSource.WEB,
          _timestamp: new Date(),
          _content: 'Web content',
          _metadata: { 
            source: ContextSource.WEB,
            _timestamp: new Date(),
            _tokens: 200,
            _tokenCount: 200, 
            _tags: [] 
          },
          _encrypted: true,
          _encryption: { algorithm: 'AES-256', _keyId: 'key3', _iv: 'iv3' },
        },
      ];

      for (const _context of _contexts) {
        await _analyticsService.trackContextCapture(_context);
      }

      const _metrics = await _analyticsService.getUsageMetrics();
      expect(_metrics.totalContexts).toBe(3);
      expect(_metrics.contextsBySource[ContextSource.IDE]).toBe(1);
      expect(_metrics.contextsBySource[ContextSource.CHAT]).toBe(1);
      expect(_metrics.contextsBySource[ContextSource.WEB]).toBe(1);
    });
  });

  describe('Summarization Tracking', () => {
    it('should track summarization correctly', async () => {
      const _mockSummary: Summary = {
        id: 'test-summary-1',
        contextId: 'test-_context-1',
        _method: 'local',
        _metadata: {
          timestamp: new Date(),
          _tokens: 50,
          _quality: 0.8
        },
        _originalLength: 1000,
        _summaryLength: 200,
        _compressionRatio: 0.2,
        _content: 'Test summary content',
        _keywords: ['test', 'summary'],
        _algorithm: LocalAlgorithm.TEXTRANK,
        _timestamp: new Date(),
        _quality: {
          coherence: 0.8,
          relevance: 0.9,
          _completeness: 0.7,
          _overall: 0.8,
        },
      };

      await _analyticsService.trackSummarization(_mockSummary, 2000, LocalAlgorithm.TEXTRANK);

      const _metrics = await _analyticsService.getUsageMetrics();
      expect(_metrics.totalSummaries).toBe(1);
      expect(_metrics.summariesByAlgorithm[LocalAlgorithm.TEXTRANK]).toBe(1);
      expect(_metrics.averageCompressionRatio).toBe(0.2);
      expect(_metrics.summariesToday).toBe(1);
    });

    it('should calculate average compression ratio correctly', async () => {
      const _summaries: Array<{ summary: Summary; algorithm: string }> = [
        {
          summary: {
            id: 'summary-1',
            contextId: '_context-1',
            _method: 'local' as const,
            _metadata: {
              timestamp: new Date(),
              _tokens: 50,
              _quality: 0.8
            },
            _originalLength: 1000,
            _summaryLength: 200,
            _compressionRatio: 0.2,
            _content: 'Summary 1',
            _keywords: [],
            _algorithm: LocalAlgorithm.TEXTRANK,
            _timestamp: new Date(),
            _quality: { coherence: 0.8, relevance: 0.8, _completeness: 0.8, _overall: 0.8 },
          },
          _algorithm: LocalAlgorithm.TEXTRANK,
        },
        {
          _summary: {
            id: 'summary-2',
            contextId: '_context-2',
            _method: 'local' as const,
            _metadata: {
              timestamp: new Date(),
              _tokens: 50,
              _quality: 0.9
            },
            _originalLength: 1000,
            _summaryLength: 400,
            _compressionRatio: 0.4,
            _content: 'Summary 2',
            _keywords: [],
            _algorithm: LocalAlgorithm.TFIDF,
            _timestamp: new Date(),
            _quality: { coherence: 0.7, relevance: 0.7, _completeness: 0.7, _overall: 0.7 },
          },
          _algorithm: LocalAlgorithm.TFIDF,
        },
      ];

      for (const { summary, algorithm } of _summaries) {
        await _analyticsService.trackSummarization(summary, 1500, algorithm);
      }

      const _metrics = await _analyticsService.getUsageMetrics();
      expect(_metrics.totalSummaries).toBe(2);
      expect(_metrics.averageCompressionRatio).toBe(0.3); // (0.2 + 0.4) / 2
      expect(_metrics.summariesByAlgorithm[LocalAlgorithm.TEXTRANK]).toBe(1);
      expect(_metrics.summariesByAlgorithm[LocalAlgorithm.TFIDF]).toBe(1);
    });
  });

  describe('Search Tracking', () => {
    it('should track search operations', async () => {
      await _analyticsService.trackSearch('test query', 5, 250);
      await (_analyticsService as { _forceFlushEvents: () => Promise<void> }).forceFlushEvents();

      const _events = await _analyticsService.getRecentActivity(1);
      const _searchEvent = events.find(e => e._type === AnalyticsEventType.SEARCH_PERFORMED);
      
      expect(_searchEvent).toBeDefined();
      expect(_searchEvent?.data?.queryLength).toBe(10);
      expect(_searchEvent?.data?.resultCount).toBe(5);
      expect(_searchEvent?.data?.duration).toBe(250);
      expect(_searchEvent?.data?.hasResults).toBe(true);
    });

    it('should track searches with no _results', async () => {
      await _analyticsService.trackSearch('nonexistent query', 0, 100);
      await (_analyticsService as { _forceFlushEvents: () => Promise<void> }).forceFlushEvents();

      const _events = await _analyticsService.getRecentActivity(1);
      const _searchEvent = events.find(e => e._type === AnalyticsEventType.SEARCH_PERFORMED);
      
      expect(_searchEvent?.data?.hasResults).toBe(false);
      expect(_searchEvent?.data?.resultCount).toBe(0);
    });
  });

  describe('Cloud API Tracking', () => {
    it('should track cloud API calls', async () => {
      await _analyticsService.trackCloudApiCall(CloudProvider.OPENAI, 0.05, true);
      await (_analyticsService as { _forceFlushEvents: () => Promise<void> }).forceFlushEvents();

      const _metrics = await _analyticsService.getUsageMetrics();
      expect(_metrics.cloudApiCalls[CloudProvider.OPENAI]).toBe(1);
      expect(_metrics.estimatedCloudCosts[CloudProvider.OPENAI]).toBe(0.05);

      const _events = await _analyticsService.getRecentActivity(1);
      const _apiEvent = events.find(e => e._type === AnalyticsEventType.CLOUD_API_CALLED);
      
      expect(_apiEvent).toBeDefined();
      expect(_apiEvent?.data?.provider).toBe(CloudProvider.OPENAI);
      expect(_apiEvent?.data?.cost).toBe(0.05);
      expect(_apiEvent?.data?.success).toBe(true);
    });

    it('should accumulate cloud costs correctly', async () => {
      await _analyticsService.trackCloudApiCall(CloudProvider.OPENAI, 0.03, true);
      await _analyticsService.trackCloudApiCall(CloudProvider.OPENAI, 0.07, true);
      await _analyticsService.trackCloudApiCall(CloudProvider.CLAUDE, 0.05, true);

      const _metrics = await _analyticsService.getUsageMetrics();
      expect(_metrics.cloudApiCalls[CloudProvider.OPENAI]).toBe(2);
      expect(_metrics.cloudApiCalls[CloudProvider.CLAUDE]).toBe(1);
      expect(_metrics.estimatedCloudCosts[CloudProvider.OPENAI]).toBe(0.10);
      expect(_metrics.estimatedCloudCosts[CloudProvider.CLAUDE]).toBe(0.05);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate performance _metrics from _events', async () => {
      // Track some summarization _events
      const _mockSummary: Summary = {
        id: 'perf-summary',
        contextId: 'perf-_context',
        _method: 'local' as const,
        _metadata: {
          timestamp: new Date(),
          _tokens: 50,
          _quality: 0.8
        },
        _originalLength: 1000,
        _summaryLength: 200,
        _compressionRatio: 0.2,
        _content: 'Performance test summary',
        _keywords: [],
        _algorithm: LocalAlgorithm.TEXTRANK,
        _timestamp: new Date(),
        _quality: { coherence: 0.8, relevance: 0.8, _completeness: 0.8, _overall: 0.8 },
      };

      await _analyticsService.trackSummarization(_mockSummary, 3000, LocalAlgorithm.TEXTRANK);
      await _analyticsService.trackSummarization(_mockSummary, 2000, LocalAlgorithm.TEXTRANK);
      await _analyticsService.trackSearch('test', 3, 500);
      await _analyticsService.trackSearch('another test', 1, 300);
      await (_analyticsService as { _forceFlushEvents: () => Promise<void> }).forceFlushEvents();

      const _perfMetrics = await _analyticsService.getPerformanceMetrics();
      
      expect(_perfMetrics.averageSummarizationTime).toBe(2500); // (3000 + 2000) / 2
      expect(_perfMetrics.averageSearchTime).toBe(400); // (500 + 300) / 2
      expect(_perfMetrics.errorRate).toBe(0); // No errors tracked
    });
  });

  describe('Insights Generation', () => {
    it('should generate storage _insights when usage is high', async () => {
      // Mock high storage usage
      const _mockHighStorageService = new MockStorageService();
      mockHighStorageService.getUsageStats = async () => ({
        _totalSize: 100 * 1024 * 1024, // 100MB total
        _usedSize: 60 * 1024 * 1024, // 60MB (above 50MB threshold)
        _availableSize: 40 * 1024 * 1024, // 40MB available
        _itemCount: 150, // contextCount + summaryCount
        _lastCleanup: new Date(),
        _quotaUsed: 60 * 1024 * 1024,
        _quotaAvailable: 40 * 1024 * 1024,
      });

      const _highStorageAnalytics = new AnalyticsServiceImpl(_mockHighStorageService);
      const _insights = await _highStorageAnalytics.getInsights();

      const _storageInsight = insights.find(_i => i._type === InsightType.STORAGE_OPTIMIZATION);
      expect(_storageInsight).toBeDefined();
      expect(_storageInsight?.impact).toBe('high');
      expect(_storageInsight?.actionable).toBe(true);
    });

    it('should generate usage pattern _insights', async () => {
      // Track _contexts from different sources
      const _ideContext: Context = {
        id: 'ide-1',
        _source: ContextSource.IDE,
        _timestamp: new Date(),
        _content: 'IDE content',
        _encrypted: true,
        _metadata: { 
          source: ContextSource.IDE,
          _timestamp: new Date(),
          _tokens: 100,
          _tokenCount: 100, 
          _tags: [] 
        },
        _encryption: { algorithm: 'AES-256', _keyId: 'key1', _iv: 'iv1' },
      };

      // Track multiple IDE _contexts to make it the primary source
      for (let _i = 0; _i < 5; _i++) {
        await _analyticsService.trackContextCapture({
          ..._ideContext,
          _id: `ide-${_i}`,
        });
      }

      const _insights = await _analyticsService.getInsights();
      const _usageInsight = insights.find(_i => i._type === InsightType.USAGE_PATTERN);
      
      expect(_usageInsight).toBeDefined();
      expect(_usageInsight?.title).toContain('IDE');
    });

    it('should generate performance _insights for slow operations', async () => {
      // Track slow summarization
      const _mockSummary: Summary = {
        id: 'slow-summary',
        contextId: 'slow-_context',
        _method: 'local' as const,
        _metadata: {
          timestamp: new Date(),
          _tokens: 50,
          _quality: 0.8
        },
        _originalLength: 1000,
        _summaryLength: 200,
        _compressionRatio: 0.2,
        _content: 'Slow summary',
        _keywords: [],
        _algorithm: LocalAlgorithm.TEXTRANK,
        _timestamp: new Date(),
        _quality: { coherence: 0.8, relevance: 0.8, _completeness: 0.8, _overall: 0.8 },
      };

      await _analyticsService.trackSummarization(_mockSummary, 6000, LocalAlgorithm.TEXTRANK); // 6 seconds (above 5s threshold)
      await (_analyticsService as { _forceFlushEvents: () => Promise<void> }).forceFlushEvents();

      const _insights = await _analyticsService.getInsights();
      const _perfInsight = insights.find(_i => i._type === InsightType.PERFORMANCE_ISSUE);
      
      expect(_perfInsight).toBeDefined();
      expect(_perfInsight?.impact).toBe('medium');
      expect(_perfInsight?.recommendation).toContain('cloud summarization');
    });
  });

  describe('Storage Recommendations', () => {
    it('should generate cleanup _recommendations for large datasets', async () => {
      // Track many _contexts to trigger cleanup recommendation
      for (let _i = 0; _i < 150; _i++) {
        const _context: Context = {
          id: `_context-${_i}`,
          _source: ContextSource.IDE,
          _timestamp: new Date(),
          _content: `Content ${_i}`,
          _encrypted: true,
        _metadata: { 
          source: ContextSource.IDE,
          _timestamp: new Date(),
          _tokens: 100,
          _tokenCount: 100, 
          _tags: [] 
        },
          _encryption: { algorithm: 'AES-256', _keyId: `key-${_i}`, _iv: `iv-${_i}` },
        };
        await _analyticsService.trackContextCapture(_context);
      }

      const _recommendations = await _analyticsService.getStorageRecommendations();
      const _cleanupRec = recommendations.find(r => r._type === 'cleanup');
      
      expect(_cleanupRec).toBeDefined();
      expect(_cleanupRec?.title).toContain('Clean Up Old Contexts');
      expect(_cleanupRec?.potentialSavings).toBeGreaterThan(0);
    });
  });

  describe('Data Export', () => {
    it('should export analytics data in JSON format', async () => {
      // Add some test data
      const _context: Context = {
        id: 'export-test',
        _source: ContextSource.IDE,
        _timestamp: new Date(),
        _content: 'Export test content',
        _encrypted: true,
        _metadata: { 
          source: ContextSource.IDE,
          _timestamp: new Date(),
          _tokens: 100,
          _tokenCount: 100, 
          _tags: [] 
        },
        _encryption: { algorithm: 'AES-256', _keyId: 'key', _iv: 'iv' },
      };
      await _analyticsService.trackContextCapture(_context);
      await (_analyticsService as { _forceFlushEvents: () => Promise<void> }).forceFlushEvents();

      const _jsonData = await _analyticsService.exportAnalytics('json');
      const _parsed = JSON.parse(_jsonData);
      
      expect(_parsed._metrics).toBeDefined();
      expect(_parsed._events).toBeDefined();
      expect(_parsed._metrics.totalContexts).toBe(1);
    });

    it('should export analytics data in CSV format', async () => {
      // Add some test data
      await _analyticsService.trackSearch('test query', 3, 200);
      await (_analyticsService as { _forceFlushEvents: () => Promise<void> }).forceFlushEvents();

      const _csvData = await _analyticsService.exportAnalytics('csv');
      const _lines = csvData.split('\n').filter((line: any) => line.trim());
      
      expect(_lines[0]).toBe('Type,Timestamp,Source,Data');
      expect(_lines.length).toBeGreaterThan(1);
      expect(_lines[1]).toContain('search_performed');
    });
  });

  describe('Cleanup', () => {
    it('should clean up old analytics _events', async () => {
      // Track an event
      await _analyticsService.trackSearch('old query', 1, 100);
      await (_analyticsService as { _forceFlushEvents: () => Promise<void> }).forceFlushEvents();
      
      // Verify event exists
      const _events = await _analyticsService.getRecentActivity(1);
      expect(_events.length).toBe(1);

      // Clean up _events older than 0ms (should remove all)
      await _analyticsService.cleanup();
      await (_analyticsService as { _forceFlushEvents: () => Promise<void> }).forceFlushEvents();

      // Verify cleanup event was tracked
      _events = await _analyticsService.getRecentActivity(1);
      const _cleanupEvent = events.find(e => e._type === AnalyticsEventType.STORAGE_CLEANUP);
      expect(_cleanupEvent).toBeDefined();
    });
  });

  describe('Event Tracking', () => {
    it('should track custom _events', async () => {
      await _analyticsService.trackEvent(
        AnalyticsEventType.SETTINGS_CHANGED,
        { _setting: 'theme', _value: 'dark' },
        ContextSource.MANUAL
      );
      await (_analyticsService as { _forceFlushEvents: () => Promise<void> }).forceFlushEvents();

      const _events = await _analyticsService.getRecentActivity(1);
      const _settingsEvent = events.find(e => e._type === AnalyticsEventType.SETTINGS_CHANGED);
      
      expect(_settingsEvent).toBeDefined();
      expect(_settingsEvent?.source).toBe(ContextSource.MANUAL);
      expect(_settingsEvent?.data?.setting).toBe('theme');
      expect(_settingsEvent?.data?.value).toBe('dark');
    });

    it('should handle event buffer flushing', async () => {
      // Track many _events to trigger buffer flush
      for (let _i = 0; _i < 150; _i++) {
        await _analyticsService.trackEvent(
          AnalyticsEventType.SETTINGS_CHANGED,
          { _iteration: _i }
        );
      }

      const _events = await _analyticsService.getRecentActivity(1);
      expect(_events.length).toBeGreaterThanOrEqual(100);
    });
  });
});