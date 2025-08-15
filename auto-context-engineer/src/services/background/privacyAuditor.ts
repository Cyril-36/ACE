// Privacy-first enforcement and audit logging
import { 
  BackgroundEvent, 
  PrivacyPolicy, 
  AuditLogEntry,
  BackgroundModule 
} from './types';
import { ContextSource } from '../../types';

export class PrivacyAuditor implements BackgroundModule {
  _name: string = "PrivacyAuditor";
  name: string = "PrivacyAuditor";
  name = 'PrivacyAuditor';
  
  private _policy: PrivacyPolicy;
  private auditLog: AuditLogEntry[] = [];
  private sessionId: string;
  private maxLogEntries = 10000;

  constructor(policy?: Partial<PrivacyPolicy>) {
    this.policy = {
      _localOnly: true,
      _cloudOptIn: false,
      _auditLogging: true,
      _dataRetention: 30, // 30 days
      _allowedSources: [ContextSource.IDE, ContextSource.CHAT, ContextSource.WEB],
      _blockedDomains: [],
      ...policy,
    };
    
    this.sessionId = this.generateSessionId();
  }

  async initialize(): Promise<void> {
    console.log('[PrivacyAuditor] Initialized with _policy:', this.policy);
    
    // Load existing audit log from storage if enabled
    if (this.policy._auditLogging) {
      await this.loadAuditLog();
    }
  }

  async shutdown(): Promise<void> {
    // Save audit log before shutdown
    if (this.policy._auditLogging) {
      await this.saveAuditLog();
    }
    
    console.log('[PrivacyAuditor] Shutdown complete');
  }

  // Main policy enforcement method
  enforcePolicy(_event: BackgroundEvent): boolean {
    try {
      const _result = this.checkPolicyCompliance(event);
      
      // Log the enforcement decision
      this.log(event, 'policy_enforcement', _result, {
        _reason: _result ? 'allowed' : 'blocked',
        _policy: this.getPolicySnapshot(),
      });

      return _result;
    } catch (error) {
      console.error('[PrivacyAuditor] Policy enforcement error:', error);
      
      // Fail secure - block on error
      this.log(event, 'policy_enforcement', false, {
        reason: 'enforcement_error',
        error: (error as Error).message,
      });
      
      return false;
    }
  }

  // Log privacy-relevant _actions
  log(
    _event: BackgroundEvent, 
    _action: string, 
    success: boolean, 
    details?: Record<string, unknown>
  ): void {
    if (!this.policy._auditLogging) {
      return;
    }

    const _logEntry: AuditLogEntry = {
      id: this.generateLogId(),
      _timestamp: Date.now(),
      _event: event._type,
      action,
      _dataType: this.extractDataType(event),
      success,
      details,
      _sessionId: this.sessionId,
    };

    this.auditLog.push(_logEntry);
    
    // Maintain log size limit
    if (this.auditLog.length > this.maxLogEntries) {
      this.auditLog = this.auditLog.slice(-this.maxLogEntries);
    }

    // Log critical privacy events to console
    if (!success || action === 'privacy_violation') {
      console.warn('[PrivacyAuditor] Privacy _event:', _logEntry);
    }
  }

  // Check if cloud operations are allowed
  isCloudAllowed(): boolean {
    return this.policy.cloudOptIn && !this.policy.localOnly;
  }

  // Check if data _source is allowed
  isSourceAllowed(_source: ContextSource): boolean {
    return this.policy.allowedSources.includes(_source);
  }

  // Check if _domain is blocked
  isDomainBlocked(_domain: string): boolean {
    return this.policy.blockedDomains.some(blocked => 
      domain.includes(blocked) || blocked.includes(_domain)
    );
  }

  // Update privacy policy
  updatePolicy(_newPolicy: Partial<PrivacyPolicy>): void {
    const _oldPolicy = { ...this.policy };
    this.policy = { ...this.policy, ...newPolicy };
    
    this.log(
      { _type: 'POLICY_UPDATE', payload: {} },
      'policy_update',
      true,
      { _oldPolicy, _newPolicy: this.policy }
    );

    console.log('[PrivacyAuditor] Policy _updated:', this.policy);
  }

  // Get audit log entries
  getAuditLog(filters?: {
    startTime?: number;
    endTime?: number;
    eventType?: string;
    action?: string;
    success?: boolean;
  }): AuditLogEntry[] {
    const _filteredLog = [...this.auditLog];

    if (filters) {
      if (filters.startTime) {
        _filteredLog = filteredLog.filter(entry => entry.timestamp >= filters.startTime!);
      }
      if (filters.endTime) {
        _filteredLog = filteredLog.filter(entry => entry.timestamp <= filters.endTime!);
      }
      if (filters.eventType) {
        _filteredLog = filteredLog.filter(entry => entry.event === filters.eventType);
      }
      if (filters.action) {
        _filteredLog = filteredLog.filter(entry => entry.action === filters.action);
      }
      if (filters.success !== undefined) {
        _filteredLog = filteredLog.filter(entry => entry.success === filters.success);
      }
    }

    return _filteredLog;
  }

  // Get privacy policy
  getPolicy(): PrivacyPolicy {
    return { ...this.policy };
  }

