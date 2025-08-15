// Main Privacy Service - Integrates all privacy components
import { EventBus } from '../background/eventBus';
import { BackgroundEvent, BackgroundEventType, PrivacyPolicy, BackgroundModule } from '../background/types';
import { IndexedDBStorageService } from '../storage';
import { ConsentManager, ConsentType, ConsentRequest } from './consentManager';
import { AuditLogger, AuditFilter, AuditReport } from './auditLogger';
import { PolicyEngine, PolicyRule, PolicyViolation } from './policyEngine';
import { ContextSource } from '../../types';

export interface PrivacyServiceConfig {
  policy?: Partial<PrivacyPolicy>;
  auditRetentionDays?: number;
  enableRealTimeMonitoring?: boolean;
  enableThreatDetection?: boolean;
}

export interface PrivacyDashboard {
  policy: PrivacyPolicy;
  consentStatus: {
    totalConsents: number;
    activeConsents: number;
    expiredConsents: number;
    revokedConsents: number;
  };
  auditSummary: {
    totalEvents: number;
    violationCount: number;
    riskDistribution: Record<string, number>;
    recentActivity: number;
  };
  violations: PolicyViolation[];
  recommendations: string[];
}

export interface ThreatDetectionAlert {
  id: string;
  timestamp: number;
  type: 'anomaly' | 'pattern' | 'volume' | 'suspicious';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  events: BackgroundEvent[];
  autoMitigated: boolean;
  recommendedActions: string[];
}

export class PrivacyService implements BackgroundModule {
  _name: string = "PrivacyService";
  name: string = "PrivacyService";
  name = 'PrivacyService';
  
  private eventBus: EventBus;
  // private storageService: IndexedDBStorageService;
  private consentManager: ConsentManager;
  private auditLogger: AuditLogger;
  private policyEngine: PolicyEngine;
  private config: PrivacyServiceConfig;
  private policy: PrivacyPolicy;
  private threatAlerts: ThreatDetectionAlert[] = [];
  private eventHistory: BackgroundEvent[] = [];
  private maxEventHistory = 1000;

  constructor(
    eventBus: EventBus,
    storageService: IndexedDBStorageService,
    config: PrivacyServiceConfig = {}
  ) {
    this.eventBus = eventBus;
    // this.storageService = storageService;
    this.config = config;
    
    // Initialize default policy
    this.policy = {
      localOnly: true,
      cloudOptIn: false,
      _auditLogging: true,
      dataRetention: config.auditRetentionDays || 30,
      allowedSources: [ContextSource.IDE, ContextSource.CHAT, ContextSource.WEB],
      blockedDomains: [],
      ...config.policy,
    };

    // Initialize components
    this.consentManager = new ConsentManager(eventBus);
    this.auditLogger = new AuditLogger(eventBus, storageService);
    this.policyEngine = new PolicyEngine(eventBus, this.consentManager, this.auditLogger, this.policy);
  }

  async initialize(): Promise<void> {
    console.log('[PrivacyService] Initializing privacy service...');

    // Load saved policy
    await this.loadPolicy();

    // Setup event handlers
    this.setupEventHandlers();

    // Start monitoring if enabled
    if (this.config.enableRealTimeMonitoring) {
      this.startRealTimeMonitoring();
    }

    // Start threat detection if enabled
    if (this.config.enableThreatDetection) {
      this.startThreatDetection();
    }

    console.log('[PrivacyService] Privacy service initialized');
  }

  async shutdown(): Promise<void> {
    await this.auditLogger.shutdown();
    await this.savePolicy();
    console.log('[PrivacyService] Privacy service shutdown complete');
  }

