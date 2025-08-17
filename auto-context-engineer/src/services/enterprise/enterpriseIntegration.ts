// Enterprise Integration Service - Orchestrates all enterprise features
import { ExtensionError, ErrorCode, Context } from '../../types';
import { PolicyEngine, EnterpriseConfig, PolicyViolation } from './policyEngine';
import { ComplianceReporter, ComplianceReport, AuditEvent } from './complianceReporter';
import { SecurityControls, ThreatAssessment } from './securityControls';

export interface EnterpriseStatus {
    initialized: boolean;
    config: EnterpriseConfig | null;
    services: {
        policyEngine: boolean;
        complianceReporter: boolean;
        securityControls: boolean;
    };
    metrics: {
        lastUpdated: Date;
        policyViolations: number;
        securityEvents: number;
        complianceScore: number;
        threatLevel: 'low' | 'medium' | 'high' | 'critical';
    };
}

export interface EnterpriseAlert {
    id: string;
    timestamp: Date;
    type: 'policy_violation' | 'security_threat' | 'compliance_issue' | 'system_error';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    source: string;
    data: Record<string, unknown>;
    acknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: Date;
    resolved: boolean;
    resolvedBy?: string;
    resolvedAt?: Date;
}

export interface EnterpriseSettings {
    organizationId: string;
    organizationName: string;
    adminContact: string;
    enablePolicyEngine: boolean;
    enableComplianceReporting: boolean;
    enableSecurityControls: boolean;
    enableThreatDetection: boolean;
    auditLevel: 'basic' | 'standard' | 'comprehensive';
    reportingFrequency: 'daily' | 'weekly' | 'monthly';
    alertThresholds: {
        policyViolations: number;
        securityEvents: number;
        threatLevel: 'medium' | 'high' | 'critical';
    };
    dataRetention: {
        auditEvents: number; // days
        securityEvents: number; // days
        complianceReports: number; // days
    };
}

export class EnterpriseIntegration {
    private policyEngine: PolicyEngine;
    private complianceReporter: ComplianceReporter;
    private securityControls: SecurityControls;
    private config: EnterpriseConfig | null = null;
    private settings: EnterpriseSettings | null = null;
    private alerts: EnterpriseAlert[] = [];
    private isInitialized = false;

    constructor() {
        this.policyEngine = new PolicyEngine();
        this.complianceReporter = new ComplianceReporter();
        this.securityControls = new SecurityControls();
    }

    async initialize(settings: EnterpriseSettings): Promise<void> {
        try {
            this.settings = settings;
            
            // Load enterprise configuration
            this.config = this.loadEnterpriseConfig(settings);
            
            // Initialize services based on settings
            if (settings.enablePolicyEngine) {
                await this.policyEngine.initialize(this.config);
            }
            
            if (settings.enableComplianceReporting) {
                await this.complianceReporter.initialize(this.config);
            }
            
            if (settings.enableSecurityControls) {
                await this.securityControls.initialize(this.config);
            }
            
            // Set up monitoring and alerting
            await this.initializeMonitoring();
            
            this.isInitialized = true;
            
            // Log initialization
            await this.logAuditEvent({
                type: 'security_event',
                category: 'admin',
                severity: 'info',
                source: 'enterprise_integration',
                action: 'initialize',
                details: {
                    metadata: {
                        organizationId: settings.organizationId,
                        enabledServices: {
                            policyEngine: settings.enablePolicyEngine,
                            complianceReporting: settings.enableComplianceReporting,
                            securityControls: settings.enableSecurityControls
                        }
                    }
                },
                complianceFlags: ['GDPR', 'CCPA'],
                retention: {
                    required: true,
                    period: 2555, // 7 years
                    reason: 'System initialization audit trail'
                }
            });
            
            console.log('Enterprise integration initialized for organization:', settings.organizationName);
        } catch (error) {
            console.error('Failed to initialize enterprise integration:', error);
            throw new ExtensionError('Failed to initialize enterprise integration', ErrorCode.PROCESSING_ERROR, { error });
        }
    }

