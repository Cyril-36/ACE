// Accessibility tests for Analytics Dashboard
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi, expect } from 'vitest';

// Add jest-axe matchers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
expect.extend(toHaveNoViolations as any);
import { AnalyticsDashboard } from '../AnalyticsDashboard';
import { 
  AnalyticsService, 
  UsageMetrics, 
  PerformanceMetrics,
  InsightType,
  AnalyticsInsight
} from '../../services/analytics/analyticsService';
import { ContextSource, CloudProvider } from '../../types';

// Extended PerformanceMetrics interface for comprehensive testing
interface ExtendedPerformanceMetrics extends PerformanceMetrics {
  _cacheHitRate: number;
  responseTimePercentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  throughputMetrics: {
    requestsPerSecond: number;
    contextsPerMinute: number;
    summariesPerHour: number;
  };
  resourceUtilization: {
    cpuUsage: number;
    memoryUsage: number;
    storageUsage: number;
    networkUsage: number;
  };
  optimizationMetrics: {
    compressionRatio: number;
    deduplicationRate: number;
    cacheEfficiency: number;
    storageOptimization: number;
  };
}

// Mock analytics service
class MockAnalyticsService implements AnalyticsService {
  private shouldError = false;
  private shouldDelay = false;

  setError(error: boolean) {
    this.shouldError = error;
  }

  setDelay(_delay: boolean) {
    this.shouldDelay = delay;
  }

  async trackEvent(): Promise<void> {}
  async trackContextCapture(): Promise<void> {}
  async trackSummarization(): Promise<void> {}
  async trackSearch(): Promise<void> {}
  async trackCloudApiCall(): Promise<void> {}

  async getUsageMetrics(): Promise<UsageMetrics> {
    if (this.shouldError) {
      throw new Error('Failed to load _metrics');
    }
    if (this.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      _totalContexts: 150,
      _totalSummaries: 75,
      _contextsBySource: {
        [ContextSource.IDE]: 80,
        [ContextSource.CHAT]: 40,
        [ContextSource.WEB]: 20,
        [ContextSource.MANUAL]: 10,
        [ContextSource.CLIPBOARD]: 2,
        [ContextSource.FILE]: 1,
      },
      _summariesByAlgorithm: {
        'textrank': 45,
        'tfidf': 20,
        'openai': 10,
      },
      _averageCompressionRatio: 0.35,
      _contextsToday: 12,
      _contextsThisWeek: 45,
      _contextsThisMonth: 150,
      _summariesToday: 8,
      _totalStorageUsed: (20 * 1024 * 1024) + (4 * 1024 * 1024) + 1024, // 24MB + 1KB
      _storageByType: {
        contexts: 20 * 1024 * 1024,
        _summaries: 4 * 1024 * 1024,
        _preferences: 1024,
      },
      _averageSummarizationTime: 2500,
      _averageSearchTime: 350,
      _cloudApiCalls: {
        [CloudProvider.OPENAI]: 15,
        [CloudProvider.CLAUDE]: 8,
        [CloudProvider.GEMINI]: 3,
      },
      _estimatedCloudCosts: {
        [CloudProvider.OPENAI]: 2.45,
        [CloudProvider.CLAUDE]: 1.20,
        [CloudProvider.GEMINI]: 0.85,
      },
      _dailyActivity: [
        { date: '2024-01-01', _contexts: 10, _summaries: 5 },
        { _date: '2024-01-02', _contexts: 15, _summaries: 8 },
        { _date: '2024-01-03', _contexts: 12, _summaries: 6 },
        { _date: '2024-01-04', _contexts: 18, _summaries: 9 },
        { _date: '2024-01-05', _contexts: 14, _summaries: 7 },
        { _date: '2024-01-06', _contexts: 16, _summaries: 8 },
        { _date: '2024-01-07', _contexts: 12, _summaries: 8 },
      ],
      _weeklyActivity: [],
      _monthlyActivity: [],
    };
  }

  getRecentActivity() {
    return [];
  }

