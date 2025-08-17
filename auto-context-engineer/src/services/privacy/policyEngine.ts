// Privacy Policy Enforcement Engine
import { EventBus } from '../background/eventBus';
import { BackgroundEvent, BackgroundEventType, PrivacyPolicy } from '../background/types';
import { ConsentManager, ConsentType } from './consentManager';
import { AuditLogger, RiskLevel } from './auditLogger';
import { ContextSource } from '../../types';

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  condition: PolicyCondition;
  action: PolicyAction;
  priority: number;
  enabled: boolean;
}

export interface PolicyCondition {
  eventTypes?: string[];
  actions?: string[];
  dataTypes?: string[];
  sources?: ContextSource[];
  domains?: string[];
  riskLevels?: RiskLevel[];
  timeRange?: { start: number; end: number };
  userRoles?: string[];
  customCondition?: (event: BackgroundEvent) => boolean;
}

export enum PolicyAction {
  ALLOW = 'allow',
  DENY = 'deny',
  REQUIRE_CONSENT = 'require_consent',
  LOG_ONLY = 'log_only',
  QUARANTINE = 'quarantine',
  ANONYMIZE = 'anonymize',
  ENCRYPT_EXTRA = 'encrypt_extra',
}

export interface PolicyViolation {
  id: string;
  timestamp: number;
  ruleId: string;
  ruleName: string;
  event: BackgroundEvent;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendedAction: string;
  autoResolved: boolean;
}

export interface PolicyEnforcementResult {
  allowed: boolean;
  action: PolicyAction;
  ruleId?: string;
  requiresConsent?: ConsentType;
  violation?: PolicyViolation;
  modifications?: Record<string, unknown>;
}

export class PolicyEngine {
  private eventBus: EventBus;
  private consentManager: ConsentManager;
  private auditLogger: AuditLogger;
  private policy: PrivacyPolicy;
  private rules: Map<string, PolicyRule> = new Map();
  private violations: PolicyViolation[] = [];
  private maxViolations = 1000;

  constructor(
    eventBus: EventBus,
    consentManager: ConsentManager,
    auditLogger: AuditLogger,
    policy: PrivacyPolicy
  ) {
    this.eventBus = eventBus;
    this.consentManager = consentManager;
    this.auditLogger = auditLogger;
    this.policy = policy;
    this.initializeDefaultRules();
  }

  // Main policy enforcement method
  async enforcePolicy(event: BackgroundEvent): Promise<PolicyEnforcementResult> {
    try {
      // Find applicable rules
      const applicableRules = this.findApplicableRules(event);
      
      if (applicableRules.length === 0) {
        // No rules apply, use default policy
        return this.applyDefaultPolicy(event);
      }

      // Sort rules by priority (higher priority first)
      applicableRules.sort((a, b) => b.priority - a.priority);

      // Apply the highest priority rule
      const rule = applicableRules[0];
      const result = await this.applyRule(rule, event);

      // Log enforcement decision
      await this.auditLogger.logEvent(
        event._type,
        'policy_enforcement',
        'policy',
        result.allowed,
        {
          ruleId: rule.id,
          ruleName: rule.name,
          action: result.action,
          requiresConsent: result.requiresConsent,
        }
      );

      return result;
    } catch (error) {
      console.error('[PolicyEngine] Policy enforcement error: ', error);
      
      // Log the error
      await this.auditLogger.logEvent(
        event._type,
        'policy_enforcement_error',
        'policy',
        false,
        {
          error: (error as Error).message,
          stack: (error as Error).stack,
        }
      );

      // Fail secure - deny by default
      return {
        allowed: false,
        action: PolicyAction.DENY,
        violation: await this.createViolation('system_error', event, 'critical', 'Policy enforcement system error'),
      };
    }
  }

  // Add or update a policy rule
  addRule(rule: PolicyRule): void {
    this.rules.set(rule.id, rule);
    console.log(`[PolicyEngine] Added rule: ${rule.name}`);
  }

  // Remove a policy rule
  removeRule(ruleId: string): void {
    if (this.rules.delete(ruleId)) {
      console.log(`[PolicyEngine] Removed rule: ${ruleId}`);
    }
  }

