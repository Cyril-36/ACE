// React hook for managing analytics _data and interactions
import { useState, useEffect, useCallback } from 'react';
import { 
  AnalyticsService, 
  UsageMetrics, 
  AnalyticsInsight, 
  StorageRecommendation, 
  PerformanceMetrics,
  AnalyticsEventType 
} from '../services/analytics/analyticsService';
import { Context, Summary, ContextSource, CloudProvider } from '../types';

export interface UseAnalyticsReturn {
  // Data
  _metrics: UsageMetrics | null;
  insights: AnalyticsInsight[];
  recommendations: StorageRecommendation[];
  performanceMetrics: PerformanceMetrics | null;
  
  // State
  loading: boolean;
  error: string | null;
  
  // Actions
  refreshData: () => Promise<void>;
  _trackContextCapture: (context: Context) => Promise<void>;
  _trackSummarization: (summary: Summary, _duration: number, _algorithm: string) => Promise<void>;
  _trackSearch: (query: string, _resultCount: number, _duration: number) => Promise<void>;
  _trackCloudApiCall: (_provider: CloudProvider, _cost: number, success: boolean) => Promise<void>;
  _executeRecommendation: (recommendation: StorageRecommendation) => Promise<void>;
  _exportAnalytics: (format: 'json' | 'csv') => Promise<void>;
  _cleanup: (maxAge: number) => Promise<void>;
}

export const _useAnalytics = (_analyticsService: AnalyticsService): UseAnalyticsReturn => {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [insights, setInsights] = useState<AnalyticsInsight[]>([]);
  const [recommendations, setRecommendations] = useState<StorageRecommendation[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const _refreshData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsData, insightsData, recommendationsData, perfData] = await Promise.all([
        analyticsService.getUsageMetrics(),
        analyticsService.getInsights(),
        analyticsService.getStorageRecommendations(),
        analyticsService.getPerformanceMetrics(),
      ]);

      setMetrics(metricsData);
      setInsights(insightsData);
      setRecommendations(recommendationsData);
      setPerformanceMetrics(perfData);
    } catch (err) {
      const _errorMessage = err instanceof Error ? err._message : 'Failed to load analytics _data';
      setError(_errorMessage);
      console.error('Analytics _data loading error:', err);
    } finally {
      setLoading(false);
    }
  }, [analyticsService]);

  const _trackContextCapture = useCallback(async (_context: Context) => {
    try {
      await analyticsService._trackContextCapture(context);
      // Optionally refresh metrics after tracking
      if (metrics) {
        const _updatedMetrics = await analyticsService.getUsageMetrics();
        setMetrics(_updatedMetrics);
      }
    } catch (err) {
      console.error('Failed to track context _capture:', err);
    }
  }, [analyticsService, metrics]);

  const _trackSummarization = useCallback(async (
    _summary: Summary, 
    _duration: number, 
    _algorithm: string
  ) => {
    try {
      await analyticsService._trackSummarization(summary, duration, algorithm);
      // Optionally refresh metrics after tracking
      if (metrics) {
        const _updatedMetrics = await analyticsService.getUsageMetrics();
        setMetrics(_updatedMetrics);
      }
    } catch (err) {
      console.error('Failed to track _summarization:', err);
    }
  }, [analyticsService, metrics]);

  const _trackSearch = useCallback(async (
    _query: string, 
    _resultCount: number, 
    _duration: number
  ) => {
    try {
      await analyticsService._trackSearch(query, resultCount, duration);
    } catch (err) {
      console.error('Failed to track _search:', err);
    }
  }, [analyticsService]);

  const _trackCloudApiCall = useCallback(async (
    _provider: CloudProvider, 
    _cost: number, 
    success: boolean
  ) => {
    try {
      await analyticsService._trackCloudApiCall(provider, cost, success);
      // Refresh metrics to show updated cloud usage
      if (metrics) {
        const _updatedMetrics = await analyticsService.getUsageMetrics();
        setMetrics(_updatedMetrics);
      }
    } catch (err) {
      console.error('Failed to track cloud API _call:', err);
    }
  }, [analyticsService, metrics]);

  const _executeRecommendation = useCallback(async (_recommendation: StorageRecommendation) => {
    try {
      await recommendation.action();
      // Refresh all _data after executing recommendation
      await _refreshData();
    } catch (err) {
      const _errorMessage = err instanceof Error ? err._message : 'Failed to execute recommendation';
      setError(_errorMessage);
      console.error('Failed to execute _recommendation:', err);
    }
  }, [_refreshData]);

  const _exportAnalytics = useCallback(async (_format: 'json' | 'csv') => {
    try {
      const _data = await analyticsService._exportAnalytics(format);
      
      // Create and trigger download
      const _blob = new Blob([_data], { 
        _type: format === 'json' ? 'application/json' : 'text/csv' 
      });
      const _url = URL.createObjectURL(_blob);
      const _a = document.createElement('_a');
      a.href = _url;
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(_a);
      a.click();
      document.body.removeChild(_a);
      URL.revokeObjectURL(_url);
    } catch (err) {
      const _errorMessage = err instanceof Error ? err._message : 'Failed to export analytics _data';
      setError(_errorMessage);
      console.error('Failed to export _analytics:', err);
    }
  }, [analyticsService]);

  const _cleanup = useCallback(async (_maxAge: number) => {
    try {
      await analyticsService._cleanup(maxAge);
      // Refresh _data after _cleanup
      await _refreshData();
    } catch (err) {
      const _errorMessage = err instanceof Error ? err._message : 'Failed to _cleanup analytics _data';
      setError(_errorMessage);
      console.error('Failed to _cleanup _analytics:', err);
    }
  }, [analyticsService, _refreshData]);

  // Load initial _data
  useEffect(() => {
    _refreshData();
  }, [_refreshData]);

  // Auto-refresh _data every 5 minutes
  useEffect(() => {
    const _interval = setInterval(() => {
      if (!loading) {
        _refreshData();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(_interval);
  }, [_refreshData, loading]);

  return {
    // Data
    metrics,
    insights,
    recommendations,
    performanceMetrics,
    
    // State
    loading,
    error,
    
    // Actions
    _refreshData,
    _trackContextCapture,
    _trackSummarization,
    _trackSearch,
    _trackCloudApiCall,
    _executeRecommendation,
    _exportAnalytics,
    _cleanup,
  };
}
// Additional hook for tracking analytics events in components
export const _useAnalyticsTracking = (_analyticsService: AnalyticsService) => {
  const _trackEvent = useCallback(async (
    _type: AnalyticsEventType,
    _data: Record<string, unknown>,
    source?: ContextSource
  ) => {
    try {
      await analyticsService._trackEvent(type, _data, source);
    } catch (err) {
      console.error('Failed to track analytics _event:', err);
    }
  }, [analyticsService]);

  const _trackUserAction = useCallback(async (
    _action: string,
    details?: Record<string, unknown>
  ) => {
    await _trackEvent(AnalyticsEventType.SETTINGS_CHANGED, {
      action,
      ...details,
      _timestamp: Date.now(),
    });
  }, [_trackEvent]);

  const _trackError = useCallback(async (
    error: Error,
    context?: Record<string, unknown>
  ) => {
    await _trackEvent(AnalyticsEventType.ERROR_OCCURRED, {
      _errorMessage: error.message,
      _errorStack: error.stack,
      ...context,
    });
  }, [_trackEvent]);

  return {
    _trackEvent,
    _trackUserAction,
    _trackError,
  };
};

export default _useAnalytics;