    async enforcePolicy(context: Context): Promise<{ allowed: boolean; violations: PolicyViolation[] }> {
        if (!this.isInitialized || !this.settings?.enablePolicyEngine) {
            return { allowed: true, violations: [] };
        }

        try {
            // Convert context to a safe object format for policy evaluation
            const contextData = {
                id: context.id,
                source: context.source,
                timestamp: context.timestamp,
                content: context.content,
                metadata: context.metadata,
                hasSummary: !!context.summary
            };
            
            const violations = await this.policyEngine.evaluatePolicy(contextData);
            
            // Check for blocking violations
            const blockingViolations = violations.filter(v => 
                v.action.type === 'block' && (v.severity === 'high' || v.severity === 'critical')
            );
            
            // Generate alerts for critical violations
            for (const violation of violations) {
                if (violation.severity === 'critical') {
                    await this.generateAlert({
                        type: 'policy_violation',
                        severity: violation.severity,
                        title: `Critical Policy Violation: ${violation.ruleName}`,
                        description: `Policy rule "${violation.ruleName}" was violated`,
                        source: 'policy_engine',
                        data: {
                            id: violation.id,
                            ruleId: violation.ruleId,
                            ruleName: violation.ruleName,
                            severity: violation.severity,
                            timestamp: violation.timestamp,
                            context: violation.context,
                            action: violation.action,
                            resolved: violation.resolved
                        }
                    });
                }
            }
            
            return {
                allowed: blockingViolations.length === 0,
                violations
            };
        } catch (error) {
            console.error('Error enforcing policy:', error);
            return { allowed: true, violations: [] };
        }
    }

    async validateConfiguration(setting: string, value: unknown): Promise<{ valid: boolean; reason?: string }> {
        if (!this.isInitialized || !this.settings?.enablePolicyEngine) {
            return { valid: true };
        }

        try {
            const allowed = await this.policyEngine.enforceConfigurationRestrictions(setting, value);
            
            if (!allowed) {
                await this.logAuditEvent({
                    type: 'policy_change',
                    category: 'admin',
                    severity: 'warning',
                    source: 'enterprise_integration',
                    action: 'block_configuration_change',
                    target: setting,
                    details: {
                        metadata: {
                            setting,
                            attemptedValue: value,
                            reason: 'Blocked by enterprise policy'
                        }
                    },
                    complianceFlags: ['GDPR'],
                    retention: {
                        required: true,
                        period: 365,
                        reason: 'Policy enforcement audit trail'
                    }
                });
                
                return { valid: false, reason: 'Configuration change blocked by enterprise policy' };
            }
            
            return { valid: true };
        } catch (error) {
            console.error('Error validating configuration:', error);
            return { valid: true };
        }
    }

    async authenticateUser(credentials: { username?: string; password?: string; token?: string }): Promise<{ success: boolean; sessionId?: string; errors?: string[] }> {
        if (!this.isInitialized || !this.settings?.enableSecurityControls) {
            return { success: true, sessionId: 'default_session' };
        }

        try {
            const result = await this.securityControls.authenticateUser(credentials);
            
            await this.logAuditEvent({
                type: 'user_consent',
                category: 'user',
                severity: result.success ? 'info' : 'warning',
                user: credentials.username,
                source: 'enterprise_integration',
                action: 'authenticate',
                details: {
                    metadata: {
                        success: result.success,
                        sessionId: result.sessionId,
                        errors: result.errors
                    }
                },
                complianceFlags: ['GDPR', 'CCPA'],
                retention: {
                    required: true,
                    period: 365,
                    reason: 'Authentication audit trail'
                }
            });
            
            return result;
        } catch (error) {
            console.error('Error authenticating user:', error);
            return { success: false, errors: ['Authentication failed'] };
        }
    }

    async authorizeAction(sessionId: string, resource: string, action: string): Promise<{ authorized: boolean; reason?: string }> {
        if (!this.isInitialized || !this.settings?.enableSecurityControls) {
            return { authorized: true };
        }

        try {
            const result = await this.securityControls.authorizeAction(sessionId, resource, action);
            
            if (!result.authorized) {
                await this.logAuditEvent({
                    type: 'data_access',
                    category: 'system',
                    severity: 'warning',
                    source: 'enterprise_integration',
                    action: 'block_unauthorized_access',
                    target: resource,
                    details: {
                        sessionId,
                        metadata: {
                            resource,
                            action,
                            reason: result.reason
                        }
                    },
                    complianceFlags: ['GDPR'],
                    retention: {
                        required: true,
                        period: 365,
                        reason: 'Access control audit trail'
                    }
                });
            }
            
            return result;
        } catch (error) {
            console.error('Error authorizing action:', error);
            return { authorized: true };
        }
    }

    async detectThreats(context: Context): Promise<ThreatAssessment[]> {
        if (!this.isInitialized || !this.settings?.enableThreatDetection) {
            return [];
        }

        try {
            const threats = await this.securityControls.detectThreats(context);
            
            // Generate alerts for high-severity threats
            for (const threat of threats) {
                if (threat.threatLevel === 'high' || threat.threatLevel === 'critical') {
                    await this.generateAlert({
                        type: 'security_threat',
                        severity: threat.threatLevel,
                        title: `Security Threat Detected: ${threat.category}`,
                        description: threat.description,
                        source: 'security_controls',
                        data: {
                            id: threat.id,
                            threatLevel: threat.threatLevel,
                            category: threat.category,
                            description: threat.description,
                            timestamp: threat.timestamp,
                            indicators: threat.indicators,
                            impact: threat.impact,
                            status: threat.status
                        }
                    });
                }
            }
            
            return threats;
        } catch (error) {
            console.error('Error detecting threats:', error);
            return [];
        }
    }