  // Main privacy enforcement method
  async enforcePrivacy(event: BackgroundEvent): Promise<boolean> {
    try {
      // Add to event history for threat detection
      this.addToEventHistory(event);

      // Enforce policy
      const result = await this.policyEngine.enforcePolicy(event);

      // Handle consent requirements
      if (!result.allowed && result.requiresConsent) {
        await this.handleConsentRequired(event, result.requiresConsent);
        return false;
      }

      // Handle violations
      if (result.violation) {
        await this.handleViolation(result.violation);
      }

      // Apply modifications if needed
      if (result.modifications) {
        await this.applyEventModifications(event, result.modifications);
      }

      return result.allowed;
    } catch (error) {
      console.error('[PrivacyService] Privacy enforcement error: ', error);
      
      // Log the error
      await this.auditLogger.logEvent(
        event._type,
        'privacy_enforcement_error',
        'privacy',
        false,
        {
          error: (error as Error).message,
          stack: (error as Error).stack,
        }
      );

      // Fail secure
      return false;
    }
  }

  // Consent management methods
  async requestConsent(
    type: ConsentType,
    title: string,
    description: string,
    details: string[],
    dataTypes: string[],
    purposes: string[]
  ): Promise<boolean> {
    const request: Omit<ConsentRequest, 'id' | 'timestamp'> = {
      type,
      title,
      description,
      details,
      dataTypes,
      purposes,
      required: true,
    };

    const response = await this.consentManager.requestConsent(request);
    return response.granted;
  }

  async revokeConsent(type: ConsentType): Promise<void> {
    await this.consentManager.revokeConsent(type);
  }

  hasValidConsent(type: ConsentType): boolean {
    return this.consentManager.hasValidConsent(type);
  }

  getAllConsents() {
    return this.consentManager.getAllConsents();
  }

  // Audit and reporting methods
  async getAuditReport(filter?: AuditFilter): Promise<AuditReport> {
    return this.auditLogger.generateAuditReport(filter);
  }

  async exportAuditLog(format: 'json' | 'csv' = 'json', filter?: AuditFilter): Promise<string> {
    return this.auditLogger.exportAuditLog(format, filter);
  }

  async clearAuditLog(): Promise<void> {
    await this.auditLogger.clearAuditLog();
  }

  // Policy management methods
  updatePolicy(newPolicy: Partial<PrivacyPolicy>): void {
    this.policy = { ...this.policy, ...newPolicy };
    this.policyEngine.updatePolicy(this.policy);
    this.savePolicy();
  }

  getPolicy(): PrivacyPolicy {
    return { ...this.policy };
  }

  addPolicyRule(rule: PolicyRule): void {
    this.policyEngine.addRule(rule);
  }

  removePolicyRule(ruleId: string): void {
    this.policyEngine.removeRule(ruleId);
  }

  getPolicyRules(): PolicyRule[] {
    return this.policyEngine.getRules();
  }

  getPolicyViolations(): PolicyViolation[] {
    return this.policyEngine.getViolations();
  }

  // Privacy dashboard
  async getPrivacyDashboard(): Promise<PrivacyDashboard> {
    const consents = this.getAllConsents();
    const auditReport = await this.getAuditReport();
    const violations = this.getPolicyViolations();

    // Calculate consent status
    const now = Date.now();
    const consentStatus = {
      totalConsents: consents.length,
      activeConsents: consents.filter(c => c.granted && !c.revokedAt && (!c.expiresAt || c.expiresAt > now)).length,
      expiredConsents: consents.filter(c => c.expiresAt && c.expiresAt <= now).length,
      revokedConsents: consents.filter(c => c.revokedAt).length,
    };

    // Generate recommendations
    const recommendations = this.generatePrivacyRecommendations(auditReport, violations, consents);

    return {
      policy: this.policy,
      consentStatus,
      auditSummary: {
        totalEvents: auditReport.summary.totalEntries,
        violationCount: violations.length,
        riskDistribution: auditReport.summary.riskDistribution,
        recentActivity: auditReport.entries.filter(e => e.timestamp > Date.now() - 24 * 60 * 60 * 1000).length,
      },
      violations: violations.slice(-10), // Last 10 violations
      recommendations,
    };
  }

  // Threat detection
  getThreatAlerts(): ThreatDetectionAlert[] {
    return this.threatAlerts.slice(-50); // Last 50 alerts
  }

  async clearThreatAlerts(): Promise<void> {
    this.threatAlerts = [];
    console.log('[PrivacyService] Threat alerts cleared');
  }