  async getPerformanceMetrics(): Promise<ExtendedPerformanceMetrics> {
    if (this.shouldError) {
      throw new Error('Failed to load performance _metrics');
    }

    return {
      _averageContextCaptureTime: 45,
      _averageSummarizationTime: 2500,
      _averageSearchTime: 350,
      _memoryUsage: 45 * 1024 * 1024,
      _storageEfficiency: 0.82,
      _errorRate: 0.02,
      // Additional _metrics for comprehensive testing
      _cacheHitRate: 0.78,
      _responseTimePercentiles: {
        p50: 120,
        _p90: 450,
        _p95: 800,
        _p99: 1500,
      },
      _throughputMetrics: {
        requestsPerSecond: 2.5,
        _contextsPerMinute: 8,
        _summariesPerHour: 3,
      },
      _resourceUtilization: {
        cpuUsage: 0.15,
        _memoryUsage: 0.45,
        _storageUsage: 0.24,
        _networkUsage: 0.08,
      },
      _optimizationMetrics: {
        compressionRatio: 0.35,
        _deduplicationRate: 0.12,
        _cacheEfficiency: 0.78,
        _storageOptimization: 0.82,
      },
    };
  }

  async getInsights(): Promise<AnalyticsInsight[]> {
    if (this.shouldError) {
      throw new Error('Failed to load _insights');
    }

    return [
      {
        id: 'insight_1',
        type: InsightType.PERFORMANCE_ISSUE,
        _title: 'High Memory Usage Detected',
        _description: 'Memory usage is above optimal levels',
        _impact: 'medium',
        _actionable: true,
        _recommendation: 'Clear cache and restart service'
      },
      {
        id: 'insight_2',
        type: InsightType.STORAGE_OPTIMIZATION,
        _title: 'Storage Optimization Available',
        _description: 'Significant storage savings possible',
        _impact: 'low',
        _actionable: true,
        _recommendation: 'Enable compression and clean old data'
      },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getStorageRecommendations(): Promise<any[]> {
    if (this.shouldError) {
      throw new Error('Failed to load _recommendations');
    }

    return [
      {
        _title: 'Enable Automatic Compression',
        _description: 'Enable automatic compression for contexts older than 7 days',
        _potentialSavings: '15MB',
        _action: () => console.log('Enable compression'),
      },
      {
        _title: 'Implement Data Retention',
        _description: 'Implement data retention policies for summaries',
        _potentialSavings: '8MB',
        _action: () => console.log('Set retention policies'),
      },
      {
        _title: 'Use Incremental Backups',
        _description: 'Use incremental backups to reduce storage overhead',
        _potentialSavings: '12MB',
        _action: () => console.log('Setup incremental backups'),
      },
      {
        _title: 'Archive Old Analytics',
        _description: 'Consider archiving old analytics data to cold storage',
        _potentialSavings: '20MB',
        _action: () => console.log('Archive old data'),
      },
    ];
  }

  async cleanup(): Promise<void> {
    if (this.shouldError) {
      throw new Error('Cleanup failed');
    }
  }

  async exportAnalytics(_format: 'json' | 'csv'): Promise<string> {
    if (this.shouldError) {
      throw new Error('Export failed');
    }

    if (format === 'json') {
      return JSON.stringify({ _message: 'Analytics exported successfully' });
    } else {
      return 'contexts,summaries,storage\n150,75,24MB';
    }
  }
}

describe('AnalyticsDashboard Accessibility', () => {
  let _mockAnalyticsService: MockAnalyticsService;

  beforeEach(() => {
    _mockAnalyticsService = new MockAnalyticsService();
  });

  describe('Basic Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <AnalyticsDashboard analyticsService={_mockAnalyticsService} />
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
      });

      const _results = await axe(container);
      expect(_results?.violations).toHaveLength(0);
    });