    async generateComplianceReport(framework: string, reportType: ComplianceReport['reportType'], period: { start: Date; end: Date }): Promise<ComplianceReport> {
        if (!this.isInitialized || !this.settings?.enableComplianceReporting) {
            throw new ExtensionError('Compliance reporting not enabled', ErrorCode.PERMISSION_ERROR);
        }

        try {
            const report = await this.complianceReporter.generateComplianceReport(
                framework,
                reportType,
                period,
                this.settings.adminContact
            );
            
            await this.logAuditEvent({
                type: 'data_modification',
                category: 'admin',
                severity: 'info',
                source: 'enterprise_integration',
                action: 'generate_compliance_report',
                details: {
                    metadata: {
                        reportId: report.id,
                        framework,
                        reportType,
                        period,
                        complianceScore: report.summary.complianceScore
                    }
                },
                complianceFlags: [framework],
                retention: {
                    required: true,
                    period: 2555, // 7 years
                    reason: 'Compliance reporting audit trail'
                }
            });
            
            return report;
        } catch (error) {
            console.error('Error generating compliance report:', error);
            throw new ExtensionError('Failed to generate compliance report', ErrorCode.PROCESSING_ERROR, { error });
        }
    }

    async exportComplianceData(format: 'json' | 'csv' | 'xml', filters?: Record<string, unknown>): Promise<string> {
        if (!this.isInitialized || !this.settings?.enableComplianceReporting) {
            throw new ExtensionError('Compliance reporting not enabled', ErrorCode.PERMISSION_ERROR);
        }

        try {
            // Get audit events based on filters
            const events = await this.complianceReporter.getAuditEvents(filters);
            
            let exportData: string;
            switch (format) {
                case 'json':
                    exportData = JSON.stringify(events, null, 2);
                    break;
                case 'csv':
                    exportData = this.convertEventsToCSV(events);
                    break;
                case 'xml':
                    exportData = this.convertEventsToXML(events);
                    break;
                default:
                    throw new ExtensionError('Unsupported export format', ErrorCode.INVALID_INPUT, { format });
            }
            
            await this.logAuditEvent({
                type: 'external_transfer',
                category: 'admin',
                severity: 'info',
                source: 'enterprise_integration',
                action: 'export_compliance_data',
                details: {
                    metadata: {
                        format,
                        eventCount: events.length,
                        filters
                    }
                },
                complianceFlags: ['GDPR', 'CCPA'],
                retention: {
                    required: true,
                    period: 365,
                    reason: 'Data export audit trail'
                }
            });
            
            return exportData;
        } catch (error) {
            console.error('Error exporting compliance data:', error);
            throw new ExtensionError('Failed to export compliance data', ErrorCode.PROCESSING_ERROR, { error });
        }
    }

    async getEnterpriseStatus(): Promise<EnterpriseStatus> {
        const policyViolations = this.settings?.enablePolicyEngine ? 
            (await this.policyEngine.getViolations({ resolved: false })).length : 0;
        
        const securityEvents = this.settings?.enableSecurityControls ? 
            (await this.securityControls.getSecurityEvents({ resolved: false })).length : 0;
        
        // Calculate overall threat level
        let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (policyViolations > 10 || securityEvents > 20) threatLevel = 'medium';
        if (policyViolations > 25 || securityEvents > 50) threatLevel = 'high';
        if (policyViolations > 50 || securityEvents > 100) threatLevel = 'critical';

        return {
            initialized: this.isInitialized,
            config: this.config,
            services: {
                policyEngine: this.settings?.enablePolicyEngine || false,
                complianceReporter: this.settings?.enableComplianceReporting || false,
                securityControls: this.settings?.enableSecurityControls || false
            },
            metrics: {
                lastUpdated: new Date(),
                policyViolations,
                securityEvents,
                complianceScore: 85, // Would be calculated from actual compliance data
                threatLevel
            }
        };
    }

    getAlerts(filters?: {
        type?: string;
        severity?: string;
        acknowledged?: boolean;
        resolved?: boolean;
        since?: Date;
    }): EnterpriseAlert[] {
        let filteredAlerts = [...this.alerts];

        if (filters) {
            if (filters.type) {
                filteredAlerts = filteredAlerts.filter(a => a.type === filters.type);
            }
            if (filters.severity) {
                filteredAlerts = filteredAlerts.filter(a => a.severity === filters.severity);
            }
            if (filters.acknowledged !== undefined) {
                filteredAlerts = filteredAlerts.filter(a => a.acknowledged === filters.acknowledged);
            }
            if (filters.resolved !== undefined) {
                filteredAlerts = filteredAlerts.filter(a => a.resolved === filters.resolved);
            }
            if (filters.since) {
                filteredAlerts = filteredAlerts.filter(a => a.timestamp >= filters.since!);
            }
        }

        return filteredAlerts;
    }

