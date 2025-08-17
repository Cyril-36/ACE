// Enhanced Audit Logging System
import { EventBus } from '../background/eventBus';

interface AuditEvent {
  type: string;
  payload: Record<string, unknown>;
}
import { BackgroundEventType, AuditLogEntry } from '../background/types';
import { IndexedDBStorageService } from '../storage';

export interface EnhancedAuditEntry extends AuditLogEntry {
  // Additional fields for enhanced auditing
  userAgent?: string;
  ipAddress?: string; // Only for cloud operations
  location?: string; // General location if available
  dataSize?: number; // Size of data involved
  processingTime?: number; // Time taken for operation
  riskLevel: RiskLevel;
  complianceFlags: ComplianceFlag[];
  relatedEntries?: string[]; // IDs of related audit entries
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ComplianceFlag {
  GDPR_RELEVANT = 'gdpr_relevant',
  CCPA_RELEVANT = 'ccpa_relevant',
  HIPAA_RELEVANT = 'hipaa_relevant',
  SOX_RELEVANT = 'sox_relevant',
  PCI_RELEVANT = 'pci_relevant',
  DATA_EXPORT = 'data_export',
  DATA_DELETION = 'data_deletion',
  CONSENT_REQUIRED = 'consent_required',
  THIRD_PARTY_SHARING = 'third_party_sharing',
}

export interface AuditFilter {
  startTime?: number;
  endTime?: number;
  eventTypes?: string[];
  actions?: string[];
  dataTypes?: string[];
  riskLevels?: RiskLevel[];
  complianceFlags?: ComplianceFlag[];
  success?: boolean;
  userId?: string;
  sessionId?: string;
}

export interface AuditReport {
  summary: {
    totalEntries: number;
    timeRange: { start: number; end: number };
    riskDistribution: Record<RiskLevel, number>;
    complianceEvents: Record<ComplianceFlag, number>;
    successRate: number;
    topActions: Array<{ action: string; count: number }>;
    topDataTypes: Array<{ dataType: string; count: number }>;
  };
  entries: EnhancedAuditEntry[];
  violations: EnhancedAuditEntry[];
  recommendations: string[];
}

export class AuditLogger {
  private eventBus: EventBus;
  private storageService: IndexedDBStorageService;
  private auditEntries: EnhancedAuditEntry[] = [];
  private maxMemoryEntries = 1000; // Keep recent entries in memory
  // private batchSize = 100; // Batch size for storage operations
  private flushInterval = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor(eventBus: EventBus, storageService: IndexedDBStorageService) {
    this.eventBus = eventBus;
    this.storageService = storageService;
    this.setupEventHandlers();
    this.startPeriodicFlush();
  }

  // Log an audit event
  async logEvent(
    event: string,
    action: string,
    dataType: string,
    success: boolean,
    details?: Record<string, unknown>,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    const auditEntry: EnhancedAuditEntry = {
      id: this.generateAuditId(),
      timestamp: Date.now(),
      event,
      action,
      dataType,
      _success: success,
      details,
      userId,
      sessionId,
      userAgent: navigator.userAgent,
      dataSize: this.estimateDataSize(details),
      riskLevel: this.assessRiskLevel(event, action, dataType, details),
      complianceFlags: this.identifyComplianceFlags(event, action, dataType, details),
    };

    // Add to memory cache
    this.auditEntries.push(auditEntry);

    // Maintain memory limit
    if (this.auditEntries.length > this.maxMemoryEntries) {
      await this.flushToStorage();
    }

    // Emit audit event
    this.eventBus.emit({
      _type: BackgroundEventType.PRIVACY_AUDIT,
      payload: {
        auditEntry,
      },
    });

    // Log high-risk events immediately
    if (auditEntry.riskLevel === RiskLevel.HIGH || auditEntry.riskLevel === RiskLevel.CRITICAL) {
      console.warn('[AuditLogger] High-risk event logged:', auditEntry);
      await this.flushToStorage(); // Immediate flush for high-risk events
    }
  }