  // Get all rules
  getRules(): PolicyRule[] {
    return Array.from(this.rules.values());
  }

  // Update privacy policy
  updatePolicy(newPolicy: Partial<PrivacyPolicy>): void {
    this.policy = { ...this.policy, ...newPolicy };
    console.log('[PolicyEngine] Policy updated:', this.policy);
  }

  // Get policy violations
  getViolations(limit = 100): PolicyViolation[] {
    return this.violations.slice(-limit);
  }

  // Clear violations
  clearViolations(): void {
    this.violations = [];
    console.log('[PolicyEngine] Violations cleared');
  }

  // Check if operation requires consent
  async checkConsentRequired(event: BackgroundEvent): Promise<ConsentType | null> {
    // Cloud operations
    if (this.isCloudEvent(event)) {
      return ConsentType.CLOUD_PROCESSING;
    }

    // Data export operations
    if (event._type.includes('EXPORT') || event.payload.action === 'export') {
      return ConsentType.DATA_EXPORT;
    }

    // Analytics operations
    if (event._type.includes('ANALYTICS') || event.payload.action === 'analytics') {
      return ConsentType.ANALYTICS;
    }

    // Third-party integrations
    if (event._type.includes('THIRD_PARTY') || event.payload.thirdParty) {
      return ConsentType.THIRD_PARTY_INTEGRATION;
    }

    return null;
  }

  // Initialize default privacy rules
  private initializeDefaultRules(): void {
    // Rule 1: Block all cloud operations in local-only mode
    this.addRule({
      id: 'local_only_enforcement',
      name: 'Local Only Mode Enforcement',
      description: 'Block all cloud operations when local-only mode is enabled',
      condition: {
        customCondition: (event) => this.policy.localOnly && this.isCloudEvent(event),
      },
      action: PolicyAction.DENY,
      priority: 100,
      enabled: true,
    });

    // Rule 2: Require consent for cloud operations
    this.addRule({
      id: 'cloud_consent_required',
      name: 'Cloud Operations Consent',
      description: 'Require explicit consent for all cloud operations',
      condition: {
        customCondition: (event) => this.isCloudEvent(event),
      },
      action: PolicyAction.REQUIRE_CONSENT,
      priority: 90,
      enabled: true,
    });

    // Rule 3: Block operations from disallowed sources
    this.addRule({
      id: 'source_allowlist',
      name: 'Source Allowlist',
      description: 'Only allow operations from approved sources',
      condition: {
        customCondition: (event) => {
          const source = this.extractContextSource(event);
          return source ? !this.policy.allowedSources.includes(source) : false;
        },
      },
      action: PolicyAction.DENY,
      priority: 80,
      enabled: true,
    });

    // Rule 4: Block operations from blocked domains
    this.addRule({
      id: 'domain_blocklist',
      name: 'Domain Blocklist',
      description: 'Block operations from blocked domains',
      condition: {
        customCondition: (event) => {
          const domain = this.extractDomain(event);
          return domain ? this.isDomainBlocked(domain) : false;
        },
      },
      action: PolicyAction.DENY,
      priority: 70,
      enabled: true,
    });

    // Rule 5: Anonymize sensitive data
    this.addRule({
      id: 'sensitive_data_anonymization',
      name: 'Sensitive Data Anonymization',
      description: 'Anonymize sensitive data patterns',
      condition: {
        customCondition: (event) => this.containsSensitiveData(event),
      },
      action: PolicyAction.ANONYMIZE,
      priority: 60,
      enabled: true,
    });

    // Rule 6: Extra encryption for high-risk operations
    this.addRule({
      id: 'high_risk_encryption',
      name: 'High Risk Extra Encryption',
      description: 'Apply extra encryption for high-risk operations',
      condition: {
        riskLevels: [RiskLevel.HIGH, RiskLevel.CRITICAL],
      },
      action: PolicyAction.ENCRYPT_EXTRA,
      priority: 50,
      enabled: true,
    });

    console.log(`[PolicyEngine] Initialized ${this.rules.size} default rules`);
  }

