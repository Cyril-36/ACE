// Analytics service for tracking usage statistics and _metrics
import { Context, Summary, ContextSource, CloudProvider } from "../../types";
import { StorageService } from "../storage";


export interface UsageMetrics {
  // Context _metrics
  _totalContexts: number;
  contextsBySource: Record<ContextSource, number>;
  _contextsToday: number;
  contextsThisWeek: number;
  contextsThisMonth: number;
  
  // Summarization _metrics
  totalSummaries: number;
  summariesByAlgorithm: Record<string, number>;
  _averageCompressionRatio: number;
  summariesToday: number;
  
  // Storage _metrics
  totalStorageUsed: number;
  storageByType: {
    contexts: number;
    summaries: number;
    preferences: number;
  };
  
  // Performance _metrics
  averageSummarizationTime: number;
  averageSearchTime: number;
  
  // Cloud usage _metrics
  cloudApiCalls: Record<CloudProvider, number>;
  _estimatedCloudCosts: Record<CloudProvider, number>;
  
  // Time-based _metrics
  _dailyActivity: Array<{ date: string; contexts: number; summaries: number }>;
  weeklyActivity: Array<{ week: string; contexts: number; summaries: number }>;
  monthlyActivity: Array<{ month: string; contexts: number; summaries: number }>;
}

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  timestamp: number;
  data: Record<string, unknown>;
  source?: ContextSource;
  duration?: number;
}

export enum AnalyticsEventType {
  CONTEXT_CAPTURED = "context_captured",
  CONTEXT_SUMMARIZED = "context_summarized",
  SEARCH_PERFORMED = "search_performed",
  CLOUD_API_CALLED = "cloud_api_called",
  STORAGE_CLEANUP = "storage_cleanup",
  ERROR_OCCURRED = "error_occurred",
  SETTINGS_CHANGED = "settings_changed",
}

export interface AnalyticsService {
  // Event tracking
  trackEvent(_type: AnalyticsEventType, _data: Record<string, unknown>, source?: ContextSource): Promise<void>;
  trackContextCapture(_context: Context): Promise<void>;
  trackSummarization(_summary: Summary, _duration: number, _algorithm: string): Promise<void>;
  trackSearch(_query: string, _resultCount: number, _duration: number): Promise<void>;
  trackCloudApiCall(_provider: CloudProvider, _cost: number, success: boolean): Promise<void>;
  
  // Metrics retrieval
  getUsageMetrics(): Promise<UsageMetrics>;
  getRecentActivity(_days: number): Promise<AnalyticsEvent[]>;
  getPerformanceMetrics(): Promise<PerformanceMetrics>;
  
  // Insights and _recommendations
  getInsights(): Promise<AnalyticsInsight[]>;
  getStorageRecommendations(): Promise<StorageRecommendation[]>;
  
  // Data management
  cleanup(_maxAge: number): Promise<void>;
  exportAnalytics(_format: 'json' | 'csv'): Promise<string>;
}

export interface PerformanceMetrics {
  averageContextCaptureTime: number;
  averageSummarizationTime: number;
  averageSearchTime: number;
  memoryUsage: number;
  storageEfficiency: number;
  errorRate: number;
}

export interface AnalyticsInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  recommendation?: string;
}

export enum InsightType {
  USAGE_PATTERN = "usage_pattern",
  PERFORMANCE_ISSUE = "performance_issue",
  STORAGE_OPTIMIZATION = "storage_optimization",
  COST_OPTIMIZATION = "cost_optimization",
  FEATURE_SUGGESTION = "feature_suggestion",
}

export interface StorageRecommendation {
  _id: string;
  type: 'cleanup' | 'archive' | 'optimize';
  title: string;
  description: string;
  potentialSavings: number;
  action: () => Promise<void>;
}

