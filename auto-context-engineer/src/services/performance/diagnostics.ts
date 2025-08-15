/**
 * Privacy-safe diagnostics and logging system
 */

import { globalPerformanceMonitor } from './performanceMonitor';

interface PerformanceSummary {
  memory_usage_mb: number;
  total_operations: number;
  total_alerts: number;
  critical_alerts: number;
}

interface CSVEntry {
  [key: string]: string | number | boolean | null | undefined;
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface DiagnosticEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  sanitized: boolean;
}

export interface DiagnosticConfig {
  enabled: boolean;
  optIn: boolean;
  localOnly: boolean;
  maxEntries: number;
  logLevel: LogLevel;
  categories: {
    performance: boolean;
    errors: boolean;
    user_actions: boolean;
    system_events: boolean;
  };
  retention: {
    days: number;
    autoCleanup: boolean;
  };
}

export class DiagnosticsService {
  private config: DiagnosticConfig;
  private entries: DiagnosticEntry[] = [];
  private sessionId: string;

  constructor(config: DiagnosticConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();
    
    if (config.enabled && config.retention.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Log a diagnostic entry
   */
  log(
    level: LogLevel,
    category: string,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.enabled || !this.config.optIn) {
      return;
    }

    if (level < this.config.logLevel) {
      return;
    }

    if (!this.isCategoryEnabled(category)) {
      return;
    }

    const entry: DiagnosticEntry = {
      id: this.generateEntryId(),
      timestamp: new Date(),
      level,
      category,
      message: this.sanitizeMessage(message),
      metadata: this.sanitizeMetadata(metadata),
      sanitized: true,
    };

    this.addEntry(entry);
  }

  /**
   * Log debug information
   */
  debug(category: string, message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, category, message, metadata);
  }