  // Privacy reset (nuclear option)
  async resetPrivacyData(): Promise<void> {
    console.log('[PrivacyService] Starting privacy data reset...');

    // Clear all consents
    await this.consentManager.clearAllConsents();

    // Clear audit log
    await this.auditLogger.clearAuditLog();

    // Clear violations
    this.policyEngine.clearViolations();

    // Clear threat alerts
    await this.clearThreatAlerts();

    // Reset policy to defaults
    this.policy = {
      localOnly: true,
      cloudOptIn: false,
      _auditLogging: true,
      dataRetention: 30,
      allowedSources: [ContextSource.IDE, ContextSource.CHAT, ContextSource.WEB],
      blockedDomains: [],
    };

    await this.savePolicy();

    // Log the reset
    await this.auditLogger.logEvent(
      'PRIVACY_RESET',
      'privacy_data_reset',
      'privacy',
      true,
      {
        timestamp: Date.now(),
        resetBy: 'user_request',
      }
    );

    console.log('[PrivacyService] Privacy data reset complete');
  }

  // Event handlers
  private setupEventHandlers(): void {
    // Listen for specific events that need privacy enforcement
    this.eventBus.onMultiple({
      [BackgroundEventType.CONTEXT_CAPTURED]: this.handlePrivacyEnforcement.bind(this),
      [BackgroundEventType.CONTEXT_AGGREGATED]: this.handlePrivacyEnforcement.bind(this),
      [BackgroundEventType.SUMMARY_TRIGGER]: this.handlePrivacyEnforcement.bind(this),
      [BackgroundEventType.SUMMARY_COMPLETED]: this.handlePrivacyEnforcement.bind(this),
      [BackgroundEventType.STORAGE_WRITE]: this.handlePrivacyEnforcement.bind(this),
      [BackgroundEventType.STORAGE_READ]: this.handlePrivacyEnforcement.bind(this),
      [BackgroundEventType.STORAGE_DELETE]: this.handlePrivacyEnforcement.bind(this),
    });
  }

  // Handle privacy enforcement for events
  private async handlePrivacyEnforcement(event: BackgroundEvent): Promise<void> {
    // Skip privacy events to avoid recursion
    if (event._type.includes('PRIVACY') || event._type.includes('AUDIT')) {
      return;
    }

    // Add to event history for threat detection
    this.addToEventHistory(event);

    // Note: In a real implementation, we would need to intercept events before they're processed
    // For now, we'll just log and audit the events
    const allowed = await this.enforcePrivacy(event);
    if (!allowed) {
      console.warn(`[PrivacyService] Event would be blocked by privacy policy: ${event._type}`);
    }
  }

  // Handle consent required scenarios
  private async handleConsentRequired(event: BackgroundEvent, consentType: ConsentType): Promise<void> {
    const consentDetails = this.getConsentDetails(consentType, event);
    
    // Request consent from user
    const granted = await this.requestConsent(
      consentType,
      consentDetails.title,
      consentDetails.description,
      consentDetails.details,
      consentDetails.dataTypes,
      consentDetails.purposes
    );

    if (!granted) {
      console.log(`[PrivacyService] Consent denied for ${consentType}`);
    }
  }

  // Handle policy violations
  private async handleViolation(violation: PolicyViolation): Promise<void> {
    console.warn(`[PrivacyService] Policy violation detected:`, violation);

    // Auto-mitigation for critical violations
    if (violation.severity === 'critical') {
      await this.autoMitigateViolation(violation);
    }

    // Create threat alert if needed
    if (violation.severity === 'high' || violation.severity === 'critical') {
      await this.createThreatAlert('pattern', violation.severity, `Policy violation: ${violation.description}`, [violation.event]);
    }
  }

  // Apply event modifications
  private async applyEventModifications(event: BackgroundEvent, modifications: Record<string, unknown>): Promise<void> {
    if (modifications.anonymized) {
      console.log(`[PrivacyService] Event anonymized: ${event._type}`);
    }

    if (modifications.extraEncryption) {
      console.log(`[PrivacyService] Extra encryption applied: ${event._type}`);
    }
  }