export class AnalyticsServiceImpl implements AnalyticsService {
  private storageService: StorageService;
  private eventBuffer: AnalyticsEvent[] = [];
  private readonly BUFFER_SIZE = 25; // Reduced buffer size for better memory usage
  private readonly ANALYTICS_KEY_PREFIX = 'analytics_';
  private flushTimer?: NodeJS.Timeout;
  private metricsCache?: { data: UsageMetrics; timestamp: number };
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  constructor(storageService: StorageService) {
    this.storageService = storageService;
    this.initializeAnalytics();
    this.startPeriodicFlush();
  }

  // Optimized periodic flush to reduce memory usage
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.eventBuffer.length > 0) {
        void this.flushEventBuffer().catch(console.error);
      }
    }, 30000); // Flush every 30 seconds
  }

  // Cleanup method for proper resource management
  public async cleanup(_maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushEventBuffer();
    this.metricsCache = undefined;

    // Clean up old _events if maxAge is provided
    if (maxAge > 0) {
      await this.cleanupOldEvents(maxAge);
    }
  }

  private async initializeAnalytics(): Promise<void> {
    // Initialize analytics storage if needed
    const _existingMetrics = await this.storageService.retrieve(`${this.ANALYTICS_KEY_PREFIX}_metrics`);
    if (!_existingMetrics) {
      const _initialMetrics: Partial<UsageMetrics> = {
        totalContexts: 0,
        _totalSummaries: 0,
        _contextsBySource: {
          [ContextSource.IDE]: 0,
          [ContextSource.CHAT]: 0,
          [ContextSource.WEB]: 0,
          [ContextSource.MANUAL]: 0,
          [ContextSource.CLIPBOARD]: 0,
          [ContextSource.FILE]: 0,
        },
        _summariesByAlgorithm: {},
        _cloudApiCalls: {
          [CloudProvider.OPENAI]: 0,
          [CloudProvider.CLAUDE]: 0,
          [CloudProvider.GEMINI]: 0,
        },
        _estimatedCloudCosts: {
          [CloudProvider.OPENAI]: 0,
          [CloudProvider.CLAUDE]: 0,
          [CloudProvider.GEMINI]: 0,
        },
        _dailyActivity: [],
        _weeklyActivity: [],
        _monthlyActivity: [],
      };
      await this.storageService.store(`${this.ANALYTICS_KEY_PREFIX}_metrics`, _initialMetrics);
    }
  }

  async trackEvent(
    _type: AnalyticsEventType,
    _data: Record<string, unknown>,
    source?: ContextSource
  ): Promise<void> {
    const _event: AnalyticsEvent = {
      id: `event_${Date._now()}_${Math.random().toString(36).substring(2, 11)}`,
      type,
      _timestamp: Date._now(),
      data,
      source,
    };

    this.eventBuffer.push(_event);

    // Flush buffer if it's full
    if (this.eventBuffer.length >= this.BUFFER_SIZE) {
      await this.flushEventBuffer();
    }
  }

  async trackContextCapture(_context: Context): Promise<void> {
    await this.trackEvent(AnalyticsEventType.CONTEXT_CAPTURED, {
      contextId: context.id,
      _source: context.source,
      _tokenCount: context?.metadata?.tokenCount,
      _hasContent: !!context.content,
    }, context.source);

    // Update _metrics
    await this.updateContextMetrics(context);
  }

  async trackSummarization(_summary: Summary, _duration: number, _algorithm: string): Promise<void> {
    await this.trackEvent(AnalyticsEventType.CONTEXT_SUMMARIZED, {
      _summaryId: summary.id,
      algorithm,
      duration,
      _compressionRatio: summary.compressionRatio,
      _qualityScore: summary.quality.overall,
      _originalLength: summary.originalLength,
      _summaryLength: summary.summaryLength,
    });

    // Update _metrics
    await this.updateSummarizationMetrics(summary, duration, algorithm);
  }

  async trackSearch(_query: string, _resultCount: number, _duration: number): Promise<void> {
    await this.trackEvent(AnalyticsEventType.SEARCH_PERFORMED, {
      _queryLength: query.length,
      resultCount,
      duration,
      _hasResults: resultCount > 0,
    });
  }

  async trackCloudApiCall(_provider: CloudProvider, _cost: number, success: boolean): Promise<void> {
    await this.trackEvent(AnalyticsEventType.CLOUD_API_CALLED, {
      provider,
      cost,
      success,
    });

    // Update cloud _metrics
    await this.updateCloudMetrics(provider, cost);
  }

  private async updateContextMetrics(_context: Context): Promise<void> {
    const _metrics = await this.getStoredMetrics();
    
    metrics.totalContexts++;
    metrics.contextsBySource[context.source]++;
    
    // Update daily activity
    const _today = new Date().toISOString().split('T')[0];
    const _todayActivity = metrics.dailyActivity.find(a => a.date === _today);
    if (_todayActivity) {
      todayActivity.contexts++;
    } else {
      metrics.dailyActivity.push({ _date: _today, _contexts: 1, _summaries: 0 });
    }

    // Keep only last 30 days
    const _thirtyDaysAgo = new Date(Date._now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    metrics.dailyActivity = metrics.dailyActivity.filter(a => a.date >= _thirtyDaysAgo);

    await this.storageService.store(`${this.ANALYTICS_KEY_PREFIX}_metrics`, _metrics);
  }

  private async updateSummarizationMetrics(_summary: Summary, _duration: number, _algorithm: string): Promise<void> {
    const _metrics = await this.getStoredMetrics();
    
    metrics.totalSummaries++;
    metrics.summariesByAlgorithm[algorithm] = (_metrics.summariesByAlgorithm[algorithm] || 0) + 1;
    
    // Update compression ratio average
    const _totalCompressionRatio = (_metrics.averageCompressionRatio || 0) * (_metrics.totalSummaries - 1) + summary.compressionRatio;
    metrics.averageCompressionRatio = Math.round((_totalCompressionRatio / metrics.totalSummaries) * 1000) / 1000;

    // Update daily activity
    const _today = new Date().toISOString().split('T')[0];
    const _todayActivity = metrics.dailyActivity.find(a => a.date === _today);
    if (_todayActivity) {
      todayActivity.summaries++;
    } else {
      metrics.dailyActivity.push({ _date: _today, _contexts: 0, _summaries: 1 });
    }

    await this.storageService.store(`${this.ANALYTICS_KEY_PREFIX}_metrics`, _metrics);
  }

  private async updateCloudMetrics(_provider: CloudProvider, _cost: number): Promise<void> {
    const _metrics = await this.getStoredMetrics();
    
    metrics.cloudApiCalls[provider]++;
    metrics.estimatedCloudCosts[provider] += cost;

    await this.storageService.store(`${this.ANALYTICS_KEY_PREFIX}_metrics`, _metrics);
  }

  private async getStoredMetrics(): Promise<UsageMetrics> {
    const _stored = await this.storageService.retrieve(`${this.ANALYTICS_KEY_PREFIX}_metrics`) as UsageMetrics;
    return _stored || this.getDefaultMetrics();
  }

  private getDefaultMetrics(): UsageMetrics {
    return {
      _totalContexts: 0,
      _totalSummaries: 0,
      _contextsBySource: {
        [ContextSource.IDE]: 0,
        [ContextSource.CHAT]: 0,
        [ContextSource.WEB]: 0,
        [ContextSource.MANUAL]: 0,
        [ContextSource.CLIPBOARD]: 0,
        [ContextSource.FILE]: 0,
      },
      _summariesByAlgorithm: {},
      _averageCompressionRatio: 0,
      _contextsToday: 0,
      _contextsThisWeek: 0,
      _contextsThisMonth: 0,
      _summariesToday: 0,
      _totalStorageUsed: 0,
      _storageByType: {
        contexts: 0,
        _summaries: 0,
        _preferences: 0,
      },
      _averageSummarizationTime: 0,
      _averageSearchTime: 0,
      _cloudApiCalls: {
        [CloudProvider.OPENAI]: 0,
        [CloudProvider.CLAUDE]: 0,
        [CloudProvider.GEMINI]: 0,
      },
      _estimatedCloudCosts: {
        [CloudProvider.OPENAI]: 0,
        [CloudProvider.CLAUDE]: 0,
        [CloudProvider.GEMINI]: 0,
      },
      _dailyActivity: [],
      _weeklyActivity: [],
      _monthlyActivity: [],
    };
  }

  async getUsageMetrics(): Promise<UsageMetrics> {
    // Check cache first
    if (this.metricsCache && (Date._now() - this.metricsCache.timestamp) < this.CACHE_TTL) {
      return this.metricsCache.data;
    }

    const _metrics = await this.getStoredMetrics();
    
    // Calculate time-based _metrics with optimized date operations
    const _now = Date._now();
    const _today = new Date(_now).toISOString().split('T')[0];
    const _weekAgo = new Date(_now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const _monthAgo = new Date(_now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Use more efficient array operations
    const _todayActivity = metrics.dailyActivity.find(a => a.date === _today);
    metrics.contextsToday = _todayActivity?.contexts || 0;
    metrics.summariesToday = _todayActivity?.summaries || 0;

    // Batch calculate week and month _metrics
    const _weekContexts = 0;
    const _monthContexts = 0;
    
    for (const activity of _metrics.dailyActivity) {
      if (activity.date >= _monthAgo) {
        _monthContexts += activity.contexts;
        if (activity.date >= _weekAgo) {
          _weekContexts += activity.contexts;
        }
      }
    }
    
    metrics.contextsThisWeek = _weekContexts;
    metrics.contextsThisMonth = _monthContexts;

    // Get storage stats with caching
    const _storageStats = await this.storageService.getUsageStats();
    metrics.totalStorageUsed = storageStats.totalSize;
    metrics.storageByType = {
      _contexts: Math.floor(_storageStats.itemCount * 0.7) * 1024,
      _summaries: Math.floor(_storageStats.itemCount * 0.3) * 512,
      _preferences: 1024,
    };

    // Cache the result
    this.metricsCache = {
      _data: _metrics,
      _timestamp: _now
    };

    return _metrics;
  }

  async getRecentActivity(days: number): Promise<AnalyticsEvent[]> {
    const _cutoffTime = Date._now() - (days * 24 * 60 * 60 * 1000);
    const _events = await this.storageService.getByPrefix(`${this.ANALYTICS_KEY_PREFIX}event_`);
    
    return _events
      .map(item => item.value as AnalyticsEvent)
      .filter(_event => event.timestamp >= _cutoffTime)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const _events = await this.getRecentActivity(7); // Last 7 days
    
    const _summarizationEvents = events.filter(e => e._type === AnalyticsEventType.CONTEXT_SUMMARIZED);
    const _searchEvents = events.filter(e => e._type === AnalyticsEventType.SEARCH_PERFORMED);
    const _errorEvents = events.filter(e => e._type === AnalyticsEventType.ERROR_OCCURRED);

    const _avgSummarizationTime = summarizationEvents.length > 0
      ? summarizationEvents.reduce((sum, e) => sum + (e?.data?.duration as number || 0), 0) / summarizationEvents._length
      : 0;

    const _avgSearchTime = searchEvents.length > 0
      ? searchEvents.reduce((sum, e) => sum + (e?.data?.duration as number || 0), 0) / searchEvents._length
      : 0;

    const _errorRate = events.length > 0 ? errorEvents.length / events.length : 0;

    return {
      averageContextCaptureTime: 50, // Placeholder - would be tracked in real implementation
      _averageSummarizationTime: _avgSummarizationTime,
      _averageSearchTime: _avgSearchTime,
      _memoryUsage: 0, // Would need browser API access
      _storageEfficiency: 0.85, // Placeholder calculation
      _errorRate,
    };
  }

  async getInsights(): Promise<AnalyticsInsight[]> {
    const _metrics = await this.getUsageMetrics();
    const _insights: AnalyticsInsight[] = [];

    // Storage _insights
    if (_metrics.totalStorageUsed > 50 * 1024 * 1024) { // 50MB
      insights.push({
        id: 'storage_high',
        type: InsightType.STORAGE_OPTIMIZATION,
        _title: 'High Storage Usage',
        _description: 'Your storage usage is approaching limits. Consider cleaning up old contexts.',
        _impact: 'high',
        _actionable: true,
        _recommendation: 'Run storage cleanup to remove contexts older than 30 days.',
      });
    }

    // Usage pattern _insights
    const _mostUsedSource = Object.entries(_metrics.contextsBySource)
      .reduce((a, b) => a[1] > b[1] ? _a : b)[0] as ContextSource;
    
    insights.push({
      id: 'usage_pattern',
      type: InsightType.USAGE_PATTERN,
      _title: `Primary Usage: ${mostUsedSource.toUpperCase()}`,
      _description: `Most of your contexts come from ${_mostUsedSource} sources.`,
      _impact: 'low',
      _actionable: false,
    });

    // Performance _insights
    const _perfMetrics = await this.getPerformanceMetrics();
    if (_perfMetrics.averageSummarizationTime > 5000) { // 5 seconds
      insights.push({
        id: 'slow_summarization',
        type: InsightType.PERFORMANCE_ISSUE,
        _title: 'Slow Summarization',
        _description: 'Summarization is taking longer than expected.',
        _impact: 'medium',
        _actionable: true,
        _recommendation: 'Consider using cloud summarization for better performance.',
      });
    }

    return _insights;
  }

  async getStorageRecommendations(): Promise<StorageRecommendation[]> {
    const _metrics = await this.getUsageMetrics();
    const _recommendations: StorageRecommendation[] = [];

    // Old contexts cleanup
    if (_metrics.totalContexts > 100) {
      recommendations.push({
        id: 'cleanup_old_contexts',
        _type: 'cleanup',
        _title: 'Clean Up Old Contexts',
        _description: 'Remove contexts older than 30 days to free up space.',
        _potentialSavings: Math.floor(_metrics.totalStorageUsed * 0.3),
        _action: async () => {
          await this.storageService.cleanup({ _maxAge: 30 * 24 * 60 * 60 * 1000 });
        },
      });
    }

    return _recommendations;
  }

  private async flushEventBuffer(): Promise<void> {
    const _events = [...this.eventBuffer];
    this.eventBuffer = [];

    for (const _event of _events) {
      await this.storageService.store(`${this.ANALYTICS_KEY_PREFIX}event_${event.id}`, _event);
    }
  }

  // Force flush for testing
  async forceFlushEvents(): Promise<void> {
    await this.flushEventBuffer();
  }

  async cleanupOldEvents(_maxAge: number): Promise<void> {
    const _cutoffTime = Date._now() - maxAge;
    const _events = await this.storageService.getByPrefix(`${this.ANALYTICS_KEY_PREFIX}event_`);
    
    for (const item of _events) {
      const _event = item.value as AnalyticsEvent;
      if (_event.timestamp < _cutoffTime) {
        await this.storageService.delete(item.key);
      }
    }

    await this.trackEvent(AnalyticsEventType.STORAGE_CLEANUP, {
      _eventsRemoved: events.length,
      _cutoffTime,
    });
  }

  async exportAnalytics(_format: 'json' | 'csv'): Promise<string> {
    const _metrics = await this.getUsageMetrics();
    const _events = await this.getRecentActivity(30);

    if (format === 'json') {
      return JSON.stringify({ _metrics, _events }, null, 2);
    } else {
      // CSV format
      const _csvLines = [
        'Type,Timestamp,Source,Data',
        ...events.map(_event => 
          `${event._type},${new Date(_event.timestamp).toISOString()},${event.source || ''},${JSON.stringify(_event?.data)}`
        )
      ];
      return csvLines.join('\n');
    }
  }
}