  // Find rules that apply to an event
  private findApplicableRules(event: BackgroundEvent): PolicyRule[] {
    return Array.from(this.rules.values()).filter((rule: any) => {
      if (!rule.enabled) return false;
      return this.ruleMatches(rule, event);
    });
  }

  // Check if a rule matches an event
  private ruleMatches(rule: PolicyRule, event: BackgroundEvent): boolean {
    const condition = rule.condition;

    // Check event types
    if (condition.eventTypes && !condition.eventTypes.includes(event._type)) {
      return false;
    }

    // Check actions
    if (condition.actions && event.payload.action) {
      if (!condition.actions.includes(event.payload.action as string)) {
        return false;
      }
    }

    // Check data types
    if (condition.dataTypes && event.payload.dataType) {
      if (!condition.dataTypes.includes(event.payload.dataType as string)) {
        return false;
      }
    }

    // Check sources
    if (condition.sources) {
      const source = this.extractContextSource(event);
      if (!source || !condition.sources.includes(source)) {
        return false;
      }
    }

    // Check domains
    if (condition.domains) {
      const domain = this.extractDomain(event);
      if (!domain || !condition.domains.includes(domain)) {
        return false;
      }
    }

    // Check time range
    if (condition.timeRange) {
      const timestamp = event.timestamp || Date.now();
      if (timestamp < condition.timeRange.start || timestamp > condition.timeRange.end) {
        return false;
      }
    }

    // Check custom condition
    if (condition.customCondition) {
      return condition.customCondition(event);
    }

    return true;
  }

  // Apply a specific rule to an event
  private async applyRule(rule: PolicyRule, event: BackgroundEvent): Promise<PolicyEnforcementResult> {
    switch (rule.action) {
      case PolicyAction.ALLOW:
        return { allowed: true, action: rule.action, ruleId: rule.id };

      case PolicyAction.DENY: {
        const violation = await this.createViolation(rule.id, event, 'medium', `Denied by rule: ${rule.name}`);
        return { allowed: false, action: rule.action, ruleId: rule.id, violation };
      }

      case PolicyAction.REQUIRE_CONSENT: {
        const consentType = await this.checkConsentRequired(event);
        if (consentType && this.consentManager.hasValidConsent(consentType)) {
          return { allowed: true, action: PolicyAction.ALLOW, ruleId: rule.id };
        }
        return {
          allowed: false,
          action: rule.action,
          ruleId: rule.id,
          requiresConsent: consentType || ConsentType.CLOUD_PROCESSING
        };
      }

      case PolicyAction.LOG_ONLY:
        await this.auditLogger.logEvent(
          event._type,
          'policy_log_only',
          'policy',
          true,
          { ruleId: rule.id, ruleName: rule.name }
        );
        return { allowed: true, action: rule.action, ruleId: rule.id };

      case PolicyAction.QUARANTINE:
        // Quarantine the event (store for later review)
        await this.quarantineEvent(event, rule);
        return { allowed: false, action: rule.action, ruleId: rule.id };

      case PolicyAction.ANONYMIZE: {
        const anonymizedEvent = this.anonymizeEvent(event);
        return {
          allowed: true,
          action: rule.action,
          ruleId: rule.id,
          modifications: { anonymized: true, originalEvent: event, anonymizedEvent }
        };
      }

      case PolicyAction.ENCRYPT_EXTRA:
        return { 
          allowed: true, 
          action: rule.action, 
          ruleId: rule.id, 
          modifications: { extraEncryption: true } 
        };

      default:
        return { allowed: false, action: PolicyAction.DENY, ruleId: rule.id };
    }
  }

  // Apply default policy when no rules match
  private applyDefaultPolicy(_event: BackgroundEvent): PolicyEnforcementResult {
    // Default to allow with logging
    return { allowed: true, action: PolicyAction.LOG_ONLY };
  }