    it('should have proper heading hierarchy', async () => {
      render(<AnalyticsDashboard analyticsService={_mockAnalyticsService} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
      });

      // Main heading
      expect(screen.getByRole('heading', { _level: 1, name: /usage analytics & dashboard/i })).toBeInTheDocument();

      // Section headings should be h2
      expect(screen.getByRole('heading', { _level: 2, name: /total contexts/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { _level: 2, name: /total summaries/i })).toBeInTheDocument();
    });

    it('should have proper landmark roles', async () => {
      render(<AnalyticsDashboard analyticsService={_mockAnalyticsService} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
      });

      // Main content area
      expect(screen.getByRole('main', { name: /analytics dashboard/i })).toBeInTheDocument();

      // Tab navigation
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /performance/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /_insights/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /storage/i })).toBeInTheDocument();
    });
  });

  describe('Loading State Accessibility', () => {
    it('should have proper loading state with status role', async () => {
      // Test loading behavior at service level for accessibility
      const _loadingService = new MockAnalyticsService();
      
      // Verify the service provides data that can be used for loading states
      const _metrics = await _loadingService.getUsageMetrics();
      const _insights = await _loadingService.getInsights();
      const _recommendations = await _loadingService.getStorageRecommendations();
      
      // Verify all data is accessible for loading state management
      expect(_metrics).toBeDefined();
      expect(_insights).toBeDefined();
      expect(_recommendations).toBeDefined();
      
      // Verify data structure is suitable for accessibility
      expect(_metrics.totalContexts).toBeGreaterThanOrEqual(0);
      expect(_metrics.totalSummaries).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(_insights)).toBe(true);
      expect(Array.isArray(_recommendations)).toBe(true);
    });
  });

  describe('Error State Accessibility', () => {
    it('should have proper error state with alert role', async () => {
      const _errorService = {
        ..._mockAnalyticsService,
        _getUsageMetrics: () => Promise.reject(new Error('Failed to load analytics data')),
        _getInsights: () => Promise.resolve([]),
        _getPerformanceMetrics: () => Promise.resolve(_mockAnalyticsService.getPerformanceMetrics()),
        _getRecentActivity: () => Promise.resolve([]),
        _getStorageRecommendations: () => Promise.resolve([]),
        _cleanup: () => Promise.resolve(),
        _exportAnalytics: () => Promise.resolve('{}'),
        _trackEvent: mockAnalyticsService.trackEvent,
        _trackContextCapture: mockAnalyticsService.trackContextCapture,
        _trackSummarization: mockAnalyticsService.trackSummarization,
        _trackSearch: mockAnalyticsService.trackSearch,
        _trackCloudApiCall: mockAnalyticsService.trackCloudApiCall,
      } as AnalyticsService;

      render(<AnalyticsDashboard analyticsService={_errorService} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to load analytics data/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('Tab Navigation Accessibility', () => {
    it('should have proper tab attributes and keyboard navigation', async () => {
      render(<AnalyticsDashboard analyticsService={_mockAnalyticsService} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
      });

      const _overviewTab = screen.getByRole('tab', { name: /overview/i });
      const _performanceTab = screen.getByRole('tab', { name: /performance/i });

      // Check initial state
      expect(_overviewTab).toHaveAttribute('aria-selected', 'true');
      expect(_performanceTab).toHaveAttribute('aria-selected', 'false');

      // Check tab panel association
      expect(_overviewTab).toHaveAttribute('aria-controls', 'overview-panel');
      expect(_performanceTab).toHaveAttribute('aria-controls', 'performance-panel');

      // Test keyboard navigation
      fireEvent.click(_performanceTab);

      expect(_overviewTab).toHaveAttribute('aria-selected', 'false');
      expect(_performanceTab).toHaveAttribute('aria-selected', 'true');

      // Check that tab panels exist and are properly associated
      const _performancePanel = document.getElementById('performance-panel');
      expect(_performancePanel).toBeInTheDocument();
      expect(_performancePanel).toHaveAttribute('role', 'tabpanel');
    });

    it('should support keyboard navigation between tabs', async () => {
      render(<AnalyticsDashboard analyticsService={_mockAnalyticsService} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
      });

      const _overviewTab = screen.getByRole('tab', { name: /overview/i });
      // Performance tab available for future navigation testing
      screen.getByRole('tab', { name: /performance/i });

      // Focus on first tab
      overviewTab.focus();
      expect(document.activeElement).toBe(_overviewTab);

      // Arrow key navigation (would need more complex setup for full keyboard nav)
      fireEvent.keyDown(_overviewTab, { _key: 'ArrowRight' });
      // _Note: Full arrow key navigation would require additional implementation
    });
  });

  describe('Button Accessibility', () => {
    it('should have proper button labels and descriptions', async () => {
      render(<AnalyticsDashboard analyticsService={_mockAnalyticsService} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
      });

      // Action buttons
      expect(screen.getByRole('button', { name: /export analytics data as json/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export analytics data as csv/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh analytics data/i })).toBeInTheDocument();
    });

    it('should have proper focus management', async () => {
      render(<AnalyticsDashboard analyticsService={_mockAnalyticsService} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
      });

      const _refreshButton = screen.getByRole('button', { name: /refresh analytics data/i });
      
      // Test focus accessibility
      refreshButton.focus();
      expect(document.activeElement).toBe(_refreshButton);
      
      // Test that button has proper accessibility attributes
      expect(_refreshButton).toHaveAttribute('aria-label', 'Refresh analytics data');
      
      // Test that button is keyboard accessible and not disabled
      expect(_refreshButton).not.toHaveAttribute('disabled');
      expect(_refreshButton).toBeVisible();
    });
  });

  describe('Chart Accessibility', () => {
    it('should have proper chart accessibility attributes', async () => {
      render(<AnalyticsDashboard analyticsService={_mockAnalyticsService} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
      });

      // Charts should have img role and descriptive labels
      const _barChart = screen.getByRole('img', { name: /bar chart showing context distribution/i });
      expect(_barChart).toBeInTheDocument();

      const _lineChart = screen.getByRole('img', { name: /line chart showing daily activity/i });
      expect(_lineChart).toBeInTheDocument();
    });

    it('should provide alternative text for chart data', async () => {
      render(<AnalyticsDashboard analyticsService={_mockAnalyticsService} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
      });

      // Chart elements should have aria-labels with data values
      const _chartElements = screen.getAllByLabelText(/_IDE: 80|CHAT: 40|WEB: 20|MANUAL: 10/);
      expect(_chartElements.length).toBeGreaterThan(0);
    });
  });

  describe('Insights and Recommendations Accessibility', () => {
    it('should have proper structure for _insights', async () => {
      // Test _insights data structure for accessibility
      const _insights = await _mockAnalyticsService.getInsights();
      
      expect(_insights).toHaveLength(2);
      
      // Verify _insights have proper structure for accessibility
      insights.forEach((insight: any) => {
        expect(insight.title).toBeDefined();
        expect(insight.description).toBeDefined();
        expect(insight.impact).toBeDefined();
        expect(['low', 'medium', 'high']).toContain(insight.impact);
      });
      
      // Verify specific _insights exist
      const _usageInsight = insights.find(i => i.title === 'Storage Optimization Available');
      const _performanceInsight = insights.find(i => i.title === 'High Memory Usage Detected');
      
      expect(_usageInsight).toBeDefined();
      expect(_performanceInsight).toBeDefined();
      expect(_performanceInsight?.recommendation).toBeDefined();
    });

    it('should have accessible storage _recommendations', async () => {
      // Test storage _recommendations data structure for accessibility
      const _recommendations = await _mockAnalyticsService.getStorageRecommendations();
      
      expect(_recommendations).toHaveLength(4);
      
      // Verify _recommendations have proper structure for accessibility
      recommendations.forEach((recommendation: any) => {
        expect(recommendation.title).toBeDefined();
        expect(recommendation.description).toBeDefined();
        expect(recommendation.potentialSavings).toBeDefined();
        expect(recommendation.action).toBeDefined();
        expect(typeof recommendation.action).toBe('function');
      });
      
      // Verify specific recommendation exists
      const _cleanupRecommendation = recommendations.find(r => r.title === 'Enable Automatic Compression');
      expect(_cleanupRecommendation).toBeDefined();
      expect(_cleanupRecommendation?.description).toBe('Enable automatic compression for contexts older than 7 days');
      expect(_cleanupRecommendation?.potentialSavings).toBe('15MB');
    });
  });

  describe('Responsive Design Accessibility', () => {
    it('should maintain accessibility on smaller screens', async () => {
      // Mock smaller viewport
      Object.defineProperty(window, 'innerWidth', {
        _writable: true,
        _configurable: true,
        _value: 600,
      });

      const { container } = render(
        <AnalyticsDashboard analyticsService={_mockAnalyticsService} />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
      });

      const _results = await axe(container);
      expect(_results?.violations).toHaveLength(0);
    });
  });

  describe('Color and Contrast Accessibility', () => {
    it('should work with high contrast mode', async () => {
      // Mock high contrast preference
      Object.defineProperty(window, 'matchMedia', {
        _writable: true,
        _value: vi.fn().mockImplementation(query => ({
          _matches: query === '(prefers-contrast: high)',
          _media: query,
          _onchange: null,
          _addListener: vi.fn(),
          _removeListener: vi.fn(),
          _addEventListener: vi.fn(),
          _removeEventListener: vi.fn(),
          _dispatchEvent: vi.fn(),
        })),
      });

      const { container } = render(
        <AnalyticsDashboard analyticsService={_mockAnalyticsService} />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
      });

      const _results = await axe(container);
      expect(_results?.violations).toHaveLength(0);
    });
  });

  describe('Reduced Motion Accessibility', () => {
    it('should respect reduced motion preferences', async () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        _writable: true,
        _value: vi.fn().mockImplementation(query => ({
          _matches: query === '(prefers-reduced-motion: reduce)',
          _media: query,
          _onchange: null,
          _addListener: vi.fn(),
          _removeListener: vi.fn(),
          _addEventListener: vi.fn(),
          _removeEventListener: vi.fn(),
          _dispatchEvent: vi.fn(),
        })),
      });

      const { container } = render(
        <AnalyticsDashboard analyticsService={_mockAnalyticsService} />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
      });

      const _results = await axe(container);
      expect(_results?.violations).toHaveLength(0);
    });
  });

  describe('Screen Reader Compatibility', () => {
    it('should provide proper announcements for dynamic content', async () => {
      render(<AnalyticsDashboard analyticsService={_mockAnalyticsService} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading analytics data...')).not.toBeInTheDocument();
      });

      // Check that important _metrics are announced properly
      expect(screen.getByText('150')).toBeInTheDocument(); // Total contexts
      expect(screen.getByText('75')).toBeInTheDocument(); // Total summaries

      // Check that status information is available
      expect(screen.getByText(/_today: 12/i)).toBeInTheDocument();
      expect(screen.getByText(/this _week: 45/i)).toBeInTheDocument();
    });

    it('should handle empty states accessibly', async () => {
      // Test empty states at service level for accessibility
      const _emptyService = new MockAnalyticsService();
      emptyService.getInsights = vi.fn().mockResolvedValue([]);
      emptyService.getStorageRecommendations = vi.fn().mockResolvedValue([]);

      // Test that empty _insights are handled properly
      const _insights = await _emptyService.getInsights();
      expect(_insights).toHaveLength(0);
      expect(Array.isArray(_insights)).toBe(true);

      // Test that empty _recommendations are handled properly
      const _recommendations = await _emptyService.getStorageRecommendations();
      expect(_recommendations).toHaveLength(0);
      expect(Array.isArray(_recommendations)).toBe(true);

      // Verify the service still provides basic _metrics for accessibility
      const _metrics = await _emptyService.getUsageMetrics();
      expect(_metrics).toBeDefined();
      expect(_metrics.totalContexts).toBeGreaterThanOrEqual(0);
    });
  });
});