/**
 * Performance optimization service for the Auto Context Engineer
 */

import { 
  debounce, 
  throttle, 
  BatchProcessor, 
  PerformanceTimer, 
  MemoryTracker,
  LazyValue,
  ObjectPool
} from '../../utils/performanceOptimizer';

export interface OptimizationConfig {
  enableMemoryTracking: boolean;
  enablePerformanceTimers: boolean;
  batchSize: number;
  flushInterval: number;
  memoryThreshold: number; // MB
  performanceThreshold: number; // ms
}

export interface OptimizationMetrics {
  memoryUsage: {
    current: number;
    average: number;
    peak: number;
  };
  performance: {
    [operation: string]: {
      average: number;
      min: number;
      max: number;
      count: number;
    };
  };
  optimizations: {
    batchesProcessed: number;
    memoryCleanups: number;
    performanceWarnings: number;
  };
}

export class OptimizationService {
  private config: OptimizationConfig;
  private memoryTracker: MemoryTracker;
  private performanceTimer: PerformanceTimer;
  private batchProcessors = new Map<string, BatchProcessor<unknown>>();
  private objectPools = new Map<string, ObjectPool<unknown>>();
  private lazyValues = new Map<string, LazyValue<unknown>>();
  private cleanupTasks: Array<() => void> = [];
  private metrics: OptimizationMetrics;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      enableMemoryTracking: true,
      enablePerformanceTimers: true,
      batchSize: 25,
      flushInterval: 5000,
      memoryThreshold: 50, // 50MB
      performanceThreshold: 1000, // 1 second
      ...config
    };

    this.memoryTracker = MemoryTracker.getInstance();
    this.performanceTimer = new PerformanceTimer();
    
    this.metrics = {
      memoryUsage: { current: 0, average: 0, peak: 0 },
      performance: {},
      optimizations: {
        batchesProcessed: 0,
        memoryCleanups: 0,
        performanceWarnings: 0
      }
    };

    this.initialize();
  }

  private initialize(): void {
    if (this.config.enableMemoryTracking) {
      this.startMemoryMonitoring();
    }

    // Set up periodic cleanup
    const cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60000); // Every minute

    this.cleanupTasks.push(() => clearInterval(cleanupInterval));
  }

  private startMemoryMonitoring(): void {
    const monitorInterval = setInterval(() => {
      const usage = this.memoryTracker.measure();
      const usageMB = usage / (1024 * 1024);

      this.metrics.memoryUsage.current = usageMB;
      this.metrics.memoryUsage.average = this.memoryTracker.getAverageUsage() / (1024 * 1024);
      this.metrics.memoryUsage.peak = this.memoryTracker.getPeakUsage() / (1024 * 1024);

      // Trigger cleanup if memory usage is high
      if (usageMB > this.config.memoryThreshold) {
        this.performMemoryCleanup();
      }
    }, 10000); // Every 10 seconds

    this.cleanupTasks.push(() => clearInterval(monitorInterval));
  }

  // Debounced function factory
  createDebouncedFunction<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number,
    immediate = false
  ): (...args: Parameters<T>) => void {
    return debounce(func, wait, immediate);
  }

  // Throttled function factory
  createThrottledFunction<T extends (...args: unknown[]) => unknown>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    return throttle(func, limit);
  }

  // Batch processor factory
  createBatchProcessor<T>(
    name: string,
    processor: (items: T[]) => Promise<void>,
    batchSize?: number,
    flushInterval?: number
  ): BatchProcessor<T> {
    const batchProcessor = new BatchProcessor(
      async (items: T[]) => {
        this.metrics.optimizations.batchesProcessed++;
        await processor(items);
      },
      batchSize || this.config.batchSize,
      flushInterval || this.config.flushInterval
    );

    this.batchProcessors.set(name, batchProcessor as BatchProcessor<unknown>);
    this.cleanupTasks.push(() => batchProcessor.destroy());

    return batchProcessor;
  }

  // Object pool factory
  createObjectPool<T>(
    name: string,
    createFn: () => T,
    resetFn: (obj: T) => void,
    maxSize = 50
  ): ObjectPool<T> {
    const pool = new ObjectPool(createFn, resetFn, maxSize);
    this.objectPools.set(name, pool as ObjectPool<unknown>);
    this.cleanupTasks.push(() => pool.clear());
    return pool;
  }

  // Lazy value factory
  createLazyValue<T>(name: string, factory: () => T): LazyValue<T> {
    const lazyValue = new LazyValue(factory);
    this.lazyValues.set(name, lazyValue);
    return lazyValue;
  }

  // Performance timing
  startTimer(label: string): void {
    if (this.config.enablePerformanceTimers) {
      this.performanceTimer.start(label);
    }
  }

  endTimer(label: string): number {
    if (!this.config.enablePerformanceTimers) return 0;

    const duration = this.performanceTimer.end(label);
    
    // Update metrics
    const stats = this.performanceTimer.getStats(label);
    this.metrics.performance[label] = {
      average: stats.avg,
      min: stats.min,
      max: stats.max,
      count: stats.count
    };

    // Check for performance issues
    if (duration > this.config.performanceThreshold) {
      this.metrics.optimizations.performanceWarnings++;
      console.warn(`Performance warning: ${label} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  // Memory cleanup
  private performMemoryCleanup(): void {
    this.metrics.optimizations.memoryCleanups++;

    // Clear object pools
    this.objectPools.forEach(pool => {
      if (pool.size > 10) {
        pool.clear();
      }
    });

    // Reset lazy values that haven't been used recently
    this.lazyValues.forEach(lazyValue => {
      if (lazyValue.isInitialized) {
        lazyValue.reset();
      }
    });

    // Force garbage collection if available
    if ('gc' in window && typeof (window as { gc?: () => void }).gc === 'function') {
      (window as { gc: () => void }).gc();
    }

    console.log('Memory cleanup performed');
  }

  // General cleanup
  private performCleanup(): void {
    // Flush all batch processors
    this.batchProcessors.forEach(processor => {
      void processor.flush();
    });

    // Clear old performance measurements
    const oldLabels = Object.keys(this.metrics.performance).filter(label => {
      const stats = this.metrics.performance[label];
      return stats.count === 0; // No recent activity
    });

    oldLabels.forEach(label => {
      this.performanceTimer.clear(label);
      delete this.metrics.performance[label];
    });
  }

  // Get optimization metrics
  getMetrics(): OptimizationMetrics {
    return { ...this.metrics };
  }

  // Get recommendations
  getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.memoryUsage.current > this.config.memoryThreshold) {
      recommendations.push('Memory usage is high. Consider reducing data retention or enabling more aggressive cleanup.');
    }

    const slowOperations = Object.entries(this.metrics.performance)
      .filter(([_, stats]) => stats.average > this.config.performanceThreshold)
      .map(([label]) => label);

    if (slowOperations.length > 0) {
      recommendations.push(`Slow operations detected: ${slowOperations.join(', ')}. Consider optimization.`);
    }

    if (this.metrics.optimizations.performanceWarnings > 10) {
      recommendations.push('Frequent performance warnings. Review operation efficiency.');
    }

    return recommendations;
  }

  // Cleanup all resources
  destroy(): void {
    this.cleanupTasks.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('Cleanup task failed:', error);
      }
    });

    this.batchProcessors.clear();
    this.objectPools.clear();
    this.lazyValues.clear();
    this.cleanupTasks.length = 0;
  }
}

// Export singleton instance
export const optimizationService = new OptimizationService();