import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PerformanceOptimizer, defaultOptimizationConfig } from '../performanceOptimizer';

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer(defaultOptimizationConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Function Optimization', () => {
    it('should optimize function with caching', () => {
      const testFunction = (x: number) => x * 2;
      const optimizedFunction = optimizer.optimize(testFunction as (...args: unknown[]) => unknown, {
        enableCaching: true,
        cacheKey: 'test-cache',
      });

      const result1 = optimizedFunction(5);
      const result2 = optimizedFunction(5);

      expect(result1).toBe(10);
      expect(result2).toBe(10);
      
      // Should use cache for second call
      const cacheStats = optimizer.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });

    it('should optimize async functions', async () => {
      let callCount = 0;
      const asyncFunction = async (x: number) => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return x * 3;
      };

  const optimizedFunction = optimizer.optimize(asyncFunction as (...args: unknown[]) => Promise<unknown>, {
        enableCaching: true,
        cacheKey: 'async-test',
      });

      // First call
      const result1 = await optimizedFunction(5);
      expect(result1).toBe(15);
      expect(callCount).toBe(1);

      // Second call should use cache
      const result2 = await optimizedFunction(5);
      expect(result2).toBe(15);
      expect(callCount).toBe(1);
    });

    it('should handle function errors correctly', async () => {
      const errorFunction = () => {
        throw new Error('Test error');
      };

      const optimizedFunction = optimizer.optimize(errorFunction);

      expect(() => optimizedFunction()).toThrow('Test error');
    });

    it('should handle async function errors correctly', async () => {
      const asyncErrorFunction = async () => {
        throw new Error('Async test error');
      };

      const optimizedFunction = optimizer.optimize(asyncErrorFunction);

      await expect(optimizedFunction()).rejects.toThrow('Async test error');
    });
  });

  describe('Batching Operations', () => {
    it('should batch operations correctly', async () => {
      const processedItems: number[] = [];
      const processor = async (items: number[]) => {
        processedItems.push(...items);
      };

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(optimizer.batch('test-batch', i, processor));
      }

      await Promise.all(promises);

      expect(processedItems).toEqual([0, 1, 2, 3, 4]);
    });

    it('should process batch when size limit is reached', async () => {
      const processedBatches: number[][] = [];
      const processor = async (items: number[]) => {
        processedBatches.push([...items]);
      };

      // Configure small batch size
      optimizer.updateConfig({ batchSize: 3 });

      const promises = [];
      for (let i = 0; i < 7; i++) {
        promises.push(optimizer.batch('size-test', i, processor));
      }

      await Promise.all(promises);

      // Should have processed in batches of 3 and 3 and 1
      expect(processedBatches.length).toBeGreaterThanOrEqual(2);
      expect(processedBatches[0].length).toBe(3);
    });

    it('should handle batch processing errors', async () => {
      const errorProcessor = async () => {
        throw new Error('Batch processing error');
      };

      const promise = optimizer.batch('error-batch', 1, errorProcessor);

      await expect(promise).rejects.toThrow('Batch processing error');
    });
  });

  describe('Lazy Loading', () => {
    it('should lazy load data with caching', async () => {
      let loadCount = 0;
      const loader = async () => {
        loadCount++;
        return { data: 'test-data' };
      };

      // First load
      const result1 = await optimizer.lazyLoad(loader, 'test-lazy');
      expect(result1.data).toBe('test-data');
      expect(loadCount).toBe(1);

      // Second load should use cache
      const result2 = await optimizer.lazyLoad(loader, 'test-lazy');
      expect(result2.data).toBe('test-data');
      expect(loadCount).toBe(1);
    });

    it('should bypass lazy loading when disabled', async () => {
      optimizer.updateConfig({ enableLazyLoading: false });

      let loadCount = 0;
      const loader = async () => {
        loadCount++;
        return { data: 'test-data' };
      };

      await optimizer.lazyLoad(loader, 'test-lazy');
      await optimizer.lazyLoad(loader, 'test-lazy');

      expect(loadCount).toBe(2); // Should load twice without caching
    });
  });

  describe('Compression', () => {
    it('should compress and decompress data', async () => {
      const testData = 'This is test data that should be compressed';

      const compressed = await optimizer.compress(testData);
      expect(compressed).not.toBe(testData);
      expect(compressed.length).toBeGreaterThan(0);

      const decompressed = await optimizer.decompress(compressed);
      expect(decompressed).toBe(testData);
    });

    it('should bypass compression when disabled', async () => {
      optimizer.updateConfig({ enableCompression: false });

      const testData = 'This is test data';

      const compressed = await optimizer.compress(testData);
      expect(compressed).toBe(testData);

      const decompressed = await optimizer.decompress(testData);
      expect(decompressed).toBe(testData);
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
  const testFunction = (x: number) => x * 2;
  const optimizedFunction = optimizer.optimize(testFunction as (...args: unknown[]) => unknown, {
        enableCaching: true,
        cacheKey: 'stats-test',
      });

      // Add some cached entries
      optimizedFunction(1);
      optimizedFunction(2);
      optimizedFunction(3);

      const stats = optimizer.getCacheStats();

      expect(stats.size).toBeGreaterThan(0);
      expect(stats.maxSize).toBe(defaultOptimizationConfig.cacheSize);
      expect(stats.entries.length).toBeGreaterThan(0);
    });

    it('should clear cache', () => {
  const testFunction = (x: number) => x * 2;
  const optimizedFunction = optimizer.optimize(testFunction as (...args: unknown[]) => unknown, {
        enableCaching: true,
        cacheKey: 'clear-test',
      });

      optimizedFunction(1);
      expect(optimizer.getCacheStats().size).toBeGreaterThan(0);

      optimizer.clearCache();
      expect(optimizer.getCacheStats().size).toBe(0);
    });

    it('should respect cache size limits', () => {
      optimizer.updateConfig({ cacheSize: 2 });

  const testFunction = (x: number) => x * 2;
  const optimizedFunction = optimizer.optimize(testFunction as (...args: unknown[]) => unknown, {
        enableCaching: true,
      });

      // Add more entries than cache size
      optimizedFunction(1);
      optimizedFunction(2);
      optimizedFunction(3);

      const stats = optimizer.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(2);
    });
  });

  describe('Debounce and Throttle', () => {
    it('should debounce function calls', async () => {
      let callCount = 0;
      const testFunction = () => {
        callCount++;
      };

      const debouncedFunction = optimizer.debounce(testFunction, 50);

      // Call multiple times quickly
      debouncedFunction();
      debouncedFunction();
      debouncedFunction();

      // Should not have been called yet
      expect(callCount).toBe(0);

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should have been called once
      expect(callCount).toBe(1);
    });

    it('should throttle function calls', async () => {
      let callCount = 0;
      const testFunction = () => {
        callCount++;
      };

      const throttledFunction = optimizer.throttle(testFunction, 50);

      // Call multiple times quickly
      throttledFunction(); // Should execute immediately
      throttledFunction(); // Should be throttled
      throttledFunction(); // Should be throttled

      expect(callCount).toBe(1);

      // Wait for throttle delay
      await new Promise(resolve => setTimeout(resolve, 60));

      throttledFunction(); // Should execute now
      expect(callCount).toBe(2);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        enableCaching: false,
        cacheSize: 200,
      };

      optimizer.updateConfig(newConfig);

      const config = optimizer.getConfig();
      expect(config.enableCaching).toBe(false);
      expect(config.cacheSize).toBe(200);
      expect(config.enableLazyLoading).toBe(defaultOptimizationConfig.enableLazyLoading);
    });

    it('should return current configuration', () => {
      const config = optimizer.getConfig();

      expect(config).toEqual(defaultOptimizationConfig);
    });
  });

  describe('Performance Integration', () => {
    it('should integrate with performance monitor for timing', () => {
      const testFunction = () => {
        // Simulate some work
        const start = Date.now();
        while (Date.now() - start < 10) {
          // Wait
        }
        return 'result';
      };

      const optimizedFunction = optimizer.optimize(testFunction, {
        enableTiming: true,
      });

      const result = optimizedFunction();
      expect(result).toBe('result');

      // Performance monitor should have recorded the timing
      // This would be tested in integration tests with actual performance monitor
    });
  });
});