    async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedBy = acknowledgedBy;
            alert.acknowledgedAt = new Date();
            
            await this.logAuditEvent({
                type: 'security_event',
                category: 'admin',
                severity: 'info',
                source: 'enterprise_integration',
                action: 'acknowledge_alert',
                details: {
                    metadata: {
                        alertId,
                        acknowledgedBy,
                        alertType: alert.type,
                        alertSeverity: alert.severity
                    }
                },
                complianceFlags: ['GDPR'],
                retention: {
                    required: true,
                    period: 365,
                    reason: 'Alert management audit trail'
                }
            });
        }
    }

    async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.resolved = true;
            alert.resolvedBy = resolvedBy;
            alert.resolvedAt = new Date();
            
            await this.logAuditEvent({
                type: 'security_event',
                category: 'admin',
                severity: 'info',
                source: 'enterprise_integration',
                action: 'resolve_alert',
                details: {
                    metadata: {
                        alertId,
                        resolvedBy,
                        alertType: alert.type,
                        alertSeverity: alert.severity
                    }
                },
                complianceFlags: ['GDPR'],
                retention: {
                    required: true,
                    period: 365,
                    reason: 'Alert management audit trail'
                }
            });
        }
    }

    private loadEnterpriseConfig(settings: EnterpriseSettings): EnterpriseConfig {
        return {
            organizationId: settings.organizationId,
            organizationName: settings.organizationName,
            adminContact: settings.adminContact,
            policies: {
                enforceLocalOnly: true,
                requireEncryption: true,
                blockCloudFeatures: false,
                requireAuditLogging: true,
                maxStorageSize: 100 * 1024 * 1024,
                allowedDomains: [],
                blockedDomains: [],
                dataRetentionDays: settings.dataRetention.auditEvents,
                requireUserConsent: true
            },
            compliance: {
                frameworks: ['GDPR', 'CCPA'],
                auditLevel: settings.auditLevel,
                reportingFrequency: settings.reportingFrequency,
                exportFormats: ['json', 'csv', 'xml']
            },
            security: {
                encryptionRequired: true,
                keyRotationDays: 90,
                sessionTimeout: 3600,
                maxFailedAttempts: 3,
                requireStrongPasswords: true
            }
        };
    }

    private initializeMonitoring(): void {
        // Set up periodic monitoring tasks
        console.log('Enterprise monitoring initialized');
    }

    private async logAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
        if (this.settings?.enableComplianceReporting) {
            await this.complianceReporter.logAuditEvent(event);
        }
    }

    private generateAlert(alert: Omit<EnterpriseAlert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>): void {
        const enterpriseAlert: EnterpriseAlert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            acknowledged: false,
            resolved: false,
            ...alert
        };

        this.alerts.push(enterpriseAlert);
        
        console.log('Enterprise alert generated:', enterpriseAlert.type, enterpriseAlert.title);
    }

    private convertEventsToCSV(events: AuditEvent[]): string {
        const headers = ['ID', 'Timestamp', 'Type', 'Category', 'Severity', 'User', 'Source', 'Action', 'Target'];
        const lines = [headers.join(',')];
        
        for (const event of events) {
            const row = [
                event.id,
                event.timestamp.toISOString(),
                event.type,
                event.category,
                event.severity,
                event.user || '',
                event.source,
                event.action,
                event.target || ''
            ];
            lines.push(row.join(','));
        }
        
        return lines.join('\n');
    }

    private convertEventsToXML(events: AuditEvent[]): string {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<AuditEvents>\n';
        
        for (const event of events) {
            xml += `  <Event>\n`;
            xml += `    <id>${event.id}</id>\n`;
            xml += `    <timestamp>${event.timestamp.toISOString()}</timestamp>\n`;
            xml += `    <type>${event.type}</type>\n`;
            xml += `    <category>${event.category}</category>\n`;
            xml += `    <severity>${event.severity}</severity>\n`;
            xml += `    <source>${event.source}</source>\n`;
            xml += `    <action>${event.action}</action>\n`;
            if (event.user) xml += `    <user>${event.user}</user>\n`;
            if (event.target) xml += `    <target>${event.target}</target>\n`;
            xml += `  </Event>\n`;
        }
        
        xml += '</AuditEvents>';
        return xml;
    }
}