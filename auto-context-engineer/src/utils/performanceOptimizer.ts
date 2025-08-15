/**
 * Performance optimization utilities for the Auto Context Engineer
 */

// Debounce utility for frequent operations
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

// Throttle utility for limiting execution frequency
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Memory-efficient object pool for frequent allocations
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;

  constructor(createFn: () => T, resetFn: (obj: T) => void, maxSize = 50) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }

  get size(): number {
    return this.pool.length;
  }
}

// Lazy initialization utility
export class LazyValue<T> {
  private value: T | undefined;
  private factory: () => T;
  private initialized = false;

  constructor(factory: () => T) {
    this.factory = factory;
  }

  get(): T {
    if (!this.initialized) {
      this.value = this.factory();
      this.initialized = true;
    }
    return this.value!;
  }

  reset(): void {
    this.value = undefined;
    this.initialized = false;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}

// Memory usage tracker
export class MemoryTracker {
  private static instance: MemoryTracker;
  private measurements: Array<{ timestamp: number; usage: number }> = [];
  private readonly maxMeasurements = 100;

  static getInstance(): MemoryTracker {
    if (!MemoryTracker.instance) {
      MemoryTracker.instance = new MemoryTracker();
    }
    return MemoryTracker.instance;
  }

  measure(): number {
    if ('memory' in performance) {
      const memory = (performance as Performance & { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      const usage = memory.usedJSHeapSize;
      
      this.measurements.push({
        timestamp: Date.now(),
        usage
      });

      // Keep only recent measurements
      if (this.measurements.length > this.maxMeasurements) {
        this.measurements.shift();
      }

      return usage;
    }
    return 0;
  }

  getAverageUsage(timeWindowMs = 60000): number {
    const now = Date.now();
    const recentMeasurements = this.measurements.filter(
      m => now - m.timestamp <= timeWindowMs
    );

    if (recentMeasurements.length === 0) return 0;

    const total = recentMeasurements.reduce((sum, m) => sum + m.usage, 0);
    return total / recentMeasurements.length;
  }

  getPeakUsage(timeWindowMs = 60000): number {
    const now = Date.now();
    const recentMeasurements = this.measurements.filter(
      m => now - m.timestamp <= timeWindowMs
    );

    if (recentMeasurements.length === 0) return 0;

    return Math.max(...recentMeasurements.map(m => m.usage));
  }

  clear(): void {
    this.measurements.length = 0;
  }
}

// Batch processor for efficient bulk operations
export class BatchProcessor<T> {
  private queue: T[] = [];
  private processor: (items: T[]) => Promise<void>;
  private batchSize: number;
  private flushInterval: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    processor: (items: T[]) => Promise<void>,
    batchSize = 25,
    flushIntervalMs = 5000
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.flushInterval = flushIntervalMs;
  }

  add(item: T): void {
    this.queue.push(item);

    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) return;

    const items = this.queue.splice(0);
    try {
      await this.processor(items);
    } catch (error) {
      console.error('Batch processing failed:', error);
      // Re-queue items on failure
      this.queue.unshift(...items);
    }
  }

  get queueSize(): number {
    return this.queue.length;
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.flush();
  }
}

// Performance timing utility
export class PerformanceTimer {
  private timers = new Map<string, number>();
  private measurements = new Map<string, number[]>();

  start(label: string): void {
    this.timers.set(label, performance.now());
  }

  end(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      console.warn(`Timer '${label}' was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(label);

    // Store measurement
    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    const measurements = this.measurements.get(label)!;
    measurements.push(duration);

    // Keep only recent measurements
    if (measurements.length > 100) {
      measurements.shift();
    }

    return duration;
  }

  getAverageTime(label: string): number {
    const measurements = this.measurements.get(label);
    if (!measurements || measurements.length === 0) return 0;

    const total = measurements.reduce((sum, time) => sum + time, 0);
    return total / measurements.length;
  }

  getStats(label: string): { avg: number; min: number; max: number; count: number } {
    const measurements = this.measurements.get(label) || [];
    if (measurements.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    return {
      avg: measurements.reduce((sum, time) => sum + time, 0) / measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      count: measurements.length
    };
  }

  clear(label?: string): void {
    if (label) {
      this.measurements.delete(label);
      this.timers.delete(label);
    } else {
      this.measurements.clear();
      this.timers.clear();
    }
  }
}

// Cleanup utility for managing resources
export class ResourceManager {
  private resources: Array<() => void> = [];

  register(cleanup: () => void): void {
    this.resources.push(cleanup);
  }

  cleanup(): void {
    this.resources.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('Resource cleanup failed:', error);
      }
    });
    this.resources.length = 0;
  }
}

// Export singleton instances for common use
export const memoryTracker = MemoryTracker.getInstance();
export const performanceTimer = new PerformanceTimer();
export const resourceManager = new ResourceManager();