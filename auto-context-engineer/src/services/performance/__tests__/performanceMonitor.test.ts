import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PerformanceMonitor } from '../performanceMonitor';

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Timer Operations', () => {
    it('should start and end timers correctly', () => {
      const operation = 'test-operation';
      
      performanceMonitor.startTimer(operation);
      
      // Simulate some work
      const start = performance.now();
      while (performance.now() - start < 10) {
        // Wait for at least 10ms
      }
      
      const duration = performanceMonitor.endTimer(operation);
      
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeGreaterThanOrEqual(10);
    });

    it('should record timing metrics', () => {
      const operation = 'test-operation';
      
      performanceMonitor.startTimer(operation);
      const duration = performanceMonitor.endTimer(operation);
      
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.timing[operation]).toBeDefined();
      expect(metrics.timing[operation].count).toBe(1);
      expect(metrics.timing[operation].totalTime).toBeCloseTo(duration, 1);
      expect(metrics.timing[operation].averageTime).toBeCloseTo(duration, 1);
      expect(metrics.timing[operation].minTime).toBeCloseTo(duration, 1);
      expect(metrics.timing[operation].maxTime).toBeCloseTo(duration, 1);
    });

    it('should handle multiple timing operations', () => {
      const operation = 'test-operation';
      
      // First timing
      performanceMonitor.startTimer(operation);
      const duration1 = performanceMonitor.endTimer(operation);
      
      // Second timing
      performanceMonitor.startTimer(operation);
      const duration2 = performanceMonitor.endTimer(operation);
      
      const metrics = performanceMonitor.getMetrics();
      const timing = metrics.timing[operation];
      
      expect(timing.count).toBe(2);
      expect(timing.totalTime).toBeCloseTo(duration1 + duration2, 1);
      expect(timing.averageTime).toBeCloseTo((duration1 + duration2) / 2, 1);
      expect(timing.minTime).toBe(Math.min(duration1, duration2));
      expect(timing.maxTime).toBe(Math.max(duration1, duration2));
    });

    it('should warn when ending timer that was not started', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const duration = performanceMonitor.endTimer('non-existent-timer');
      
      expect(duration).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Timer for operation "non-existent-timer" was not started'
      );
    });
  });

  describe('Storage Operations', () => {
    it('should record storage operations', () => {
      performanceMonitor.recordStorageOperation('write', 1024);
      performanceMonitor.recordStorageOperation('read');
      performanceMonitor.recordStorageOperation('delete', 512);
      
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.storage.operations.writes).toBe(1);
      expect(metrics.storage.operations.reads).toBe(1);
      expect(metrics.storage.operations.deletes).toBe(1);
      expect(metrics.storage.size).toBe(1024 - 512); // write - delete
    });

    it('should generate storage alerts for large usage', () => {
      const largeSize = 200 * 1024 * 1024; // 200MB
      performanceMonitor.recordStorageOperation('write', largeSize);
      
      const alerts = performanceMonitor.getAlerts();
      const storageAlerts = alerts.filter((alert: any) => alert._type === 'storage');
      
      expect(storageAlerts.length).toBeGreaterThan(0);
      expect(storageAlerts[0].severity).toMatch(/medium|high/);
    });
  });

  describe('Network Operations', () => {
    it('should record network requests', () => {
      performanceMonitor.recordNetworkRequest(1024, 500);
      performanceMonitor.recordNetworkRequest(2048, 300);
      
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.network.requests).toBe(2);
      expect(metrics.network.totalBytes).toBe(3072);
      expect(metrics.network.averageLatency).toBe(400); // (500 + 300) / 2
    });

    it('should generate network alerts for high latency', () => {
      performanceMonitor.recordNetworkRequest(1024, 10000); // 10 seconds
      
      const alerts = performanceMonitor.getAlerts();
      const networkAlerts = alerts.filter((alert: any) => alert._type === 'network');
      
      expect(networkAlerts.length).toBeGreaterThan(0);
      expect(networkAlerts[0].severity).toMatch(/medium|high/);
    });
  });

  describe('Memory Monitoring', () => {
    it('should initialize memory metrics', () => {
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.memory).toBeDefined();
      expect(metrics.memory.used).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.total).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.percentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Alerts Management', () => {
    it('should add and retrieve alerts', () => {
      // Trigger a network alert (more reliable than timing)
      performanceMonitor.recordNetworkRequest(1024, 6000); // 6 seconds
      
      const alerts = performanceMonitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const networkAlerts = performanceMonitor.getAlerts('medium');
      expect(networkAlerts.length).toBeGreaterThan(0);
    });

    it('should clear alerts', () => {
      // Add some alerts first
      performanceMonitor.recordNetworkRequest(1024, 10000);
      
      expect(performanceMonitor.getAlerts().length).toBeGreaterThan(0);
      
      performanceMonitor.clearAlerts();
      
      expect(performanceMonitor.getAlerts().length).toBe(0);
    });

    it('should limit alert history', () => {
      // Add more than 100 alerts
      for (let i = 0; i < 150; i++) {
        performanceMonitor.recordNetworkRequest(1024, 10000);
      }
      
      const alerts = performanceMonitor.getAlerts();
      expect(alerts.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Thresholds Management', () => {
    it('should update thresholds', () => {
      const newThresholds = {
        memory: 100,
        timing: 2000,
      };
      
      performanceMonitor.updateThresholds(newThresholds);
      
      // Test that new thresholds are applied
      performanceMonitor.startTimer('test-operation');
      
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1500); // 1.5 seconds
      
      performanceMonitor.endTimer('test-operation');
      
      // Should not trigger alert with new threshold
      const alerts = performanceMonitor.getAlerts();
      const timingAlerts = alerts.filter((alert: any) => alert._type === 'timing');
      expect(timingAlerts.length).toBe(0);
    });
  });

  describe('Recommendations', () => {
    it('should provide memory recommendations', () => {
      // Mock high memory usage
      const originalMemory = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      (performance as Performance & { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory = {
        usedJSHeapSize: 100 * 1024 * 1024, // 100MB
        totalJSHeapSize: 200 * 1024 * 1024, // 200MB
        jsHeapSizeLimit: 400 * 1024 * 1024, // 400MB
      };
      
      // Trigger memory update
      performanceMonitor = new PerformanceMonitor();
      
      const recommendations = performanceMonitor.getRecommendations();
      expect(recommendations.some(rec => 
        rec.includes('memory usage')
      )).toBe(true);
      
      // Restore original memory object
      (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory = originalMemory;
    });

    it('should provide timing recommendations', () => {
      // Manually add timing data that exceeds threshold
      (performanceMonitor as unknown as { metrics: { timing: Record<string, unknown> } }).metrics.timing['slow-operation'] = {
        count: 1,
        totalTime: 2000,
        averageTime: 2000,
        minTime: 2000,
        maxTime: 2000,
      };
      
      const recommendations = performanceMonitor.getRecommendations();
      expect(recommendations.some(rec => 
        rec.includes('slow operations')
      )).toBe(true);
    });
  });

  describe('Performance Report', () => {
    it('should generate comprehensive report', () => {
      // Add some metrics
      performanceMonitor.startTimer('test-operation');
      performanceMonitor.endTimer('test-operation');
      performanceMonitor.recordStorageOperation('write', 1024);
      performanceMonitor.recordNetworkRequest(2048, 500);
      
      const report = performanceMonitor.generateReport();
      
      expect(report.summary).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.alerts).toBeDefined();
      expect(report.recommendations).toBeDefined();
      
      expect(report.metrics.timing).toBeDefined();
      expect(report.metrics.storage).toBeDefined();
      expect(report.metrics.network).toBeDefined();
    });

    it('should indicate performance issues in summary', () => {
      // Create critical alert
      performanceMonitor.recordNetworkRequest(1024, 15000); // Very high latency
      
      const report = performanceMonitor.generateReport();
      
      expect(report.summary).toMatch(/issues detected|concerns/);
    });
  });
});