/**
 * Performance optimization utilities for the extension
 */

import { globalPerformanceMonitor } from './performanceMonitor';

export interface OptimizationConfig {
  enableLazyLoading: boolean;
  enableCaching: boolean;
  enableCompression: boolean;
  enableBatching: boolean;
  cacheSize: number;
  batchSize: number;
  compressionLevel: number;
}

export class PerformanceOptimizer {
  private config: OptimizationConfig;
  private cache: Map<string, { data: unknown; timestamp: number; ttl: number }> = new Map();
  private batchQueue: Map<string, unknown[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: OptimizationConfig) {
    this.config = config;
    this.startCacheCleanup();
  }

  /**
   * Optimize function execution with caching and performance monitoring
   */
  optimize<T extends (...args: unknown[]) => unknown>(
    fn: T,
    options: {
      cacheKey?: string;
      cacheTTL?: number;
      enableTiming?: boolean;
      enableCaching?: boolean;
    } = {}
  ): T {
    const {
      cacheKey,
      cacheTTL = 300000, // 5 minutes default
      enableTiming = true,
      enableCaching = this.config.enableCaching,
    } = options;

    return ((...args: Parameters<T>) => {
      const operationName = fn.name || 'anonymous';
      const fullCacheKey = cacheKey || `${operationName}_${JSON.stringify(args)}`;

      // Start timing if enabled
      if (enableTiming) {
        globalPerformanceMonitor.startTimer(operationName);
      }

      try {
        // Check cache if enabled
        if (enableCaching && this.cache.has(fullCacheKey)) {
          const cached = this.cache.get(fullCacheKey)!;
          if (Date.now() - cached.timestamp < cached.ttl) {
            if (enableTiming) {
              globalPerformanceMonitor.endTimer(operationName);
            }
            return cached.data;
          } else {
            this.cache.delete(fullCacheKey);
          }
        }

        // Execute function
        const result = fn(...args);

        // Handle promises
        if (result instanceof Promise) {
          return result.then((data) => {
            if (enableCaching) {
              this.setCache(fullCacheKey, data, cacheTTL);
            }
            if (enableTiming) {
              globalPerformanceMonitor.endTimer(operationName);
            }
            return data;
          }).catch((error) => {
            if (enableTiming) {
              globalPerformanceMonitor.endTimer(operationName);
            }
            throw error;
          });
        }

        // Cache result if enabled
        if (enableCaching) {
          this.setCache(fullCacheKey, result, cacheTTL);
        }

        if (enableTiming) {
          globalPerformanceMonitor.endTimer(operationName);
        }

        return result;
      } catch (error) {
        if (enableTiming) {
          globalPerformanceMonitor.endTimer(operationName);
        }
        throw error;
      }
    }) as T;
  }

  /**
   * Batch operations to reduce overhead
   */
  batch<T>(
    operation: string,
    item: T,
    processor: (items: T[]) => Promise<void>,
    delay: number = 100
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Add item to batch queue
      if (!this.batchQueue.has(operation)) {
        this.batchQueue.set(operation, []);
      }
      
      const queue = this.batchQueue.get(operation)!;
      queue.push({ item, resolve, reject });

      // Clear existing timer
      if (this.batchTimers.has(operation)) {
        clearTimeout(this.batchTimers.get(operation));
      }

      // Set new timer or process immediately if batch is full
      if (queue.length >= this.config.batchSize) {
        this.processBatch(operation, processor);
      } else {
        const timer = setTimeout(() => {
          this.processBatch(operation, processor);
        }, delay);
        this.batchTimers.set(operation, timer);
      }
    });
  }

  /**
   * Process batched operations
   */
  private async processBatch<T>(
    operation: string,
    processor: (items: T[]) => Promise<void>
  ): Promise<void> {
    const queue = this.batchQueue.get(operation);
    if (!queue || queue.length === 0) return;

    // Clear the queue and timer
    this.batchQueue.set(operation, []);
    if (this.batchTimers.has(operation)) {
      clearTimeout(this.batchTimers.get(operation));
      this.batchTimers.delete(operation);
    }

    try {
      const items = (queue as { item: T }[]).map((entry: { item: T }) => entry.item);
      await processor(items);

      // Resolve all promises
      (queue as { resolve: () => void }[]).forEach((entry: { resolve: () => void }) => entry.resolve());
    } catch (error) {
      // Reject all promises
      (queue as { reject: (_error: unknown) => void }[]).forEach((entry: { reject: (_error: unknown) => void }) => entry.reject(error));
    }
  }

  /**
   * Lazy load data with caching
   */
  lazyLoad<T>(
    loader: () => Promise<T>,
    cacheKey: string,
    cacheTTL: number = 300000
  ): Promise<T> {
    if (!this.config.enableLazyLoading) {
      return loader();
    }

    return this.optimize(loader, {
      cacheKey,
      cacheTTL,
      enableCaching: true,
      enableTiming: true,
    })();
  }

  /**
   * Compress data for storage
   */
  async compress(data: string): Promise<string> {
    if (!this.config.enableCompression) {
      return data;
    }

    globalPerformanceMonitor.startTimer('compression');
    
    try {
      // Simple compression using built-in compression
      const encoder = new TextEncoder();
      // Text decoder available for future decompression needs
      const compressed = encoder.encode(data);
      
      // For now, return base64 encoded (in real implementation, use proper compression)
      const result = btoa(String.fromCharCode(...compressed));
      
      globalPerformanceMonitor.endTimer('compression');
      return result;
    } catch (error) {
      globalPerformanceMonitor.endTimer('compression');
      throw error;
    }
  }

  /**
   * Decompress data from storage
   */
  async decompress(compressedData: string): Promise<string> {
    if (!this.config.enableCompression) {
      return compressedData;
    }

    globalPerformanceMonitor.startTimer('decompression');
    
    try {
      // Simple decompression
      const compressed = Uint8Array.from(atob(compressedData), c => c.charCodeAt(0));
      const decoder = new TextDecoder();
      const result = decoder.decode(compressed);
      
      globalPerformanceMonitor.endTimer('decompression');
      return result;
    } catch (error) {
      globalPerformanceMonitor.endTimer('decompression');
      throw error;
    }
  }

  /**
   * Set cache entry
   */
  private setCache(key: string, data: unknown, ttl: number): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.cacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; age: number; size: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
      size: JSON.stringify(value.data).length,
    }));

    return {
      size: this.cache.size,
      maxSize: this.config.cacheSize,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
      entries,
    };
  }

  /**
   * Start cache cleanup process
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > value.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }

  /**
   * Debounce function calls
   */
  debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Throttle function calls
   */
  throttle<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn(...args);
      }
    };
  }

  /**
   * Update optimization configuration
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): OptimizationConfig {
    return { ...this.config };
  }
}

// Default optimization configuration
export const defaultOptimizationConfig: OptimizationConfig = {
  enableLazyLoading: true,
  enableCaching: true,
  enableCompression: true,
  enableBatching: true,
  cacheSize: 100,
  batchSize: 10,
  compressionLevel: 6,
};

// Global performance optimizer instance
export const globalPerformanceOptimizer = new PerformanceOptimizer(defaultOptimizationConfig);