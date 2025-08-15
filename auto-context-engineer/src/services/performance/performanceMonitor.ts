/**
 * Performance monitoring service for tracking and optimizing extension performance
 */

export interface PerformanceMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  timing: {
    [operation: string]: {
      count: number;
      totalTime: number;
      averageTime: number;
      minTime: number;
      maxTime: number;
    };
  };
  storage: {
    size: number;
    operations: {
      reads: number;
      writes: number;
      deletes: number;
    };
  };
  network: {
    requests: number;
    totalBytes: number;
    averageLatency: number;
  };
}

export interface PerformanceAlert {
  type: 'memory' | 'timing' | 'storage' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private timers: Map<string, number> = new Map();
  private alerts: PerformanceAlert[] = [];
  private thresholds = {
    memory: 50, // MB
    timing: 1000, // ms
    storage: 100, // MB
    networkLatency: 5000, // ms
  };

  constructor() {
    this.metrics = {
      memory: { used: 0, total: 0, percentage: 0 },
      timing: {},
      storage: { size: 0, operations: { reads: 0, writes: 0, deletes: 0 } },
      network: { requests: 0, totalBytes: 0, averageLatency: 0 },
    };
    
    this.startMemoryMonitoring();
  }

  /**
   * Start timing an operation
   */
  startTimer(operation: string): void {
    this.timers.set(operation, performance.now());
  }

  /**
   * End timing an operation and record metrics
   */
  endTimer(operation: string): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      console.warn(`Timer for operation "${operation}" was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(operation);
    
    this.recordTiming(operation, duration);
    return duration;
  }

  /**
   * Record timing metrics for an operation
   */
  private recordTiming(operation: string, duration: number): void {
    if (!this.metrics.timing[operation]) {
      this.metrics.timing[operation] = {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
      };
    }

    const timing = this.metrics.timing[operation];
    timing.count++;
    timing.totalTime += duration;
    timing.averageTime = timing.totalTime / timing.count;
    timing.minTime = Math.min(timing.minTime, duration);
    timing.maxTime = Math.max(timing.maxTime, duration);

    // Check for performance alerts
    if (duration > this.thresholds.timing) {
      this.addAlert({
        type: 'timing',
        severity: duration > this.thresholds.timing * 2 ? 'high' : 'medium',
        message: `Slow operation: ${operation} took ${duration.toFixed(2)}ms`,
        value: duration,
        threshold: this.thresholds.timing,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Record storage operation
   */
  recordStorageOperation(type: 'read' | 'write' | 'delete', size?: number): void {
    this.metrics.storage.operations[type === 'read' ? 'reads' : type === 'write' ? 'writes' : 'deletes']++;
    
    if (size) {
      this.metrics.storage.size += type === 'write' ? size : type === 'delete' ? -size : 0;
    }

    // Check storage size alert
    const sizeMB = this.metrics.storage.size / (1024 * 1024);
    if (sizeMB > this.thresholds.storage) {
      this.addAlert({
        type: 'storage',
        severity: sizeMB > this.thresholds.storage * 2 ? 'high' : 'medium',
        message: `High storage usage: ${sizeMB.toFixed(2)}MB`,
        value: sizeMB,
        threshold: this.thresholds.storage,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Record network request
   */
  recordNetworkRequest(bytes: number, latency: number): void {
    this.metrics.network.requests++;
    this.metrics.network.totalBytes += bytes;
    
    // Update average latency
    const totalLatency = this.metrics.network.averageLatency * (this.metrics.network.requests - 1) + latency;
    this.metrics.network.averageLatency = totalLatency / this.metrics.network.requests;

    // Check network latency alert
    if (latency > this.thresholds.networkLatency) {
      this.addAlert({
        type: 'network',
        severity: latency > this.thresholds.networkLatency * 2 ? 'high' : 'medium',
        message: `High network _latency: ${latency}ms`,
        value: latency,
        threshold: this.thresholds.networkLatency,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Start monitoring memory usage
   */
  private startMemoryMonitoring(): void {
    const updateMemoryMetrics = () => {
      if ('memory' in performance && (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory) {
        const memInfo = (performance as { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
        if (memInfo.usedJSHeapSize && memInfo.totalJSHeapSize) {
          this.metrics.memory.used = memInfo.usedJSHeapSize / (1024 * 1024); // MB
          this.metrics.memory.total = memInfo.totalJSHeapSize / (1024 * 1024); // MB
          this.metrics.memory.percentage = (this.metrics.memory.used / this.metrics.memory.total) * 100;

          // Check memory alert
          if (this.metrics.memory.used > this.thresholds.memory) {
            this.addAlert({
              type: 'memory',
              severity: this.metrics.memory.used > this.thresholds.memory * 2 ? 'critical' : 'high',
              message: `High memory usage: ${this.metrics.memory.used.toFixed(2)}MB`,
              value: this.metrics.memory.used,
              threshold: this.thresholds.memory,
              timestamp: new Date(),
            });
          }
        }
      }
    };

    // Update memory metrics every 30 seconds
    setInterval(updateMemoryMetrics, 30000);
    updateMemoryMetrics(); // Initial update
  }

  /**
   * Add a performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log critical alerts
    if (alert.severity === 'critical') {
      console.error('Performance Alert:', alert);
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance alerts
   */
  getAlerts(severity?: 'low' | 'medium' | 'high' | 'critical'): PerformanceAlert[] {
    return severity 
      ? this.alerts.filter(alert => alert.severity === severity)
      : [...this.alerts];
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(thresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Memory recommendations
    if (this.metrics.memory.used > this.thresholds.memory) {
      recommendations.push('Consider clearing old context data to reduce memory usage');
    }

    // Timing recommendations
    const slowOperations = Object.entries(this.metrics.timing)
      .filter(([, timing]) => timing.averageTime > this.thresholds.timing)
      .map(([operation]) => operation);
    
    if (slowOperations.length > 0) {
      recommendations.push(`Optimize slow operations: ${slowOperations.join(', ')}`);
    }

    // Storage recommendations
    const storageMB = this.metrics.storage.size / (1024 * 1024);
    if (storageMB > this.thresholds.storage) {
      recommendations.push('Clean up old stored data to free up space');
    }

    // Network recommendations
    if (this.metrics.network.averageLatency > this.thresholds.networkLatency) {
      recommendations.push('Consider caching API responses to reduce network latency');
    }

    return recommendations;
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    summary: string;
    metrics: PerformanceMetrics;
    alerts: PerformanceAlert[];
    recommendations: string[];
  } {
    const criticalAlerts = this.getAlerts('critical').length;
    const highAlerts = this.getAlerts('high').length;
    
    let summary = 'Performance is good';
    if (criticalAlerts > 0) {
      summary = `Performance issues detected: ${criticalAlerts} critical alerts`;
    } else if (highAlerts > 0) {
      summary = `Performance concerns: ${highAlerts} high priority alerts`;
    }

    return {
      summary,
      metrics: this.getMetrics(),
      alerts: this.getAlerts(),
      recommendations: this.getRecommendations(),
    };
  }
}

// Global performance monitor instance
export const globalPerformanceMonitor = new PerformanceMonitor();