  /**
   * Log informational message
   */
  info(category: string, message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, category, message, metadata);
  }

  /**
   * Log warning
   */
  warn(category: string, message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, category, message, metadata);
  }

  /**
   * Log error
   */
  error(category: string, message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, category, message, metadata);
  }

  /**
   * Log critical error
   */
  critical(category: string, message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.CRITICAL, category, message, metadata);
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics(): void {
    if (!this.config.categories.performance) {
      return;
    }

    const metrics = globalPerformanceMonitor.getMetrics();
    const alerts = globalPerformanceMonitor.getAlerts('high');

    this.info('performance', 'Performance metrics snapshot', {
      memory_usage_mb: Math.round(metrics.memory.used * 100) / 100,
      memory_percentage: Math.round(metrics.memory.percentage * 100) / 100,
      active_timers: Object.keys(metrics.timing).length,
      storage_operations: metrics.storage.operations,
      network_requests: metrics.network.requests,
      high_priority_alerts: alerts.length,
    });
  }

  /**
   * Log system event
   */
  logSystemEvent(event: string, details?: Record<string, unknown>): void {
    if (!this.config.categories.system_events) {
      return;
    }

    this.info('system', `System event: ${event}`, details);
  }

  /**
   * Log user action (privacy-safe)
   */
  logUserAction(action: string, context?: string): void {
    if (!this.config.categories.user_actions) {
      return;
    }

    // Only log action type and general context, no specific data
    this.info('user_action', `User action: ${action}`, {
      context: context || 'unknown',
      session_id: this.sessionId,
    });
  }

  /**
   * Log error with stack trace (sanitized)
   */
  logError(error: Error, context?: string): void {
    if (!this.config.categories.errors) {
      return;
    }

    this.error('error', error.message, {
      error_type: error.constructor.name,
      context: context || 'unknown',
      stack_trace: this.sanitizeStackTrace(error.stack),
    });
  }

  /**
   * Get diagnostic entries
   */
  getEntries(filters?: {
    level?: LogLevel;
    category?: string;
    since?: Date;
    limit?: number;
  }): DiagnosticEntry[] {
    let filtered = [...this.entries];

    if (filters) {
      if (filters.level !== undefined) {
        filtered = filtered.filter(entry => entry.level >= filters.level!);
      }
      
      if (filters.category) {
        filtered = filtered.filter(entry => entry.category === filters.category);
      }
      
      if (filters.since) {
        filtered = filtered.filter(entry => entry.timestamp >= filters.since!);
      }
      
      if (filters.limit) {
        filtered = filtered.slice(-filters.limit);
      }
    }

    return filtered;
  }

  /**
   * Export diagnostic data
   */
  exportDiagnostics(format: 'json' | 'csv' = 'json'): string {
    if (!this.config.enabled || !this.config.optIn) {
      throw new Error('Diagnostics not enabled or user has not opted in');
    }

    const data = {
      session_id: this.sessionId,
      export_timestamp: new Date().toISOString(),
      config: {
        log_level: LogLevel[this.config.logLevel],
        categories: this.config.categories,
        local_only: this.config.localOnly,
      },
      entries: this.entries.map(entry => ({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
        level: LogLevel[entry.level],
      })),
      performance_summary: this.getPerformanceSummary(),
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // Convert entries to CSVEntry format for CSV export
      const csvEntries: CSVEntry[] = data.entries.map(entry => ({
        timestamp: entry.timestamp,
        level: entry.level,
        category: entry.category,
        message: entry.message,
        sanitized: entry.sanitized
      }));
      return this.convertToCSV(csvEntries);
    }
  }

  /**
   * Clear all diagnostic entries
   */
  clearEntries(): void {
    this.entries = [];
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DiagnosticConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enabled && this.config.retention.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): DiagnosticConfig {
    return { ...this.config };
  }

  /**
   * Get diagnostic statistics
   */
  getStatistics(): {
    total_entries: number;
    entries_by_level: Record<string, number>;
    entries_by_category: Record<string, number>;
    session_duration: number;
    oldest_entry?: Date;
    newest_entry?: Date;
  } {
    const entriesByLevel: Record<string, number> = {};
    const entriesByCategory: Record<string, number> = {};

    this.entries.forEach(entry => {
      const levelName = LogLevel[entry.level];
      entriesByLevel[levelName] = (entriesByLevel[levelName] || 0) + 1;
      entriesByCategory[entry.category] = (entriesByCategory[entry.category] || 0) + 1;
    });

    return {
      total_entries: this.entries.length,
      entries_by_level: entriesByLevel,
      entries_by_category: entriesByCategory,
      session_duration: Date.now() - new Date(this.sessionId.split('_')[1]).getTime(),
      oldest_entry: this.entries.length > 0 ? this.entries[0].timestamp : undefined,
      newest_entry: this.entries.length > 0 ? this.entries[this.entries.length - 1].timestamp : undefined,
    };
  }

  /**
   * Add entry to the log
   */
  private addEntry(entry: DiagnosticEntry): void {
    this.entries.push(entry);

    // Maintain max entries limit
    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(-this.config.maxEntries);
    }

    // Log critical entries to console
    if (entry.level === LogLevel.CRITICAL) {
      console.error(`[CRITICAL] ${entry.category}: ${entry.message}`, entry.metadata);
    }
  }

  /**
   * Check if category is enabled
   */
  private isCategoryEnabled(category: string): boolean {
    const categoryKey = category as keyof typeof this.config.categories;
    return this.config.categories[categoryKey] !== false;
  }

  /**
   * Sanitize message to remove sensitive information
   */
  private sanitizeMessage(message: string): string {
    // Remove potential sensitive patterns
    return message
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[CARD]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      .replace(/\bsk-[a-zA-Z0-9]{48}\b/g, '[API_KEY]')
      .replace(/\b[A-Za-z0-9]{32,}\b/g, '[TOKEN]');
  }

  /**
   * Sanitize metadata to remove sensitive information
   */
  private sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!metadata) return undefined;

    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeMessage(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if key contains sensitive information
   */
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password', 'token', 'key', 'secret', 'auth', 'credential',
      'email', 'phone', 'ssn', 'card', 'account', 'user_id'
    ];
    
    return sensitiveKeys.some(sensitive => 
      key.toLowerCase().includes(sensitive)
    );
  }

  /**
   * Sanitize stack trace
   */
  private sanitizeStackTrace(stack?: string): string | undefined {
    if (!stack) return undefined;

    // Remove file paths and keep only function names and line numbers
    return stack
      .split('\n')
      .map(line => {
        const match = line.match(/at\s+([^(]+)\s*\(.*:(\d+):(\d+)\)/);
        return match ? `at ${match[1]} (line ${match[2]})` : line;
      })
      .join('\n');
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique entry ID
   */
  private generateEntryId(): string {
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start automatic cleanup process
   */
  private startAutoCleanup(): void {
    const cleanupInterval = setInterval(() => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retention.days);
      
      this.entries = this.entries.filter(entry => entry.timestamp >= cutoffDate);
    }, 24 * 60 * 60 * 1000); // Run daily

    // Clean up on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        clearInterval(cleanupInterval);
      });
    }
  }

  /**
   * Get performance summary
   */
  private getPerformanceSummary(): PerformanceSummary {
    const metrics = globalPerformanceMonitor.getMetrics();
    const alerts = globalPerformanceMonitor.getAlerts();
    
    return {
      memory_usage_mb: Math.round(metrics.memory.used * 100) / 100,
      total_operations: Object.keys(metrics.timing).length,
      total_alerts: alerts.length,
      critical_alerts: alerts.filter(a => a.severity === 'critical').length,
    };
  }

  /**
   * Convert entries to CSV format
   */
  private convertToCSV(entries: CSVEntry[]): string {
    if (entries.length === 0) return '';

    const headers = ['timestamp', 'level', 'category', 'message'];
    const rows = entries.map(entry => [
      entry.timestamp,
      entry.level,
      entry.category,
      `"${String(entry.message || '').replace(/"/g, '""')}"`
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }


}

// Default diagnostic configuration
export const defaultDiagnosticConfig: DiagnosticConfig = {
  enabled: false, // Disabled by default for privacy
  optIn: false,
  localOnly: true,
  maxEntries: 1000,
  logLevel: LogLevel.INFO,
  categories: {
    performance: true,
    errors: true,
    user_actions: false, // Disabled by default for privacy
    system_events: true,
  },
  retention: {
    days: 7,
    autoCleanup: true,
  },
};

// Global diagnostics service instance
export const globalDiagnosticsService = new DiagnosticsService(defaultDiagnosticConfig);