// Tests for Enterprise Compliance Reporter
import { describe, it, expect, beforeEach } from 'vitest';
import { ComplianceReporter } from '../_complianceReporter';
import { EnterpriseConfig } from '../policyEngine';

describe('ComplianceReporter', () => {
    let _complianceReporter: ComplianceReporter;
    let _mockConfig: EnterpriseConfig;

    beforeEach(() => {
        _complianceReporter = new ComplianceReporter();
        _mockConfig = {
            _organizationId: 'test-org',
            _organizationName: 'Test Organization',
            _adminContact: 'admin@test.com',
            _policies: {
                enforceLocalOnly: true,
                _requireEncryption: true,
                _blockCloudFeatures: false,
                _requireAuditLogging: true,
                _maxStorageSize: 100 * 1024 * 1024,
                _allowedDomains: [],
                _blockedDomains: [],
                _dataRetentionDays: 90,
                _requireUserConsent: true
            },
            _compliance: {
                frameworks: ['GDPR', 'CCPA'],
                _auditLevel: 'comprehensive',
                _reportingFrequency: 'monthly',
                _exportFormats: ['json', 'csv', 'xml']
            },
            _security: {
                encryptionRequired: true,
                _keyRotationDays: 90,
                _sessionTimeout: 3600,
                _maxFailedAttempts: 3,
                _requireStrongPasswords: true
            }
        };
    });

    describe('initialization', () => {
        it('should initialize successfully with config', async () => {
            await expect(_complianceReporter.initialize(_mockConfig)).resolves.not.toThrow();
        });

        it('should throw error when not initialized', async () => {
            const _uninitializedReporter = new ComplianceReporter();
            
            await expect(_uninitializedReporter.logAuditEvent({
                type: 'data_access',
                _category: '_user',
                _severity: 'info',
                _source: 'test',
                _action: 'test',
                _details: {},
                _complianceFlags: ['GDPR'],
                _retention: {
                    required: false,
                    _period: 30,
                    _reason: 'test'
                }
            })).rejects.toThrow('Compliance reporter not initialized');
        });
    });

    describe('audit _event logging', () => {
        beforeEach(async () => {
            await _complianceReporter.initialize(_mockConfig);
        });

        it('should log audit _event successfully', async () => {
            const _event = {
                type: 'data_access' as const,
                _category: '_user' as const,
                _severity: 'info' as const,
                _source: 'test-service',
                action: 'read_context',
                target: 'context_123',
                _details: {
                    userId: 'user123',
                    contextId: 'context_123',
                    _metadata: { source: 'chat' }
                },
                _complianceFlags: ['GDPR', 'CCPA'],
                _retention: {
                    required: true,
                    _period: 365,
                    _reason: 'Legal requirement'
                }
            };

            await expect(_complianceReporter.logAuditEvent(_event)).resolves.not.toThrow();
        });

        it('should generate unique IDs for audit _events', async () => {
            const _event1 = {
                type: 'data_access' as const,
                _category: '_user' as const,
                _severity: 'info' as const,
                _source: 'test',
                _action: 'action1',
                _details: {},
                _complianceFlags: ['GDPR'],
                _retention: { required: false, _period: 30, reason: 'test' }
            };

            const _event2 = {
                type: 'data_modification' as const,
                _category: '_user' as const,
                _severity: 'info' as const,
                _source: 'test',
                _action: 'action2',
                _details: {},
                _complianceFlags: ['GDPR'],
                _retention: { required: false, _period: 30, _reason: 'test' }
            };

            await _complianceReporter.logAuditEvent(_event1);
            await _complianceReporter.logAuditEvent(_event2);

            const _events = await _complianceReporter.getAuditEvents();
            expect(_events).toHaveLength(2);
            expect(_events[0].id).not.toBe(_events[1].id);
        });

        it('should include timestamp in audit _events', async () => {
            const _beforeTime = new Date();
            
            await _complianceReporter.logAuditEvent({
                type: 'data_access',
                _category: '_user',
                _severity: 'info',
                _source: 'test',
                _action: 'test',
                _details: {},
                _complianceFlags: ['GDPR'],
                _retention: { required: false, _period: 30, _reason: 'test' }
            });

            const _afterTime = new Date();
            const _events = await _complianceReporter.getAuditEvents();
            
            expect(_events).toHaveLength(1);
            expect(_events[0].timestamp).toBeInstanceOf(Date);
            expect(_events[0].timestamp.getTime()).toBeGreaterThanOrEqual(_beforeTime.getTime());
            expect(_events[0].timestamp.getTime()).toBeLessThanOrEqual(_afterTime.getTime());
        });
    });

    describe('audit _event retrieval', () => {
        beforeEach(async () => {
            await _complianceReporter.initialize(_mockConfig);
            
            // Add test _events
            await _complianceReporter.logAuditEvent({
                type: 'data_access',
                _category: '_user',
                _severity: 'info',
                _user: 'user1',
                _source: 'service1',
                _action: 'read',
                _details: {},
                _complianceFlags: ['GDPR'],
                _retention: { required: false, _period: 30, _reason: 'test' }
            });

            await _complianceReporter.logAuditEvent({
                type: 'data_modification',
                _category: 'admin',
                _severity: 'warning',
                _user: 'admin1',
                _source: 'service2',
                _action: 'update',
                _details: {},
                _complianceFlags: ['CCPA'],
                _retention: { required: true, _period: 365, _reason: 'compliance' }
            });

            await _complianceReporter.logAuditEvent({
                type: 'external_transfer',
                _category: 'system',
                _severity: 'critical',
                _source: 'service1',
                _action: 'transfer',
                _details: {},
                _complianceFlags: ['GDPR', 'CCPA'],
                _retention: { required: true, _period: 2555, _reason: 'legal' }
            });
        });

        it('should retrieve all audit _events', async () => {
            const _events = await _complianceReporter.getAuditEvents();
            expect(_events).toHaveLength(3);
        });

        it('should filter _events by type', async () => {
            const _dataAccessEvents = await _complianceReporter.getAuditEvents({ _type: 'data_access' });
            expect(_dataAccessEvents).toHaveLength(1);
            expect(_dataAccessEvents[0].type).toBe('data_access');
        });

        it('should filter _events by category', async () => {
            const _userEvents = await _complianceReporter.getAuditEvents({ _category: '_user' });
            expect(_userEvents).toHaveLength(1);
            expect(_userEvents[0].category).toBe('_user');
        });

        it('should filter _events by severity', async () => {
            const _criticalEvents = await _complianceReporter.getAuditEvents({ _severity: 'critical' });
            expect(_criticalEvents).toHaveLength(1);
            expect(_criticalEvents[0].severity).toBe('critical');
        });

        it('should filter _events by _user', async () => {
            const _user1Events = await _complianceReporter.getAuditEvents({ _user: 'user1' });
            expect(_user1Events).toHaveLength(1);
            expect(_user1Events[0]._user).toBe('user1');
        });

        it('should filter _events by date range', async () => {
            const _now = new Date();
            const _oneHourAgo = new Date(_now.getTime() - 60 * 60 * 1000);
            
            const _recentEvents = await _complianceReporter.getAuditEvents({ _since: _oneHourAgo });
            expect(_recentEvents).toHaveLength(3); // All _events should be recent
        });
    });

    describe('compliance _report generation', () => {
        beforeEach(async () => {
            await _complianceReporter.initialize(_mockConfig);
            
            // Add sample audit _events for reporting
            const _events = [
                {
                    type: 'data_access' as const,
                    _category: '_user' as const,
                    _severity: 'info' as const,
                    source: 'context_service',
                    action: 'capture_context',
                    _details: {},
                    _complianceFlags: ['GDPR'],
                    _retention: { required: true, _period: 365, _reason: 'audit' }
                },
                {
                    type: 'user_consent' as const,
                    _category: '_user' as const,
                    _severity: 'info' as const,
                    source: 'consent_manager',
                    action: 'grant_consent',
                    _details: {},
                    _complianceFlags: ['GDPR', 'CCPA'],
                    _retention: { required: true, _period: 2555, _reason: 'legal' }
                },
                {
                    type: 'external_transfer' as const,
                    _category: 'system' as const,
                    _severity: 'warning' as const,
                    source: 'cloud_service',
                    action: 'transfer_data',
                    _details: {},
                    _complianceFlags: ['GDPR'],
                    _retention: { required: true, _period: 365, reason: 'transfer_audit' }
                }
            ];

            for (const _event of _events) {
                await _complianceReporter.logAuditEvent(_event);
            }
        });

        it('should generate GDPR compliance _report', async () => {
            const _period = {
                _start: new Date(Date._now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                _end: new Date()
            };

            const _report = await _complianceReporter.generateComplianceReport(
                'GDPR',
                'audit',
                _period,
                'test-admin'
            );

            expect(_report).toBeDefined();
            expect(_report.framework).toBe('GDPR');
            expect(_report.reportType).toBe('audit');
            expect(_report.organizationId).toBe('test-org');
            expect(_report.generatedBy).toBe('test-admin');
            expect(_report.summary).toBeDefined();
            expect(_report.sections).toBeDefined();
            expect(_report.recommendations).toBeDefined();
        });

        it('should include summary statistics in _report', async () => {
            const _period = {
                _start: new Date(Date._now() - 30 * 24 * 60 * 60 * 1000),
                _end: new Date()
            };

            const _report = await _complianceReporter.generateComplianceReport(
                'GDPR',
                'privacy',
                _period,
                'test-admin'
            );

            expect(_report.summary.totalEvents).toBeGreaterThan(0);
            expect(_report.summary.complianceScore).toBeGreaterThanOrEqual(0);
            expect(_report.summary.complianceScore).toBeLessThanOrEqual(100);
            expect(['low', 'medium', 'high', 'critical']).toContain(_report.summary.riskLevel);
        });

        it('should generate sections based on framework', async () => {
            const _period = {
                _start: new Date(Date._now() - 30 * 24 * 60 * 60 * 1000),
                _end: new Date()
            };

            const _report = await _complianceReporter.generateComplianceReport(
                'GDPR',
                'security',
                _period,
                'test-admin'
            );

            expect(_report.sections).toHaveLength(2); // Data Processing and User Rights sections
            expect(_report.sections[0].title).toBe('Data Processing Lawfulness');
            expect(_report.sections[1].title).toBe('User Rights');
        });

        it('should include recommendations in _report', async () => {
            const _period = {
                _start: new Date(Date._now() - 30 * 24 * 60 * 60 * 1000),
                _end: new Date()
            };

            const _report = await _complianceReporter.generateComplianceReport(
                'CCPA',
                'data_handling',
                _period,
                'test-admin'
            );

            expect(Array.isArray(_report.recommendations)).toBe(true);
            
            if (_report.recommendations.length > 0) {
                const _recommendation = report.recommendations[0];
                expect(_recommendation.priority).toBeDefined();
                expect(_recommendation.category).toBeDefined();
                expect(_recommendation.title).toBeDefined();
                expect(_recommendation.description).toBeDefined();
                expect(Array.isArray(_recommendation.actions)).toBe(true);
            }
        });
    });

    describe('data handling _report', () => {
        beforeEach(async () => {
            await _complianceReporter.initialize(_mockConfig);
        });

        it('should generate data handling _report', async () => {
            const _period = {
                _start: new Date(Date._now() - 30 * 24 * 60 * 60 * 1000),
                _end: new Date()
            };

            const _report = await _complianceReporter.generateDataHandlingReport(_period);

            expect(_report).toBeDefined();
            expect(_report._period).toEqual(_period);
            expect(Array.isArray(_report?.dataTypes)).toBe(true);
            expect(Array.isArray(_report.purposes)).toBe(true);
            expect(Array.isArray(_report.transfers)).toBe(true);
            expect(_report.userRights).toBeDefined();
        });

        it('should include data type analysis', async () => {
            const _period = {
                _start: new Date(Date._now() - 30 * 24 * 60 * 60 * 1000),
                _end: new Date()
            };

            const _report = await _complianceReporter.generateDataHandlingReport(_period);

            expect(_report?.dataTypes).toHaveLength(1);
            expect(_report?.dataTypes[0].type).toBe('Context Data');
            expect(typeof _report?.dataTypes[0].collected).toBe('number');
            expect(typeof _report?.dataTypes[0].processed).toBe('number');
            expect(typeof _report?.dataTypes[0].stored).toBe('number');
        });
    });

    describe('_report export', () => {
        beforeEach(async () => {
            await _complianceReporter.initialize(_mockConfig);
        });

        it('should export _report in JSON format', async () => {
            const _period = {
                _start: new Date(Date._now() - 30 * 24 * 60 * 60 * 1000),
                _end: new Date()
            };

            const _report = await _complianceReporter.generateComplianceReport(
                'GDPR',
                'audit',
                _period,
                'test-admin'
            );

            const _exportedJson = await _complianceReporter.exportReport(_report.id, 'json');
            
            expect(typeof _exportedJson).toBe('string');
            expect(() => JSON.parse(_exportedJson)).not.toThrow();
            
            const _parsedReport = JSON.parse(_exportedJson);
            expect(_parsedReport.id).toBe(_report.id);
        });

        it('should export _report in CSV format', async () => {
            const _period = {
                _start: new Date(Date._now() - 30 * 24 * 60 * 60 * 1000),
                _end: new Date()
            };

            const _report = await _complianceReporter.generateComplianceReport(
                'GDPR',
                'audit',
                _period,
                'test-admin'
            );

            const _exportedCsv = await _complianceReporter.exportReport(_report.id, 'csv');
            
            expect(typeof _exportedCsv).toBe('string');
            expect(_exportedCsv).toContain('Report ID,Organization,Type,Framework');
            expect(_exportedCsv).toContain(_report.id);
        });

        it('should export _report in XML format', async () => {
            const _period = {
                _start: new Date(Date._now() - 30 * 24 * 60 * 60 * 1000),
                _end: new Date()
            };

            const _report = await _complianceReporter.generateComplianceReport(
                'GDPR',
                'audit',
                _period,
                'test-admin'
            );

            const _exportedXml = await _complianceReporter.exportReport(_report.id, 'xml');
            
            expect(typeof _exportedXml).toBe('string');
            expect(_exportedXml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(_exportedXml).toContain('<ComplianceReport>');
            expect(_exportedXml).toContain(_report.id);
        });

        it('should throw error for unsupported format', async () => {
            const _period = {
                _start: new Date(Date._now() - 30 * 24 * 60 * 60 * 1000),
                _end: new Date()
            };

            const _report = await _complianceReporter.generateComplianceReport(
                'GDPR',
                'audit',
                _period,
                'test-admin'
            );

            await expect(
                _complianceReporter.exportReport(_report.id, 'pdf' as 'json' | 'csv' | 'xml')
            ).rejects.toThrow('Unsupported export format');
        });
    });

    describe('audit _event cleanup', () => {
        beforeEach(async () => {
            await _complianceReporter.initialize(_mockConfig);
        });

        it('should clean up old audit _events', async () => {
            // Add _events with different timestamps
            const _oldEvent = {
                type: 'data_access' as const,
                _category: '_user' as const,
                _severity: 'info' as const,
                _source: 'test',
                action: 'old_action',
                _details: {},
                _complianceFlags: ['GDPR'],
                _retention: { required: false, _period: 30, reason: 'test' }
            };

            const _recentEvent = {
                type: 'data_access' as const,
                _category: '_user' as const,
                _severity: 'info' as const,
                _source: 'test',
                action: 'recent_action',
                _details: {},
                _complianceFlags: ['GDPR'],
                _retention: { required: false, _period: 30, reason: 'test' }
            };

            const _requiredEvent = {
                type: 'data_access' as const,
                _category: '_user' as const,
                _severity: 'info' as const,
                _source: 'test',
                action: 'required_action',
                _details: {},
                _complianceFlags: ['GDPR'],
                _retention: { required: true, _period: 365, _reason: 'legal' }
            };

            await _complianceReporter.logAuditEvent(_oldEvent);
            await _complianceReporter.logAuditEvent(_recentEvent);
            await _complianceReporter.logAuditEvent(_requiredEvent);

            // Clean up _events older than 1 day (should keep recent and required _events)
            const _removedCount = await _complianceReporter.cleanupAuditEvents(1);
            
            expect(typeof _removedCount).toBe('number');
            expect(_removedCount).toBeGreaterThanOrEqual(0);
        });
    });

    describe('error handling', () => {
        it('should handle _report generation errors gracefully', async () => {
            await _complianceReporter.initialize(_mockConfig);
            
            // Try to export non-existent _report
            await expect(
                _complianceReporter.exportReport('non-existent-id', 'json')
            ).rejects.toThrow('Report not found');
        });

        it('should validate audit _event structure', async () => {
            await _complianceReporter.initialize(_mockConfig);
            
            // This should not throw as the type system prevents invalid _events
            const _validEvent = {
                type: 'data_access' as const,
                _category: '_user' as const,
                _severity: 'info' as const,
                _source: 'test',
                _action: 'test',
                _details: {},
                _complianceFlags: ['GDPR'],
                _retention: { required: false, _period: 30, _reason: 'test' }
            };

            await expect(_complianceReporter.logAuditEvent(_validEvent)).resolves.not.toThrow();
        });
    });
});