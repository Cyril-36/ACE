// Analytics Dashboard component for displaying usage statistics and insights
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { 
  UsageMetrics, 
  AnalyticsInsight, 
  StorageRecommendation, 
  PerformanceMetrics,
  AnalyticsService 
} from '../services/analytics/analyticsService';
import { ContextSource } from '../types';

import { optimizationService } from '../services/performance/optimizationService';

// Lazy load heavy chart components for better initial load time

interface AnalyticsDashboardProps {
  analyticsService: AnalyticsService;
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }>;
}

// Memoized sub-components for better performance

const AnalyticsDashboardComponent: React.FC<AnalyticsDashboardProps> = ({ analyticsService }) => {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [insights, setInsights] = useState<AnalyticsInsight[]>([]);
  const [recommendations, setRecommendations] = useState<StorageRecommendation[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Used in error handling
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'insights' | 'storage'>('overview');

  // Memoized callback to prevent unnecessary re-renders
  const loadAnalyticsData = useCallback(async () => {
    optimizationService.startTimer('analytics_data_load');
    
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
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
      console.error('Analytics data loading failed:', err);
    } finally {
      setLoading(false);
      optimizationService.endTimer('analytics_data_load');
    }
  }, [analyticsService]);

  useEffect(() => {
    void loadAnalyticsData();
    
    // Set up periodic refresh with cleanup
    const refreshInterval = setInterval(() => void loadAnalyticsData(), 5 * 60 * 1000); // 5 minutes
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [loadAnalyticsData]);

  // Memoized utility functions for better performance
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const formatDuration = useCallback((ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }, []);
  // Memoized chart data computations
  const contextSourceChartData = useMemo((): ChartData<'bar'> => {
    if (!metrics) return { labels: [], datasets: [] };

    const sources = Object.keys(metrics.contextsBySource) as ContextSource[];
    const data = sources.map(source => metrics.contextsBySource[source]);
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

    return {
      labels: sources.map(s => s.toUpperCase()),
      datasets: [{
        label: 'Contexts by Source',
        data,
        backgroundColor: colors[0],
      }]
    };
  }, [metrics]);
  const activityChartData = useMemo(() => {
    if (!metrics) return { labels: [], datasets: [] };

    const last7Days = metrics._dailyActivity.slice(-7);
    const labels = last7Days.map(day => new Date(day.date).toLocaleDateString());
    const contextData = last7Days.map(day => day.contexts);
    const summaryData = last7Days.map(day => day.summaries);

    return {
      labels,
      datasets: [
        {
          label: 'Contexts',
          data: contextData,
          backgroundColor: '#3B82F6',
          borderColor: '#2563EB',
        },
        {
          label: 'Summaries',
          data: summaryData,
          backgroundColor: '#10B981',
          borderColor: '#059669',
        }
      ]
    };
  }, [metrics]);
  // const performanceStatus = useMemo(() => {
  //   if (!performanceMetrics) return null;
  //   const avgSummarization = performanceMetrics.averageSummarizationTime;
  //   const avgSearch = performanceMetrics.averageSearchTime;
  //   const errorRate = performanceMetrics.errorRate;
  //   return {
  //     summarization: avgSummarization < 3000 ? 'Good' : avgSummarization < 8000 ? 'Fair' : 'Poor',
  //     search: avgSearch < 500 ? 'Good' : avgSearch < 1500 ? 'Fair' : 'Poor',
  //     errors: errorRate < 0.05 ? 'Low' : errorRate < 0.15 ? 'Medium' : 'High',
  //   };
  // }, [performanceMetrics]);

  // Weekly activity chart data computation (reserved for future weekly view)
  // const weeklyActivityChartData = useMemo(() => {
  //   if (!metrics) return { labels: [], datasets: [] };
  //   const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  //   const contextData = [12, 19, 3, 5, 2, 3, 9]; // Mock data
  //   const summaryData = [8, 15, 2, 4, 1, 2, 7]; // Mock data
  //   return {
  //     labels,
  //     datasets: [
  //       {
  //         label: 'Contexts',
  //         data: contextData,
  //         borderColor: '#3B82F6',
  //         backgroundColor: 'rgba(59, 130, 246, 0.1)',
  //       },
  //       {
  //         label: 'Summaries',
  //         data: summaryData,
  //         borderColor: '#10B981',
  //         backgroundColor: 'rgba(16, 185, 129, 0.1)',
  //       }
  //     ]
  //   };
  // }, [metrics]);

  const executeRecommendation = async (recommendation: StorageRecommendation) => {
    try {
      await recommendation.action();
      await loadAnalyticsData(); // Refresh data
    } catch (error) {
      console.error('Failed to execute recommendation:', error);
    }
  };

  const exportData = async (format: 'json' | 'csv') => {
    try {
      const data = await analyticsService.exportAnalytics(format);
      const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  if (loading) {
    return (
      <div className="analytics-dashboard loading" role="status" aria-label="Loading analytics data">
        <div className="loading-spinner"></div>
        <p>Loading analytics data...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="analytics-dashboard error" role="alert">
        <p>{error || 'Failed to load analytics data. Please try again.'}</p>
        <button type="button" onClick={() => void loadAnalyticsData()} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard" role="main" aria-label="Analytics Dashboard">
      <div className="dashboard-header">
        <h1>Usage Analytics & Dashboard</h1>
        <div className="dashboard-actions">
          <button
            type="button"
            onClick={() => void exportData('json')}
            className="export-button"
            aria-label="Export analytics data as JSON"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => void exportData('csv')}
            className="export-button"
            aria-label="Export analytics data as CSV"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void loadAnalyticsData()}
            className="refresh-button"
            aria-label="Refresh analytics data"
          >
            Refresh
          </button>
        </div>
      </div>

      <nav className="dashboard-tabs" role="tablist">
        {(['overview', 'performance', 'insights', 'storage'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`${tab}-panel`}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <div id="overview-panel" role="tabpanel" aria-labelledby="overview-tab">
            <div className="metrics-grid">
              <div className="metric-card">
                <h2>Total Contexts</h2>
                <div className="metric-value">{metrics.totalContexts.toLocaleString()}</div>
                <div className="metric-detail">
                  Today: {metrics.contextsToday} | This Week: {metrics.contextsThisWeek}
                </div>
              </div>

              <div className="metric-card">
                <h2>Total Summaries</h2>
                <div className="metric-value">{metrics.totalSummaries.toLocaleString()}</div>
                <div className="metric-detail">
                  Today: {metrics.summariesToday} | Avg Compression: {(metrics.averageCompressionRatio * 100).toFixed(1)}%
                </div>
              </div>

              <div className="metric-card">
                <h2>Storage Used</h2>
                <div className="metric-value">{formatBytes(metrics.totalStorageUsed)}</div>
                <div className="metric-detail">
                  Contexts: {formatBytes(metrics.storageByType.contexts)} | 
                  Summaries: {formatBytes(metrics.storageByType.summaries)}
                </div>
              </div>

              <div className="metric-card">
                <h2>Cloud Usage</h2>
                <div className="metric-value">
                  ${Object.values(metrics.estimatedCloudCosts).reduce((a, b) => a + b, 0).toFixed(2)}
                </div>
                <div className="metric-detail">
                  API Calls: {Object.values(metrics.cloudApiCalls).reduce((a, b) => a + b, 0)}
                </div>
              </div>
            </div>

            <div className="charts-section">
              <div className="chart-container">
                <h3>Contexts by Source</h3>
                <SimpleBarChart data={contextSourceChartData} />
              </div>

              <div className="chart-container">
                <h3>Daily Activity (Last 7 Days)</h3>
                <SimpleLineChart data={activityChartData} />
              </div>
            </div>

            <div className="recent-activity">
              <h3>Context Sources Breakdown</h3>
              <div className="source-breakdown">
                {Object.entries(metrics.contextsBySource).map(([source, count]) => (
                  <div key={source} className="source-item">
                    <span className="source-name">{source.toUpperCase()}</span>
                    <span className="source-count">{count}</span>
                    <div className="source-bar">
                      <div 
                        className="source-bar-fill"
                        style={{ 
                          '--bar-width': `${(count / Math.max(...Object.values(metrics.contextsBySource))) * 100}%` 
                        } as React.CSSProperties}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'performance' && performanceMetrics && (
          <div id="performance-panel" role="tabpanel" aria-labelledby="performance-tab">
            <div className="performance-metrics">
              <div className="metric-card">
                <h3>Average Summarization Time</h3>
                <div className="metric-value">{formatDuration(performanceMetrics.averageSummarizationTime)}</div>
                <div className={`metric-status ${performanceMetrics.averageSummarizationTime > 5000 ? 'warning' : 'good'}`}>
                  {performanceMetrics.averageSummarizationTime > 5000 ? 'Slow' : 'Good'}
                </div>
              </div>

              <div className="metric-card">
                <h3>Average Search Time</h3>
                <div className="metric-value">{formatDuration(performanceMetrics.averageSearchTime)}</div>
                <div className={`metric-status ${performanceMetrics.averageSearchTime > 1000 ? 'warning' : 'good'}`}>
                  {performanceMetrics.averageSearchTime > 1000 ? 'Slow' : 'Good'}
                </div>
              </div>

              <div className="metric-card">
                <h3>Error Rate</h3>
                <div className="metric-value">{(performanceMetrics.errorRate * 100).toFixed(2)}%</div>
                <div className={`metric-status ${performanceMetrics.errorRate > 0.05 ? 'warning' : 'good'}`}>
                  {performanceMetrics.errorRate > 0.05 ? 'High' : 'Low'}
                </div>
              </div>

              <div className="metric-card">
                <h3>Storage Efficiency</h3>
                <div className="metric-value">{(performanceMetrics.storageEfficiency * 100).toFixed(1)}%</div>
                <div className={`metric-status ${performanceMetrics.storageEfficiency < 0.7 ? 'warning' : 'good'}`}>
                  {performanceMetrics.storageEfficiency < 0.7 ? 'Low' : 'Good'}
                </div>
              </div>
            </div>

            <div className="performance-details">
              <h3>Performance Breakdown</h3>
              <div className="algorithm-performance">
                <h4>Summarization Algorithms</h4>
                {Object.entries(metrics.summariesByAlgorithm).map(([algorithm, count]) => (
                  <div key={algorithm} className="algorithm-item">
                    <span className="algorithm-name">{algorithm}</span>
                    <span className="algorithm-count">{count} summaries</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div id="insights-panel" role="tabpanel" aria-labelledby="insights-tab">
            <div className="insights-section">
              <h3>Analytics Insights</h3>
              {insights.length === 0 ? (
                <p className="no-insights">No insights available at this time.</p>
              ) : (
                <div className="insights-list">
                  {insights.map(insight => (
                    <div key={insight.id} className={`insight-card ${insight.impact}`}>
                      <div className="insight-header">
                        <h4>{insight.title}</h4>
                        <span className={`impact-badge ${insight.impact}`}>
                          {insight.impact.toUpperCase()}
                        </span>
                      </div>
                      <p className="insight-description">{insight.description}</p>
                      {insight.recommendation && (
                        <div className="insight-recommendation">
                          <strong>Recommendation:</strong> {insight.recommendation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'storage' && (
          <div id="storage-panel" role="tabpanel" aria-labelledby="storage-tab">
            <div className="storage-section">
              <h3>Storage Management</h3>
              
              <div className="storage-overview">
                <div className="storage-breakdown">
                  <h4>Storage Breakdown</h4>
                  <div className="storage-items">
                    <div className="storage-item">
                      <span>Contexts</span>
                      <span>{formatBytes(metrics.storageByType.contexts)}</span>
                    </div>
                    <div className="storage-item">
                      <span>Summaries</span>
                      <span>{formatBytes(metrics.storageByType.summaries)}</span>
                    </div>
                    <div className="storage-item">
                      <span>Preferences</span>
                      <span>{formatBytes(metrics.storageByType.preferences)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="recommendations-section">
                <h4>Storage Recommendations</h4>
                {recommendations.length === 0 ? (
                  <p className="no-recommendations">No storage recommendations at this time.</p>
                ) : (
                  <div className="recommendations-list">
                    {recommendations.map(rec => (
                      <div key={rec.id} className="recommendation-card">
                        <div className="recommendation-header">
                          <h5>{rec.title}</h5>
                          <span className="savings-badge">
                            Save {formatBytes(rec.potentialSavings)}
                          </span>
                        </div>
                        <p className="recommendation-description">{rec.description}</p>
                        <button
                          type="button"
                          onClick={() => void executeRecommendation(rec)}
                          className="execute-button"
                          aria-label={`Execute recommendation: ${rec.title}`}
                        >
                          Execute
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// Simple chart components (would use a proper charting library in production)
const SimpleBarChart: React.FC<{ data: ChartData }> = ({ data }) => {
  if (!data.datasets[0] || data.datasets[0].data.length === 0) {
    return <div className="chart-placeholder">No data available</div>;
  }

  const maxValue = Math.max(...data.datasets[0].data);

  return (
    <div className="simple-bar-chart" role="img" aria-label="Bar chart showing context distribution">
      {data.labels.map((label, index) => (
        <div key={label} className="bar-item">
          <div className="bar-label">{label}</div>
          <div className="bar-container">
            <div 
              className="bar-fill"
              style={{ 
                '--bar-height': `${(data.datasets[0].data[index] / maxValue) * 100}%`,
                '--bar-color': data.datasets[0].backgroundColor || '#3B82F6'
              } as React.CSSProperties}
              role="img"
              aria-label={`${label}: ${data.datasets[0].data[index]}`}
            ></div>
          </div>
          <div className="bar-value">{data.datasets[0].data[index]}</div>
        </div>
      ))}
    </div>
  );
};

const SimpleLineChart: React.FC<{ data: ChartData }> = ({ data }) => {
  if (!data.datasets[0] || data.datasets[0].data.length === 0) {
    return <div className="chart-placeholder">No data available</div>;
  }

  return (
    <div className="simple-line-chart" role="img" aria-label="Line chart showing daily activity">
      <div className="chart-legend">
        {data.datasets.map((dataset, index) => (
          <div key={index} className="legend-item">
            <div 
              className="legend-color"
              style={{ '--legend-color': dataset.borderColor } as React.CSSProperties}
            ></div>
            <span>{dataset.label}</span>
          </div>
        ))}
      </div>
      <div className="chart-area">
        <div className="chart-grid">
          {data.labels.map((label, index) => {
            const maxValue = Math.max(...data.datasets.flatMap(d => d.data));
            return (
              <div key={label} className="grid-item">
                <div className="grid-label">{label}</div>
                <div className="grid-bars">
                  {data.datasets.map((dataset, datasetIndex) => {
                    const height = maxValue > 0 ? (dataset.data[index] / maxValue) * 100 : 0;
                    return (
                      <div
                        key={datasetIndex}
                        className="grid-bar"
                        style={{
                          '--grid-bar-height': `${height}%`,
                          '--grid-bar-color': dataset.borderColor,
                        } as React.CSSProperties}
                        role="img"
                        aria-label={`${dataset.label} on ${label}: ${dataset.data[index]}`}
                      ></div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const AnalyticsDashboard = memo(AnalyticsDashboardComponent);
AnalyticsDashboard.displayName = 'AnalyticsDashboard';

export default AnalyticsDashboard;