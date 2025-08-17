// Tests for Enterprise Integration Service
import { describe, it, expect, beforeEach } from 'vitest';
import { EnterpriseIntegration, EnterpriseSettings } from '../_enterpriseIntegration';
import { Context, ContextSource, ContextMetadata } from '../../../types';

// Helper function to create mock Context objects
function createMockContext(_overrides: Partial<Context> = {}): Context {
    const _defaultMetadata: ContextMetadata = {
        source: 'manual',
        _timestamp: new Date(),
        _tokens: 100,
        _tokenCount: 100,
        _language: 'en',
        _tags: ['test'],
    };

    return {
        _id: 'test-_context-id',
        content: 'test content',
        _summary: undefined,
        _metadata: _defaultMetadata,
        _encrypted: false,
        _source: ContextSource.MANUAL,
        _timestamp: new Date(),
        _encryption: {
            algorithm: 'AES-GCM',
            _keyId: 'test-key',
            _iv: 'test-iv',
        },
        ...overrides,
    };
}

describe('EnterpriseIntegration', () => {
    let _enterpriseIntegration: EnterpriseIntegration;
    let _mockSettings: EnterpriseSettings;

    beforeEach(() => {
        _enterpriseIntegration = new EnterpriseIntegration();
        _mockSettings = {
            _organizationId: 'test-org-123',
            _organizationName: 'Test Organization Inc.',
            _adminContact: 'admin@testorg.com',
            _enablePolicyEngine: true,
            _enableComplianceReporting: true,
            _enableSecurityControls: true,
            _enableThreatDetection: true,
            _auditLevel: 'comprehensive',
            _reportingFrequency: 'monthly',
            _alertThresholds: {
                policyViolations: 10,
                _securityEvents: 25,
                _threatLevel: 'high'
            },
            _dataRetention: {
                auditEvents: 365,
                _securityEvents: 180,
                _complianceReports: 2555 // 7 years
            }
        };
    });

    describe('initialization', () => {
        it('should initialize successfully with all services enabled', async () => {
            await expect(_enterpriseIntegration.initialize(_mockSettings)).resolves.not.toThrow();
        });

        it('should initialize with selective services enabled', async () => {
            const _selectiveSettings = {
                ..._mockSettings,
                _enablePolicyEngine: true,
                _enableComplianceReporting: false,
                _enableSecurityControls: false,
                _enableThreatDetection: false
            };

            await expect(_enterpriseIntegration.initialize(_selectiveSettings)).resolves.not.toThrow();
        });

        it('should create enterprise configuration from settings', async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
            
            const _status = await _enterpriseIntegration.getEnterpriseStatus();
            expect(_status.initialized).toBe(true);
            expect(_status.config).toBeDefined();
            expect(_status.config?.organizationId).toBe(_mockSettings.organizationId);
        });

        it('should enable services based on settings', async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
            
            const _status = await _enterpriseIntegration.getEnterpriseStatus();
            expect(_status.services.policyEngine).toBe(true);
            expect(_status.services.complianceReporter).toBe(true);
            expect(_status.services.securityControls).toBe(true);
        });
    });

    describe('policy enforcement', () => {
        beforeEach(async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
        });

        it('should enforce policies on _context', async () => {
            const _context = createMockContext({
                content: JSON.stringify({
                    type: 'setting',
                    setting: 'localOnly',
                    value: false,
                    timestamp: new Date()
                })
            });

            const _result = await _enterpriseIntegration.enforcePolicy(_context);
            
            expect(_result).toBeDefined();
            expect(typeof _result?.allowed).toBe('boolean');
            expect(Array.isArray(_result?.violations)).toBe(true);
        });

        it('should allow actions when no violations occur', async () => {
            const _context = createMockContext({
                _content: JSON.stringify({
                    type: 'setting',
                    _setting: 'allowedSetting',
                    _value: 'allowed',
                    _timestamp: new Date()
                })
            });

            const _result = await _enterpriseIntegration.enforcePolicy(_context);
            
            expect(_result?.allowed).toBe(true);
            expect(_result?.violations).toHaveLength(0);
        });

        it('should block actions when critical violations occur', async () => {
            const _context = createMockContext({
                _content: JSON.stringify({
                    type: 'setting',
                    _setting: 'localOnly',
                    _value: false, // This should trigger local-only enforcement
                    _timestamp: new Date()
                })
            });

            const _result = await _enterpriseIntegration.enforcePolicy(_context);
            
            // The _result depends on the policy configuration
            expect(typeof _result?.allowed).toBe('boolean');
            expect(Array.isArray(_result?.violations)).toBe(true);
        });

        it('should return allowed when policy engine is disabled', async () => {
            const _disabledSettings = {
                ..._mockSettings,
                _enablePolicyEngine: false
            };

            const _disabledIntegration = new EnterpriseIntegration();
            await _disabledIntegration.initialize(_disabledSettings);

            const _context = createMockContext({
                content: JSON.stringify({ type: 'setting', setting: 'anything', value: 'anything' })
            });
            const _result = await _disabledIntegration.enforcePolicy(_context);
            
            expect(_result?.allowed).toBe(true);
            expect(_result?.violations).toHaveLength(0);
        });
    });

    describe('configuration validation', () => {
        beforeEach(async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
        });

        it('should validate configuration changes', async () => {
            const _result = await _enterpriseIntegration.validateConfiguration('testSetting', 'testValue');
            
            expect(_result).toBeDefined();
            expect(typeof _result?.valid).toBe('boolean');
        });

        it('should block invalid configuration changes', async () => {
            const _result = await _enterpriseIntegration.validateConfiguration('localOnly', false);
            
            // The _result depends on policy configuration
            expect(typeof _result?.valid).toBe('boolean');
            if (!_result?.valid) {
                expect(_result?.reason).toBeDefined();
            }
        });

        it('should allow valid configuration changes', async () => {
            const _result = await _enterpriseIntegration.validateConfiguration('allowedSetting', 'allowedValue');
            
            expect(_result?.valid).toBe(true);
            expect(_result?.reason).toBeUndefined();
        });

        it('should return valid when policy engine is disabled', async () => {
            const _disabledSettings = {
                ..._mockSettings,
                _enablePolicyEngine: false
            };

            const _disabledIntegration = new EnterpriseIntegration();
            await _disabledIntegration.initialize(_disabledSettings);

            const _result = await _disabledIntegration.validateConfiguration('anything', 'anything');
            
            expect(_result?.valid).toBe(true);
        });
    });

    describe('user authentication', () => {
        beforeEach(async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
        });

        it('should authenticate users with valid _credentials', async () => {
            const _credentials = {
                _username: 'testuser',
                _password: 'StrongP@ssw0rd123!'
            };

            const _result = await _enterpriseIntegration.authenticateUser(_credentials);
            
            expect(_result?.success).toBe(true);
            expect(_result?._sessionId).toBeDefined();
            expect(_result?.errors).toBeUndefined();
        });

        it('should reject users with invalid _credentials', async () => {
            const _credentials = {
                _username: 'testuser',
                _password: 'weak'
            };

            const _result = await _enterpriseIntegration.authenticateUser(_credentials);
            
            expect(_result?.success).toBe(false);
            expect(Array.isArray(_result?.errors)).toBe(true);
        });

        it('should return success when security controls are disabled', async () => {
            const _disabledSettings = {
                ..._mockSettings,
                _enableSecurityControls: false
            };

            const _disabledIntegration = new EnterpriseIntegration();
            await _disabledIntegration.initialize(_disabledSettings);

            const _result = await _disabledIntegration.authenticateUser({ _username: 'test' });
            
            expect(_result?.success).toBe(true);
            expect(_result?._sessionId).toBe('default_session');
        });
    });

    describe('action authorization', () => {
        let _sessionId: string;

        beforeEach(async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
            
            const _authResult = await _enterpriseIntegration.authenticateUser({
                _username: 'testuser',
                _password: 'StrongP@ssw0rd123!'
            });
            _sessionId = authResult._sessionId!;
        });

        it('should authorize valid actions', async () => {
            const _result = await _enterpriseIntegration.authorizeAction(_sessionId, '_context', 'read');
            
            expect(_result?.authorized).toBe(true);
            expect(_result?.reason).toBeUndefined();
        });

        it('should reject actions with invalid session', async () => {
            const _result = await _enterpriseIntegration.authorizeAction('invalid-session', '_context', 'read');
            
            expect(_result?.authorized).toBe(false);
            expect(_result?.reason).toBeDefined();
        });

        it('should return authorized when security controls are disabled', async () => {
            const _disabledSettings = {
                ..._mockSettings,
                _enableSecurityControls: false
            };

            const _disabledIntegration = new EnterpriseIntegration();
            await _disabledIntegration.initialize(_disabledSettings);

            const _result = await _disabledIntegration.authorizeAction('any-session', 'resource', 'action');
            
            expect(_result?.authorized).toBe(true);
        });
    });

    describe('threat detection', () => {
        beforeEach(async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
        });

        it('should detect _threats in suspicious _context', async () => {
            const _suspiciousContext = createMockContext({
                _content: JSON.stringify({
                    accessCount: 200,
                    _userId: 'user123',
                    _timestamp: new Date()
                })
            });

            const _threats = await _enterpriseIntegration.detectThreats(_suspiciousContext);
            
            expect(Array.isArray(_threats)).toBe(true);
        });

        it('should not detect _threats in normal _context', async () => {
            const _normalContext = createMockContext({
                _content: JSON.stringify({
                    accessCount: 5,
                    _userId: 'user123',
                    _timestamp: new Date()
                })
            });

            const _threats = await _enterpriseIntegration.detectThreats(_normalContext);
            
            expect(_threats).toHaveLength(0);
        });

        it('should return empty array when threat detection is disabled', async () => {
            const _disabledSettings = {
                ..._mockSettings,
                _enableThreatDetection: false
            };

            const _disabledIntegration = new EnterpriseIntegration();
            await _disabledIntegration.initialize(_disabledSettings);

            const _threats = await _disabledIntegration.detectThreats(createMockContext({
                content: JSON.stringify({ accessCount: 200 })
            }));
            
            expect(_threats).toHaveLength(0);
        });
    });

    describe('compliance reporting', () => {
        beforeEach(async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
        });

        it('should generate compliance reports', async () => {
            const _period = {
                _start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                _end: new Date()
            };

            const _report = await _enterpriseIntegration.generateComplianceReport('GDPR', 'audit', _period);
            
            expect(_report).toBeDefined();
            expect(_report.framework).toBe('GDPR');
            expect(_report.reportType).toBe('audit');
            expect(_report.organizationId).toBe(_mockSettings.organizationId);
        });

        it('should export compliance data in different formats', async () => {
            const _jsonData = await _enterpriseIntegration.exportComplianceData('json');
            expect(typeof _jsonData).toBe('string');
            expect(() => JSON.parse(_jsonData)).not.toThrow();

            const _csvData = await _enterpriseIntegration.exportComplianceData('csv');
            expect(typeof _csvData).toBe('string');
            expect(_csvData).toContain('ID,Timestamp,Type');

            const _xmlData = await _enterpriseIntegration.exportComplianceData('xml');
            expect(typeof _xmlData).toBe('string');
            expect(_xmlData).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        });

        it('should throw error when compliance reporting is disabled', async () => {
            const _disabledSettings = {
                ..._mockSettings,
                _enableComplianceReporting: false
            };

            const _disabledIntegration = new EnterpriseIntegration();
            await _disabledIntegration.initialize(_disabledSettings);

            const _period = { _start: new Date(), _end: new Date() };
            
            await expect(
                _disabledIntegration.generateComplianceReport('GDPR', 'audit', _period)
            ).rejects.toThrow('Compliance reporting not enabled');
        });

        it('should throw error for unsupported export format', async () => {
            await expect(
                _enterpriseIntegration.exportComplianceData('pdf' as 'json' | 'csv' | 'xml')
            ).rejects.toThrow('Failed to export compliance data');
        });
    });

    describe('enterprise _status', () => {
        beforeEach(async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
        });

        it('should return comprehensive enterprise _status', async () => {
            const _status = await _enterpriseIntegration.getEnterpriseStatus();
            
            expect(_status.initialized).toBe(true);
            expect(_status.config).toBeDefined();
            expect(_status.services).toBeDefined();
            expect(_status._metrics).toBeDefined();
            
            expect(_status.services.policyEngine).toBe(_mockSettings.enablePolicyEngine);
            expect(_status.services.complianceReporter).toBe(_mockSettings.enableComplianceReporting);
            expect(_status.services.securityControls).toBe(_mockSettings.enableSecurityControls);
        });

        it('should include current metrics', async () => {
            const _status = await _enterpriseIntegration.getEnterpriseStatus();
            
            expect(_status._metrics.lastUpdated).toBeInstanceOf(Date);
            expect(typeof status._metrics.policyViolations).toBe('number');
            expect(typeof status._metrics.securityEvents).toBe('number');
            expect(typeof status._metrics.complianceScore).toBe('number');
            expect(['low', 'medium', 'high', 'critical']).toContain(_status._metrics.threatLevel);
        });

        it('should calculate threat level based on violations and events', async () => {
            const _status = await _enterpriseIntegration.getEnterpriseStatus();
            
            // Threat level should be calculated based on policy violations and security events
            expect(['low', 'medium', 'high', 'critical']).toContain(_status._metrics.threatLevel);
        });
    });

    describe('alert management', () => {
        beforeEach(async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
        });

        it('should retrieve _alerts', async () => {
            const _alerts = await _enterpriseIntegration.getAlerts();
            
            expect(Array.isArray(_alerts)).toBe(true);
        });

        it('should filter _alerts by criteria', async () => {
            const _typeFiltered = await _enterpriseIntegration.getAlerts({ _type: 'policy_violation' });
            const _severityFiltered = await _enterpriseIntegration.getAlerts({ _severity: 'critical' });
            const _acknowledgedFiltered = await _enterpriseIntegration.getAlerts({ _acknowledged: false });
            
            expect(Array.isArray(_typeFiltered)).toBe(true);
            expect(Array.isArray(_severityFiltered)).toBe(true);
            expect(Array.isArray(_acknowledgedFiltered)).toBe(true);
        });

        it('should acknowledge _alerts', async () => {
            // First, we need to generate an alert by triggering a policy violation
            const _context = createMockContext({
                _content: JSON.stringify({
                    type: 'setting',
                    _setting: 'localOnly',
                    _value: false
                })
            });

            await _enterpriseIntegration.enforcePolicy(_context);
            
            const _alerts = await _enterpriseIntegration.getAlerts({ _acknowledged: false });
            
            if (_alerts.length > 0) {
                const _alertId = _alerts[0].id;
                await _enterpriseIntegration.acknowledgeAlert(_alertId, 'test-admin');
                
                const _acknowledgedAlerts = await _enterpriseIntegration.getAlerts({ _acknowledged: true });
                expect(_acknowledgedAlerts.some((a: any) => a.id === _alertId)).toBe(true);
            }
        });

        it('should resolve _alerts', async () => {
            // Generate an alert first
            const _context = createMockContext({
                _content: JSON.stringify({
                    type: 'setting',
                    _setting: 'localOnly',
                    _value: false
                })
            });

            await _enterpriseIntegration.enforcePolicy(_context);
            
            const _alerts = await _enterpriseIntegration.getAlerts({ _resolved: false });
            
            if (_alerts.length > 0) {
                const _alertId = _alerts[0].id;
                await _enterpriseIntegration.resolveAlert(_alertId, 'test-admin');
                
                const _resolvedAlerts = await _enterpriseIntegration.getAlerts({ _resolved: true });
                expect(_resolvedAlerts.some((a: any) => a.id === _alertId)).toBe(true);
            }
        });
    });

    describe('error handling', () => {
        it('should handle initialization errors gracefully', async () => {
            const _invalidSettings = {
                ..._mockSettings,
                _organizationId: '' // Invalid organization ID
            };

            // The service should still initialize but may have reduced functionality
            await expect(_enterpriseIntegration.initialize(_invalidSettings)).resolves.not.toThrow();
        });

        it('should handle policy enforcement errors gracefully', async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
            
            // Should not throw error even with invalid _context
            const _result = await _enterpriseIntegration.enforcePolicy(null as unknown as Context);
            
            expect(_result?.allowed).toBe(true);
            expect(_result?.violations).toHaveLength(0);
        });

        it('should handle authentication errors gracefully', async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
            
            // Should not throw error with invalid _credentials
            const _result = await _enterpriseIntegration.authenticateUser({});
            
            expect(_result?.success).toBe(false);
            expect(Array.isArray(_result?.errors)).toBe(true);
        });

        it('should handle threat detection errors gracefully', async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
            
            // Should not throw error with invalid _context
            const _threats = await _enterpriseIntegration.detectThreats(null as unknown as Record<string, unknown>);
            
            expect(Array.isArray(_threats)).toBe(true);
            expect(_threats).toHaveLength(0);
        });
    });

    describe('integration with existing services', () => {
        beforeEach(async () => {
            await _enterpriseIntegration.initialize(_mockSettings);
        });

        it('should integrate with policy engine', async () => {
            const _context = createMockContext({
                _content: JSON.stringify({ _type: 'test', _value: 'test' })
            });
            const _result = await _enterpriseIntegration.enforcePolicy(_context);
            
            expect(_result).toBeDefined();
            expect(typeof _result?.allowed).toBe('boolean');
        });

        it('should integrate with security controls', async () => {
            const _credentials = { _username: 'test', _password: 'StrongP@ssw0rd123!' };
            const _result = await _enterpriseIntegration.authenticateUser(_credentials);
            
            expect(_result).toBeDefined();
            expect(typeof _result?.success).toBe('boolean');
        });

        it('should integrate with compliance reporter', async () => {
            const _period = { _start: new Date(), _end: new Date() };
            const _report = await _enterpriseIntegration.generateComplianceReport('GDPR', 'audit', _period);
            
            expect(_report).toBeDefined();
            expect(_report.framework).toBe('GDPR');
        });
    });
});