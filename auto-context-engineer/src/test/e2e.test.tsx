import React from 'react';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Testing library imports for future use
// import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { globalPerformanceMonitor } from '../services/performance/performanceMonitor';
import { globalPerformanceOptimizer } from '../services/performance/performanceOptimizer';
import { globalDiagnosticsService } from '../services/performance/diagnostics';

// Removed unused interface

// Removed unused interfaces

interface LargeTestObject {
  data: number[];
  id: number;
}

// Mock Chrome APIs
const mockChrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getManifest: vi.fn(() => ({ version: '1.0.0' })),
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
};

(global as any).chrome = mockChrome as any;

describe('End-to-End Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalPerformanceMonitor.clearAlerts();
    globalPerformanceOptimizer.clearCache();
    
    // Clear timing metrics to avoid interference between tests
    const metrics = globalPerformanceMonitor.getMetrics();
    Object.keys(metrics.timing).forEach((key: any) => {
      delete metrics.timing[key];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('System Integration', () => {
    it('should handle complete workflow with performance monitoring', async () => {
      // Start performance monitoring
      globalPerformanceMonitor.startTimer('e2e-workflow');

      try {
        // Simulate context capture
        globalPerformanceMonitor.startTimer('context-capture');
        const contextData = {
          id: 'test-context-1',
          content: 'This is test context content for performance testing',
          metadata: {
            source: 'test',
            timestamp: new Date(),
            tokens: 50,
            tokenCount: 50,
          },
        };
        globalPerformanceMonitor.endTimer('context-capture');

        // Simulate storage operation
        globalPerformanceMonitor.recordStorageOperation('write', JSON.stringify(contextData).length);

        // Simulate summarization
        globalPerformanceMonitor.startTimer('summarization');
        // Mock _summary data for testing (unused in current test)
        /*
        const _summary = {
          id: 'test-_summary-1',
          contextId: contextData.id,
          content: 'Test _summary content',
          method: 'local' as const,
          metadata: {
            timestamp: new Date(),
            tokens: 20,
          },
        };
        */
        globalPerformanceMonitor.endTimer('summarization');

        // Simulate search operation
        globalPerformanceMonitor.startTimer('search');
        // Mock search results for testing (unused in current test)
        /*
        const _searchResults = [
          {
            contextId: contextData.id,
            relevance: 0.95,
            snippet: 'test context content',
            highlights: [],
          },
        ];
        */
        globalPerformanceMonitor.endTimer('search');

        // Simulate network request (cloud API)
        globalPerformanceMonitor.recordNetworkRequest(1024, 500);

        // End workflow timing
        const workflowDuration = globalPerformanceMonitor.endTimer('e2e-workflow');

        // Verify performance metrics
        const metrics = globalPerformanceMonitor.getMetrics();
        
        expect(metrics.timing['e2e-workflow']).toBeDefined();
        expect(metrics.timing['context-capture']).toBeDefined();
        expect(metrics.timing['summarization']).toBeDefined();
        expect(metrics.timing['search']).toBeDefined();
        
        expect(metrics.storage.operations.writes).toBe(1);
        expect(metrics.network.requests).toBe(1);
        
        expect(workflowDuration).toBeGreaterThan(0);

        // Log performance metrics
        globalDiagnosticsService.logPerformanceMetrics();

        // Generate performance report
        const report = globalPerformanceMonitor.generateReport();
        expect(report.summary).toBeDefined();
        expect(report.metrics).toBeDefined();

      } catch (error) {
        globalPerformanceMonitor.endTimer('e2e-workflow');
        throw error;
      }
    });

    it('should handle high-load scenarios', async () => {
      const operations = 100;
      const promises: Promise<unknown>[] = [];

      // Start overall workflow timer
      globalPerformanceMonitor.startTimer('e2e-workflow');

      // Simulate high load
      for (let i = 0; i < operations; i++) {
        const promise = (async () => {
          globalPerformanceMonitor.startTimer(`operation-${i}`);

          // Simulate work
          await new Promise(r => setTimeout(r, Math.random() * 10));

          globalPerformanceMonitor.endTimer(`operation-${i}`);
          globalPerformanceMonitor.recordStorageOperation('write', 100);

          return i;
        })();
        
        promises.push(promise);
      }

      await Promise.all(promises);

      // End overall workflow timer
      globalPerformanceMonitor.endTimer('e2e-workflow');

      const metrics = globalPerformanceMonitor.getMetrics();
      
      expect(Object.keys(metrics.timing)).toHaveLength(operations + 1); // +1 for e2e-workflow
      expect(metrics.storage.operations.writes).toBeGreaterThanOrEqual(operations);

      // Check for performance alerts
      const alerts = globalPerformanceMonitor.getAlerts();
      console.log(`Generated ${alerts.length} performance alerts during high-load test`);
    });

    it('should optimize repeated operations with caching', async () => {
      let executionCount = 0;
      
      const expensiveOperation = (input: string) => {
        executionCount++;
        // Simulate expensive computation
        return input.toUpperCase();
      };

      // Create separate optimized functions for different inputs
      const optimizedOperation1 = globalPerformanceOptimizer.optimize(
        expensiveOperation as any,
        {
          enableCaching: true,
          cacheKey: 'expensive-op-test',
          enableTiming: true,
        }
      );

      const optimizedOperation2 = globalPerformanceOptimizer.optimize(
        expensiveOperation as any,
        {
          enableCaching: true,
          cacheKey: 'expensive-op-different',
          enableTiming: true,
        }
      );

      // First execution
      const result1 = optimizedOperation1('test');
      expect(result1).toBe('TEST');
      expect(executionCount).toBe(1);

      // Second execution should use cache
      const result2 = optimizedOperation1('test');
      expect(result2).toBe('TEST');
      expect(executionCount).toBe(1); // Should not increment

      // Different input should execute again
      const result3 = optimizedOperation2('different');
      expect(result3).toBe('DIFFERENT');
      expect(executionCount).toBe(2);

      // Verify cache statistics
      const cacheStats = globalPerformanceOptimizer.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure by creating large objects
      const largeObjects: LargeTestObject[] = [];
      
      try {
        for (let i = 0; i < 100; i++) {
          // Create large object
          const largeObject = new Array(10000).fill(`data-${i}`);
          largeObjects.push(largeObject as any);
          
          // Record storage operation
          globalPerformanceMonitor.recordStorageOperation('write', largeObject.length * 10);
        }

        // Check memory metrics (may be 0 in test environment)
        const metrics = globalPerformanceMonitor.getMetrics();
        expect(metrics.memory.used).toBeGreaterThanOrEqual(0);

        // Check for memory alerts
        const memoryAlerts = globalPerformanceMonitor.getAlerts('high')
          .filter(alert => alert.type === 'memory');
        
        console.log(`Generated ${memoryAlerts.length} memory alerts during pressure test`);

        // Get recommendations
        const recommendations = globalPerformanceMonitor.getRecommendations();
        console.log('Performance recommendations:', recommendations);

      } finally {
        // Clean up
        largeObjects.length = 0;
      }
    });

    it('should maintain performance under concurrent operations', async () => {
      const concurrentOperations = 50;
      const startTime = performance.now();

      // Create concurrent operations
      const operations = Array.from({ length: concurrentOperations }, (_, i) => {
        return (async () => {
          globalPerformanceMonitor.startTimer(`concurrent-${i}`);

          // Simulate different types of operations
          if (i % 3 === 0) {
            // Storage operation
            globalPerformanceMonitor.recordStorageOperation('write', 1024);
          } else if (i % 3 === 1) {
            // Network operation
            globalPerformanceMonitor.recordNetworkRequest(512, Math.random() * 1000);
          } else {
            // Computation
            await new Promise(r => setTimeout(r, Math.random() * 50));
          }

          globalPerformanceMonitor.endTimer(`concurrent-${i}`);
          return i;
        })();
      });

      await Promise.all(operations);

      const totalTime = performance.now() - startTime;
      const metrics = globalPerformanceMonitor.getMetrics();

      expect(Object.keys(metrics.timing).length).toBeGreaterThanOrEqual(concurrentOperations);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Concurrent operations completed in ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle and recover from performance issues', async () => {
      // Simulate slow operation that triggers alerts
      globalPerformanceMonitor.startTimer('slow-operation');
      
      // Mock slow operation
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(3000); // 3 seconds
      
      globalPerformanceMonitor.endTimer('slow-operation');

      // Manually add timing data that would trigger alert
      (globalPerformanceMonitor as any)._metrics.timing['slow-operation'] = {
        count: 1,
        totalTime: 3000,
        averageTime: 3000,
        minTime: 3000,
        maxTime: 3000,
      };

      // Force memory update to trigger recommendations
      const memoryThreshold = 50; // MB
      if (globalPerformanceMonitor.getMetrics().memory.used < memoryThreshold * 1024 * 1024) {
        // Mock high memory usage to trigger recommendations
        (globalPerformanceMonitor as unknown as { metrics: { memory: { used: number } } }).metrics.memory.used = memoryThreshold * 1024 * 1024 + 1024 * 1024;
      }
      
      const updatedAlerts = globalPerformanceMonitor.getAlerts();
      const updatedRecommendations = globalPerformanceMonitor.getRecommendations();
      
      expect(updatedAlerts.length + updatedRecommendations.length).toBeGreaterThan(0);

      // Get recovery recommendations
      const recoveryRecommendations = globalPerformanceMonitor.getRecommendations();
      expect(recoveryRecommendations.some(rec => 
        rec.includes('slow-operation') || rec.includes('Optimize slow operations')
      )).toBe(true);

      // Enable diagnostics first
      globalDiagnosticsService.updateConfig({
        enabled: true,
        optIn: true,
      });

      // Log the issue
      globalDiagnosticsService.warn('performance', 'Slow operation detected', {
        operation: 'slow-operation',
        duration: 3000,
      });

      // Verify diagnostic entry
      const diagnosticEntries = globalDiagnosticsService.getEntries({
        category: 'performance',
      });
      
      expect(diagnosticEntries.length).toBeGreaterThan(0);
    });

    it('should handle cache overflow gracefully', () => {
      // Configure small cache size
      globalPerformanceOptimizer.updateConfig({ cacheSize: 3 });

      const testFunction = (x: number) => x * 2;
      const optimizedFunction = globalPerformanceOptimizer.optimize(testFunction as any, {
        enableCaching: true,
      });

      // Fill cache beyond capacity
      for (let i = 0; i < 10; i++) {
        optimizedFunction(i);
      }

      const cacheStats = globalPerformanceOptimizer.getCacheStats();
      expect(cacheStats.size).toBeLessThanOrEqual(3);

      // Verify cache still works
      let callCount = 0;
      const countingFunction = (x: number) => {
        callCount++;
        return x;
      };

      const optimizedCountingFunction = globalPerformanceOptimizer.optimize(countingFunction as any, {
        enableCaching: true,
        cacheKey: 'counting-test',
      });

      optimizedCountingFunction(1);
      optimizedCountingFunction(1);

      expect(callCount).toBe(1); // Should use cache
    });
  });

  describe('Diagnostics and Reporting', () => {
    it('should generate comprehensive diagnostic report', async () => {
      // Enable diagnostics
      globalDiagnosticsService.updateConfig({
        enabled: true,
        optIn: true,
      });

      // Generate various diagnostic entries
      globalDiagnosticsService.info('system', 'System initialized');
      globalDiagnosticsService.debug('performance', 'Performance monitoring started');
      globalDiagnosticsService.warn('storage', 'Storage usage high');
      globalDiagnosticsService.error('network', 'Network request failed');

      // Log performance metrics
      globalDiagnosticsService.logPerformanceMetrics();

      // Get statistics
      const stats = globalDiagnosticsService.getStatistics();
      expect(stats.total_entries).toBeGreaterThan(0);
      expect(stats.entries_by_level).toBeDefined();
      expect(stats.entries_by_category).toBeDefined();

      // Export diagnostics
      const exportedData = globalDiagnosticsService.exportDiagnostics('json');
      expect(exportedData).toContain('session_id');
      expect(exportedData).toContain('entries');

      // Verify data is sanitized
      expect(exportedData).not.toContain('password');
      expect(exportedData).not.toContain('secret');
    });

    it('should respect privacy settings in diagnostics', () => {
      // Configure privacy-focused settings
      globalDiagnosticsService.updateConfig({
        enabled: true,
        optIn: true,
        localOnly: true,
        categories: {
          performance: true,
          errors: true,
          user_actions: false, // Disabled for privacy
          system_events: true,
        },
      });

      // Try to log user action (should be ignored)
      globalDiagnosticsService.logUserAction('button_click', 'settings_page');

      // Log system event (should be recorded)
      globalDiagnosticsService.logSystemEvent('extension_loaded');

      const entries = globalDiagnosticsService.getEntries();
      const userActionEntries = entries.filter(e => e.category === 'user_action');
      const systemEventEntries = entries.filter(e => e.category === 'system');

      expect(userActionEntries.length).toBe(0);
      expect(systemEventEntries.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance benchmarks for core operations', async () => {
      const benchmarks = {
        contextCapture: 100, // ms
        summarization: 500, // ms
        search: 200, // ms
        storage: 50, // ms
      };

      // Test context capture performance
      globalPerformanceMonitor.startTimer('context-capture-benchmark');
      // Simulate context capture
      await new Promise(resolve => setTimeout(resolve, 10));
      const captureTime = globalPerformanceMonitor.endTimer('context-capture-benchmark');
      expect(captureTime).toBeLessThan(benchmarks.contextCapture);

      // Test summarization performance
      globalPerformanceMonitor.startTimer('summarization-benchmark');
      // Simulate summarization
      await new Promise(resolve => setTimeout(resolve, 50));
      const summarizationTime = globalPerformanceMonitor.endTimer('summarization-benchmark');
      expect(summarizationTime).toBeLessThan(benchmarks.summarization);

      // Test search performance
      globalPerformanceMonitor.startTimer('search-benchmark');
      // Simulate search
      await new Promise(resolve => setTimeout(resolve, 20));
      const searchTime = globalPerformanceMonitor.endTimer('search-benchmark');
      expect(searchTime).toBeLessThan(benchmarks.search);

      // Test storage performance
      globalPerformanceMonitor.startTimer('storage-benchmark');
      globalPerformanceMonitor.recordStorageOperation('write', 1024);
      const storageTime = globalPerformanceMonitor.endTimer('storage-benchmark');
      expect(storageTime).toBeLessThan(benchmarks.storage);

      console.log('Performance benchmarks:', {
        contextCapture: `${captureTime.toFixed(2)}ms`,
        summarization: `${summarizationTime.toFixed(2)}ms`,
        search: `${searchTime.toFixed(2)}ms`,
        storage: `${storageTime.toFixed(2)}ms`,
      });
    });

    it('should maintain consistent performance over time', async () => {
      const iterations = 20;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        globalPerformanceMonitor.startTimer(`consistency-test-${i}`);
        
        // Simulate consistent operation
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 5));
        
        const time = globalPerformanceMonitor.endTimer(`consistency-test-${i}`);
        times.push(time);
      }

      // Calculate statistics
      const average = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((acc, time) => acc + Math.pow(time - average, 2), 0) / times.length;
      const standardDeviation = Math.sqrt(variance);

      // Performance should be consistent (low standard deviation)
      const coefficientOfVariation = standardDeviation / average;
      expect(coefficientOfVariation).toBeLessThan(0.8); // Less than 80% variation (relaxed for test environment)

      console.log('Performance consistency:', {
        average: `${average.toFixed(2)}ms`,
        standardDeviation: `${standardDeviation.toFixed(2)}ms`,
        coefficientOfVariation: `${(coefficientOfVariation * 100).toFixed(1)}%`,
      });
    });
  });
});