  // Get audit entries with filtering
  async getAuditEntries(filter?: AuditFilter, limit = 1000): Promise<EnhancedAuditEntry[]> {
    // Get entries from memory
    const memoryEntries = [...this.auditEntries];

    // Get entries from storage
    const storageEntries = await this.loadFromStorage(filter, limit);

    // Combine and deduplicate
    const allEntries = [...storageEntries, ...memoryEntries];
    const uniqueEntries = this.deduplicateEntries(allEntries);

    // Apply filters
    const filteredEntries = this.applyFilters(uniqueEntries, filter);

    // Sort by timestamp (newest first)
    filteredEntries.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    return filteredEntries.slice(0, limit);
  }

  // Generate comprehensive audit report
  async generateAuditReport(filter?: AuditFilter): Promise<AuditReport> {
    const entries = await this.getAuditEntries(filter, 10000); // Get more entries for report
    const violations = entries.filter(entry => !entry._success || entry.riskLevel === RiskLevel.CRITICAL);

    // Calculate summary statistics
    const riskDistribution: Record<RiskLevel, number> = {
      [RiskLevel.LOW]: 0,
      [RiskLevel.MEDIUM]: 0,
      [RiskLevel.HIGH]: 0,
      [RiskLevel.CRITICAL]: 0,
    };

    const complianceEvents: Record<ComplianceFlag, number> = {} as Record<ComplianceFlag, number>;
    const actionCounts: Record<string, number> = {};
    const dataTypeCounts: Record<string, number> = {};

    let successCount = 0;

    entries.forEach((entry: EnhancedAuditEntry) => {
      // Risk distribution
      riskDistribution[entry.riskLevel]++;

      // Compliance events
      entry.complianceFlags.forEach((flag: ComplianceFlag) => {
        complianceEvents[flag] = (complianceEvents[flag] || 0) + 1;
      });

      // Action counts
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;

      // Data type counts
      dataTypeCounts[entry.dataType] = (dataTypeCounts[entry.dataType] || 0) + 1;

      // Success rate
      if (entry._success) successCount++;
    });

    // Top actions and data types
    const topActions = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    const topDataTypes = Object.entries(dataTypeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([dataType, count]) => ({ dataType, count }));

    // Generate recommendations
    const recommendations = this.generateRecommendations(entries, violations);

    return {
      summary: {
        totalEntries: entries.length,
        timeRange: {
          start: entries[entries.length - 1]?.timestamp || 0,
          end: entries[0]?.timestamp || 0,
        },
        riskDistribution,
        complianceEvents,
        successRate: entries.length > 0 ? successCount / entries.length : 0,
        topActions,
        topDataTypes,
      },
      entries,
      violations,
      recommendations,
    };
  }

  // Export audit log for compliance
  async exportAuditLog(format: 'json' | 'csv' = 'json', filter?: AuditFilter): Promise<string> {
    const entries = await this.getAuditEntries(filter, 50000); // Large limit for export

    if (format === 'csv') {
      return this.exportToCsv(entries);
    } else {
      return JSON.stringify({
        exportTimestamp: Date.now(),
        exportedBy: 'auto-context-engineer',
        version: '1.0.0',
        filter,
        entries,
      }, null, 2);
    }
  }

  // Clear audit log (with proper logging)
  async clearAuditLog(): Promise<void> {
    // Log the clearing action first
    await this.logEvent(
      'AUDIT_LOG_CLEARED',
      'audit_log_clear',
      'audit',
      true,
      {
        entriesCleared: this.auditEntries.length,
        clearedBy: 'user_request',
      }
    );

    // Clear memory
    this.auditEntries = [];

    // Clear storage
    await this.storageService.delete('audit_entries');

    console.log('[AuditLogger] Audit log cleared');
  }