  // Auto-mitigation for critical violations
  private async autoMitigateViolation(violation: PolicyViolation): Promise<void> {
    // Add domain to blocklist if it's a domain-related violation
    const domain = this.extractDomain(violation.event);
    if (domain && !this.policy.blockedDomains.includes(domain)) {
      this.policy.blockedDomains.push(domain);
      await this.savePolicy();
      console.log(`[PrivacyService] Auto-blocked domain: ${domain}`);
    }

    // Mark violation as auto-resolved
    violation.autoResolved = true;
  }

  // Real-time monitoring
  private startRealTimeMonitoring(): void {
    setInterval(async () => {
      const recentEvents = this.eventHistory.slice(-100); // Last 100 events
      await this.analyzeEventPatterns(recentEvents);
    }, 60000); // Every minute
  }

  // Threat detection
  private startThreatDetection(): void {
    setInterval(async () => {
      await this.detectThreats();
    }, 300000); // Every 5 minutes
  }

  // Analyze event patterns for anomalies
  private async analyzeEventPatterns(events: BackgroundEvent[]): Promise<void> {
    // Detect unusual volume
    const eventCounts = events.reduce((acc, event) => {
      acc[event._type] = (acc[event._type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [eventType, count] of Object.entries(eventCounts)) {
      if (count > 50) { // Threshold for unusual volume
        await this.createThreatAlert(
          'volume',
          'medium',
          `Unusual volume of ${eventType} events: ${count}`,
          events.filter(e => e._type === eventType)
        );
      }
    }
  }

  // Detect various types of threats
  private async detectThreats(): Promise<void> {
    const recentEvents = this.eventHistory.slice(-500); // Last 500 events
    
    // Detect rapid-fire events (potential automation)
    const rapidEvents = this.detectRapidFireEvents(recentEvents);
    if (rapidEvents.length > 0) {
      await this.createThreatAlert(
        'pattern',
        'high',
        'Rapid-fire events detected (potential automation)',
        rapidEvents
      );
    }

    // Detect suspicious patterns
    const suspiciousEvents = this.detectSuspiciousPatterns(recentEvents);
    if (suspiciousEvents.length > 0) {
      await this.createThreatAlert(
        'suspicious',
        'high',
        'Suspicious event patterns detected',
        suspiciousEvents
      );
    }
  }

  // Create threat alert
  private async createThreatAlert(
    type: 'anomaly' | 'pattern' | 'volume' | 'suspicious',
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    events: BackgroundEvent[]
  ): Promise<void> {
    const alert: ThreatDetectionAlert = {
      id: this.generateAlertId(),
      timestamp: Date.now(),
      type,
      severity,
      description,
      events,
      autoMitigated: false,
      recommendedActions: this.getRecommendedActions(type, severity),
    };

    this.threatAlerts.push(alert);

    // Maintain alerts limit
    if (this.threatAlerts.length > 100) {
      this.threatAlerts = this.threatAlerts.slice(-100);
    }

    // Log the alert
    await this.auditLogger.logEvent(
      'THREAT_DETECTED',
      'threat_detection',
      'security',
      true,
      {
        alertId: alert.id,
        type,
        severity,
        description,
        eventCount: events.length,
      }
    );

    console.warn(`[PrivacyService] Threat alert created:`, alert);
  }

  // Utility methods
  private addToEventHistory(event: BackgroundEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxEventHistory);
    }
  }

  private detectRapidFireEvents(events: BackgroundEvent[]): BackgroundEvent[] {
    const rapidEvents: BackgroundEvent[] = [];
    const timeWindow = 1000; // 1 second
    const threshold = 10; // 10 events per second

    for (let i = 0; i < events.length - threshold; i++) {
      const windowEvents = events.slice(i, i + threshold);
      const timeSpan = windowEvents[windowEvents.length - 1].timestamp! - windowEvents[0].timestamp!;
      
      if (timeSpan < timeWindow) {
        rapidEvents.push(...windowEvents);
      }
    }

    return rapidEvents;
  }

  private detectSuspiciousPatterns(events: BackgroundEvent[]): BackgroundEvent[] {
    // Look for events with suspicious characteristics
    return events.filter((event: any) => {
      // Events with unusual payload sizes
      const payloadSize = JSON.stringify(event.payload).length;
      if (payloadSize > 10000) return true; // Very large payloads

      // Events with suspicious keywords
      const content = JSON.stringify(event.payload).toLowerCase();
      const suspiciousKeywords = ['hack', 'exploit', 'bypass', 'inject', 'script'];
      if (suspiciousKeywords.some(keyword => content.includes(keyword))) return true;

      return false;
    });
  }

  private getConsentDetails(consentType: ConsentType, _event: BackgroundEvent) {
    switch (consentType) {
      case ConsentType.CLOUD_PROCESSING:
        return {
          title: 'Cloud Processing Consent',
          description: 'This operation requires sending data to cloud services for processing.',
          details: [
            'Your data will be sent to external cloud providers',
            'Processing will use your own API keys',
            'Data will not be stored permanently on cloud servers',
            'You can revoke this consent at any time'
          ],
          dataTypes: ['context', 'summary'],
          purposes: ['summarization', 'processing']
        };
      case ConsentType.DATA_EXPORT:
        return {
          title: 'Data Export Consent',
          description: 'This operation will export your data outside the extension.',
          details: [
            'Your data will be exported to a file',
            'Exported data may contain sensitive information',
            'You are responsible for the security of exported data'
          ],
          dataTypes: ['all_data'],
          purposes: ['backup', 'migration']
        };
      default:
        return {
          title: 'General Consent',
          description: 'This operation requires your consent.',
          details: ['Operation details not specified'],
          dataTypes: ['unknown'],
          purposes: ['unknown']
        };
    }
  }

  private getRecommendedActions(type: string, severity: string): string[] {
    const actions: string[] = [];

    if (severity === 'critical' || severity === 'high') {
      actions.push('Review immediately');
      actions.push('Consider blocking the source');
    }

    if (type === 'volume') {
      actions.push('Check for automated attacks');
      actions.push('Implement rate limiting');
    }

    if (type === 'pattern' || type === 'suspicious') {
      actions.push('Analyze event patterns');
      actions.push('Update security rules');
    }

    return actions;
  }

  private generatePrivacyRecommendations(
    auditReport: AuditReport,
    violations: PolicyViolation[],
    consents: Array<{ type: ConsentType; granted: boolean }>
  ): string[] {
    const recommendations: string[] = [];

    // High violation rate
    if (violations.length > 10) {
      recommendations.push('High number of policy violations detected. Review and update privacy policies.');
    }

    // Missing consents
    const cloudEvents = auditReport.entries.filter(e => e.event.includes('CLOUD')).length;
    const cloudConsents = consents.filter(c => c._type === ConsentType.CLOUD_PROCESSING && c.granted).length;
    if (cloudEvents > 0 && cloudConsents === 0) {
      recommendations.push('Cloud operations detected without proper consent. Enable cloud consent management.');
    }

    // Audit log recommendations
    if (auditReport.summary.totalEntries > 10000) {
      recommendations.push('Large audit log detected. Consider archiving old entries to improve performance.');
    }

    return recommendations;
  }

  private extractDomain(event: BackgroundEvent): string | null {
    if (event.payload.domain) {
      return event.payload.domain as string;
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

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private async loadPolicy(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(['privacy_policy']);
      if (stored.privacy_policy) {
        this.policy = { ...this.policy, ...stored.privacy_policy };
        console.log('[PrivacyService] Loaded privacy policy from storage');
      }
    } catch (error) {
      console.error('[PrivacyService] Failed to load privacy policy:', error);
    }
  }

  private async savePolicy(): Promise<void> {
    try {
      await chrome.storage.local.set({ privacy_policy: this.policy });
    } catch (error) {
      console.error('[PrivacyService] Failed to save privacy policy:', error);
    }
  }
}