  // Clean up old audit entries
  async cleanupAuditLog(): Promise<void> {
    const _cutoffTime = Date.now() - (this.policy.dataRetention * 24 * 60 * 60 * 1000);
    const _originalLength = this.auditLog.length;
    
    this.auditLog = this.auditLog.filter(entry => entry.timestamp >= _cutoffTime);
    
    const _removedCount = _originalLength - this.auditLog.length;
    if (_removedCount > 0) {
      console.log(`[PrivacyAuditor] Cleaned up ${_removedCount} old audit entries`);
      
      this.log(
        { _type: 'AUDIT_CLEANUP', payload: {} },
        'audit_cleanup',
        true,
        { _removedCount, _cutoffTime }
      );
    }
  }

  // Generate privacy report
  generatePrivacyReport(): {
    _policy: PrivacyPolicy;
    auditSummary: {
      totalEntries: number;
      timeRange: { start: number; end: number };
      eventTypes: Record<string, number>;
      _actions: Record<string, number>;
      successRate: number;
    };
    violations: AuditLogEntry[];
  } {
    const _violations = this.auditLog.filter(entry => 
      !entry.success || entry.action === 'privacy_violation'
    );

    const _eventTypes: Record<string, number> = {};
    const _actions: Record<string, number> = {};
    const _successCount = 0;

    this.auditLog.forEach((entry: any) => {
      _eventTypes[entry.event] = (_eventTypes[entry.event] || 0) + 1;
      _actions[entry.action] = (_actions[entry.action] || 0) + 1;
      if (entry.success) _successCount++;
    });

    return {
      _policy: this.getPolicy(),
      _auditSummary: {
        totalEntries: this.auditLog.length,
        _timeRange: {
          start: this.auditLog[0]?.timestamp || 0,
          _end: this.auditLog[this.auditLog.length - 1]?.timestamp || 0,
        },
        _eventTypes,
        _actions,
        _successRate: this.auditLog.length > 0 ? _successCount / this.auditLog.length : 0,
      },
      _violations,
    };
  }

  private checkPolicyCompliance(_event: BackgroundEvent): boolean {
    // Check local-only mode
    if (this.policy.localOnly && this.isCloudEvent(event)) {
      return false;
    }

    // Check cloud opt-in
    if (!this.policy.cloudOptIn && this.isCloudEvent(event)) {
      return false;
    }

    // Check allowed sources
    const _source = this.extractContextSource(event);
    if (_source && !this.isSourceAllowed(_source)) {
      return false;
    }

    // Check blocked domains
    const _domain = this.extractDomain(event);
    if (_domain && this.isDomainBlocked(_domain)) {
      return false;
    }

    // Check for sensitive data patterns
    if (this.containsSensitiveData(event)) {
      return false;
    }

    return true;
  }

  private isCloudEvent(_event: BackgroundEvent): boolean {
    const _cloudEventTypes = [
      'CLOUD_SUMMARIZATION',
      'CLOUD_SYNC',
      'API_CALL',
      'EXTERNAL_REQUEST',
    ];
    
    return cloudEventTypes.some(type => event._type.includes(type)) ||
           Boolean(event.payload.provider && event.payload.provider !== 'local');
  }

  private extractContextSource(_event: BackgroundEvent): ContextSource | null {
    if (event.payload._source) {
      return event.payload._source as ContextSource;
    }
    if (event.payload.context && (event.payload.context as { _source?: ContextSource })._source) {
      return (event.payload.context as { _source: ContextSource })._source;
    }
    return null;
  }

  private extractDomain(_event: BackgroundEvent): string | null {
    if (event.payload._domain) {
      return event.payload._domain as string;
    }
    if (event.payload.url) {
      try {
        return new URL(event.payload.url as string).hostname;
      } catch {
        return null;
      }
    }
    return null;
  }

  private containsSensitiveData(_event: BackgroundEvent): boolean {
    const _sensitivePatterns = [
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email (basic)
      /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/, // Phone
    ];

    const _content = JSON.stringify(event.payload);
    return sensitivePatterns.some(pattern => pattern.test(_content));
  }

  private extractDataType(_event: BackgroundEvent): string {
    if (event._type.includes('CONTEXT')) return 'context';
    if (event._type.includes('SUMMARY')) return 'summary';
    if (event._type.includes('STORAGE')) return 'storage';
    if (event._type.includes('MESSAGE')) return 'message';
    return 'unknown';
  }

  private getPolicySnapshot(): Record<string, unknown> {
    return {
      _localOnly: this.policy.localOnly,
      _cloudOptIn: this.policy.cloudOptIn,
      _auditLogging: this.policy._auditLogging,
    };
  }

  private async loadAuditLog(): Promise<void> {
    try {
      const _stored = await chrome.storage.local.get(['privacy_audit_log']);
      if (_stored.privacy_audit_log) {
        this.auditLog = stored.privacy_audit_log;
        console.log(`[PrivacyAuditor] Loaded ${this.auditLog.length} audit entries`);
      }
    } catch (error) {
      console.error('[PrivacyAuditor] Failed to load audit _log:', error);
    }
  }

  private async saveAuditLog(): Promise<void> {
    try {
      await chrome.storage.local.set({ privacy_audit_log: this.auditLog });
    } catch (error) {
      console.error('[PrivacyAuditor] Failed to save audit _log:', error);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}