  // Setup event handlers
  private setupEventHandlers(): void {
    // Listen for all privacy-relevant events
    this.eventBus.onMultiple({
      [BackgroundEventType.CONTEXT_CAPTURED]: this.handleContextEvent.bind(this),
      [BackgroundEventType.CONTEXT_AGGREGATED]: this.handleContextEvent.bind(this),
      [BackgroundEventType.SUMMARY_COMPLETED]: this.handleSummaryEvent.bind(this),
      [BackgroundEventType.STORAGE_WRITE]: this.handleStorageEvent.bind(this),
      [BackgroundEventType.STORAGE_READ]: this.handleStorageEvent.bind(this),
      [BackgroundEventType.STORAGE_DELETE]: this.handleStorageEvent.bind(this),
      [BackgroundEventType.CONSENT_REQUIRED]: this.handleConsentEvent.bind(this),
      [BackgroundEventType.PRIVACY_VIOLATION]: this.handleViolationEvent.bind(this),
    });
  }

  // Event handlers
  private async handleContextEvent(event: AuditEvent): Promise<void> {
    await this.logEvent(
      event.type,
      'context_processing',
      'context',
      true,
      event.payload
    );
  }

  private async handleSummaryEvent(event: AuditEvent): Promise<void> {
    await this.logEvent(
      event.type,
      'summarization',
      'summary',
      true,
      event.payload
    );
  }

  private async handleStorageEvent(event: AuditEvent): Promise<void> {
    await this.logEvent(
      event.type,
      'storage_operation',
      'storage',
      true,
      event.payload
    );
  }

  private async handleConsentEvent(event: AuditEvent): Promise<void> {
    await this.logEvent(
      event.type,
      'consent_request',
      'consent',
      true,
      event.payload
    );
  }

  private async handleViolationEvent(event: AuditEvent): Promise<void> {
    await this.logEvent(
      event.type,
      'privacy_violation',
      'violation',
      false,
      event.payload
    );
  }

  // Risk assessment
  private assessRiskLevel(
    event: string,
    action: string,
    dataType: string,
    _details?: Record<string, unknown>
  ): RiskLevel {
    // Critical risk events
    if (event.includes('VIOLATION') || action.includes('violation')) {
      return RiskLevel.CRITICAL;
    }

    // High risk events
    if (
      event.includes('CLOUD') ||
      action.includes('export') ||
      action.includes('external') ||
      dataType.includes('sensitive')
    ) {
      return RiskLevel.HIGH;
    }

    // Medium risk events
    if (
      action.includes('storage') ||
      action.includes('summarization') ||
      dataType.includes('context')
    ) {
      return RiskLevel.MEDIUM;
    }

    // Default to low risk
    return RiskLevel.LOW;
  }

  // Identify compliance flags
  private identifyComplianceFlags(
    event: string,
    action: string,
    dataType: string,
    _details?: Record<string, unknown>
  ): ComplianceFlag[] {
    const flags: ComplianceFlag[] = [];

    // GDPR relevant events
    if (
      action.includes('consent') ||
      action.includes('export') ||
      action.includes('delete') ||
      dataType.includes('personal')
    ) {
      flags.push(ComplianceFlag.GDPR_RELEVANT);
    }

    // Data export events
    if (action.includes('export') || event.includes('EXPORT')) {
      flags.push(ComplianceFlag.DATA_EXPORT);
    }

    // Data deletion events
    if (action.includes('delete') || event.includes('DELETE')) {
      flags.push(ComplianceFlag.DATA_DELETION);
    }

    // Consent required events
    if (event.includes('CONSENT') || action.includes('consent')) {
      flags.push(ComplianceFlag.CONSENT_REQUIRED);
    }

    // Third party sharing
    if (event.includes('CLOUD') || action.includes('external')) {
      flags.push(ComplianceFlag.THIRD_PARTY_SHARING);
    }

    return flags;
  }

  // Utility methods
  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private estimateDataSize(data?: Record<string, unknown>): number {
    if (!data) return 0;
    return JSON.stringify(data).length;
  }