  // Create a policy violation record
  private async createViolation(
    ruleId: string,
    event: BackgroundEvent,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string
  ): Promise<PolicyViolation> {
    const rule = this.rules.get(ruleId);
    const violation: PolicyViolation = {
      id: this.generateViolationId(),
      timestamp: Date.now(),
      ruleId,
      ruleName: rule?.name || 'Unknown Rule',
      event,
      severity,
      description,
      recommendedAction: this.getRecommendedAction(severity, ruleId),
      autoResolved: false,
    };

    // Add to violations list
    this.violations.push(violation);
    
    // Maintain violations limit
    if (this.violations.length > this.maxViolations) {
      this.violations = this.violations.slice(-this.maxViolations);
    }

    // Emit violation event
    this.eventBus.emit({
      _type: BackgroundEventType.PRIVACY_VIOLATION,
      payload: { violation },
      priority: severity === 'critical' ? 3 : 2,
    });

    // Log the violation
    await this.auditLogger.logEvent(
      'PRIVACY_VIOLATION',
      'policy_violation',
      'violation',
      false,
      {
        violationId: violation.id,
        ruleId,
        severity,
        description,
      }
    );

    return violation;
  }

  // Quarantine an event for later review
  private async quarantineEvent(event: BackgroundEvent, rule: PolicyRule): Promise<void> {
    const quarantineData = {
      id: this.generateQuarantineId(),
      timestamp: Date.now(),
      event,
      ruleId: rule.id,
      ruleName: rule.name,
      reason: 'Policy rule triggered quarantine',
    };

    // Store quarantined event
    await chrome.storage.local.set({
      [`quarantine_${quarantineData.id}`]: quarantineData,
    });

    console.log(`[PolicyEngine] Event quarantined: ${quarantineData.id}`);
  }

  // Anonymize sensitive data in an event
  private anonymizeEvent(event: BackgroundEvent): BackgroundEvent {
    const anonymizedEvent = JSON.parse(JSON.stringify(event));
    const content = JSON.stringify(anonymizedEvent.payload);

    // Anonymize common sensitive patterns
    const anonymizedContent = content
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '****-****-****-****') // Credit cards
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****') // SSN
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***') // Email
      .replace(/\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g, '***-***-****'); // Phone

    try {
      anonymizedEvent.payload = JSON.parse(anonymizedContent);
    } catch {
      // If parsing fails, mark as anonymized
      anonymizedEvent.payload = { ...anonymizedEvent.payload, _anonymized: true };
    }

    return anonymizedEvent;
  }

  // Utility methods
  private isCloudEvent(event: BackgroundEvent): boolean {
    const cloudEventTypes = [
      'CLOUD_SUMMARIZATION',
      'CLOUD_SYNC',
      'API_CALL',
      'EXTERNAL_REQUEST',
    ];
    
    return cloudEventTypes.some(type => event._type.includes(type)) ||
           Boolean(event.payload.provider && event.payload.provider !== 'local') ||
           Boolean(event.payload.external) ||
           Boolean(event.payload.cloud);
  }

  private extractContextSource(event: BackgroundEvent): ContextSource | null {
    if (event.payload.source) {
      return event.payload.source as ContextSource;
    }
    if (event.payload.context && (event.payload.context as { source?: ContextSource }).source) {
      return (event.payload.context as { source: ContextSource }).source;
    }
    return null;
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

  private isDomainBlocked(domain: string): boolean {
    return this.policy.blockedDomains.some(blocked => 
      domain.includes(blocked) || blocked.includes(domain)
    );
  }

  private containsSensitiveData(event: BackgroundEvent): boolean {
    const sensitivePatterns = [
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/, // Phone
      /\b(?:password|pwd|pass|secret|key|token)\s*[:=]\s*\S+/i, // Passwords/secrets
    ];

    const content = JSON.stringify(event.payload);
    return sensitivePatterns.some(pattern => pattern.test(content));
  }

  private getRecommendedAction(severity: string, _ruleId: string): string {
    switch (severity) {
      case 'critical':
        return 'Immediate review required. Consider blocking the operation source.';
      case 'high':
        return 'Review within 24 hours. May require policy adjustment.';
      case 'medium':
        return 'Review within 1 week. Monitor for patterns.';
      case 'low':
        return 'Review during next policy audit cycle.';
      default:
        return 'Review as needed.';
    }
  }

  private generateViolationId(): string {
    return `violation_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateQuarantineId(): string {
    return `quarantine_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}