  private applyFilters(entries: EnhancedAuditEntry[], filter?: AuditFilter): EnhancedAuditEntry[] {
    if (!filter) return entries;

    return entries.filter((entry: any) => {
      if (filter.startTime && entry.timestamp < filter.startTime) return false;
      if (filter.endTime && entry.timestamp > filter.endTime) return false;
      if (filter.eventTypes && !filter.eventTypes.includes(entry.event)) return false;
      if (filter.actions && !filter.actions.includes(entry.action)) return false;
      if (filter.dataTypes && !filter.dataTypes.includes(entry.dataType)) return false;
      if (filter.riskLevels && !filter.riskLevels.includes(entry.riskLevel)) return false;
      if (filter.complianceFlags && !filter.complianceFlags.some(flag => entry.complianceFlags.includes(flag))) return false;
      if (filter.success !== undefined && entry.success !== filter.success) return false;
      if (filter.userId && entry.userId !== filter.userId) return false;
      if (filter.sessionId && entry.sessionId !== filter.sessionId) return false;
      return true;
    });
  }

  private deduplicateEntries(entries: EnhancedAuditEntry[]): EnhancedAuditEntry[] {
    const seen = new Set<string>();
    return entries.filter((entry: any) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
  }

  private generateRecommendations(entries: EnhancedAuditEntry[], violations: EnhancedAuditEntry[]): string[] {
    const recommendations: string[] = [];

    // High violation rate
    if (violations.length / entries.length > 0.1) {
      recommendations.push('High violation rate detected. Review privacy policies and user training.');
    }

    // Too many high-risk events
    const highRiskCount = entries.filter(e => e.riskLevel === RiskLevel.HIGH || e.riskLevel === RiskLevel.CRITICAL).length;
    if (highRiskCount / entries.length > 0.2) {
      recommendations.push('High number of high-risk events. Consider implementing additional safeguards.');
    }

    // Frequent cloud operations without consent
    const cloudEvents = entries.filter(e => e.event.includes('CLOUD'));
    const consentEvents = entries.filter(e => e.complianceFlags.includes(ComplianceFlag.CONSENT_REQUIRED));
    if (cloudEvents.length > consentEvents.length * 2) {
      recommendations.push('Cloud operations may be occurring without proper consent. Review consent management.');
    }

    return recommendations;
  }

  private exportToCsv(entries: EnhancedAuditEntry[]): string {
    const headers = [
      'ID', 'Timestamp', 'Event', 'Action', 'Data Type', 'Success',
      'Risk Level', 'Compliance Flags', 'User ID', 'Session ID', 'Details'
    ];

    const rows = entries.map(entry => [
      entry.id,
      new Date(entry.timestamp).toISOString(),
      entry.event,
      entry.action,
      entry.dataType,
      entry._success.toString(),
      entry.riskLevel,
      entry.complianceFlags.join(';'),
      entry.userId || '',
      entry.sessionId || '',
      JSON.stringify(entry.details || {})
    ]);

    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  // Storage operations
  private async flushToStorage(): Promise<void> {
    if (this.auditEntries.length === 0) return;

    try {
      // Get existing entries from storage
      const existingEntries = await this.loadFromStorage();
      
      // Combine with new entries
      const allEntries = [...existingEntries, ...this.auditEntries];
      
      // Keep only recent entries (last 30 days)
      const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const recentEntries = allEntries.filter(entry => entry.timestamp >= cutoffTime);
      
      // Store back
      await this.storageService.store('audit_entries', recentEntries);
      
      // Clear memory
      this.auditEntries = [];
      
      console.log(`[AuditLogger] Flushed audit entries to storage. Total: ${recentEntries.length}`);
    } catch (error) {
      console.error('[AuditLogger] Failed to flush audit entries:', error);
    }
  }

  private async loadFromStorage(filter?: AuditFilter, limit = 1000): Promise<EnhancedAuditEntry[]> {
    try {
      const entries = await this.storageService.retrieve('audit_entries') as EnhancedAuditEntry[] || [];
      return this.applyFilters(entries, filter).slice(0, limit);
    } catch (error) {
      console.error('[AuditLogger] Failed to load audit entries:', error);
      return [];
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushToStorage();
    }, this.flushInterval);
  }

  // Cleanup
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushToStorage();
    console.log('[AuditLogger] Shutdown complete');
  }
}