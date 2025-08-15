import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SecurityControls } from '../securityControls';
import { EnterpriseConfig } from '../policyEngine';
import { EventBus } from '../../background/eventBus';
import { Context } from '../../types';

// Tests for Enterprise Security Controls

describe('SecurityControls', () => {
    let securityControls: SecurityControls;
    let mockConfig: EnterpriseConfig;

    beforeEach(() => {
        securityControls = new SecurityControls();
        mockConfig = {
            organizationId: 'test-org',
            organizationName: 'Test Organization',
            adminContact: 'admin@test.com',
            policies: {
                enforceLocalOnly: true,
                requireEncryption: true,
                blockCloudFeatures: false,
                requireAuditLogging: true,
                maxStorageSize: 100 * 1024 * 1024,
                allowedDomains: [],
                blockedDomains: [],
                dataRetentionDays: 90,
                requireUserConsent: true
            },
            compliance: {
                frameworks: ['GDPR', 'CCPA'],
                auditLevel: 'comprehensive',
                reportingFrequency: 'monthly',
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
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('initialization', () => {
        it('should initialize successfully with config', async () => {
            await expect(securityControls.initialize(mockConfig)).resolves.not.toThrow();
        });

        it('should load security policies during initialization', async () => {
            await securityControls.initialize(mockConfig);
            
            // Test that policies are loaded by checking password validation
            const result = await securityControls.validatePassword('weak');
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('password validation', () => {
        beforeEach(async () => {
            await securityControls.initialize(mockConfig);
        });

        it('should validate strong passwords', async () => {
            const strongPassword = 'StrongP@ssw0rd123!';
            const result = await securityControls.validatePassword(strongPassword);
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject weak passwords', async () => {
            const weakPassword = 'weak';
            const result = await securityControls.validatePassword(weakPassword);
            
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should check minimum length requirement', async () => {
            const shortPassword = 'Short1!';
            const result = await securityControls.validatePassword(shortPassword);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must be at least 12 characters long');
        });

        it('should check uppercase letter requirement', async () => {
            const noUpperPassword = 'nouppercase123!';
            const result = await securityControls.validatePassword(noUpperPassword);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one uppercase letter');
        });

        it('should check lowercase letter requirement', async () => {
            const noLowerPassword = 'NOLOWERCASE123!';
            const result = await securityControls.validatePassword(noLowerPassword);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one lowercase letter');
        });

        it('should check number requirement', async () => {
            const noNumberPassword = 'NoNumbersHere!';
            const result = await securityControls.validatePassword(noNumberPassword);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one number');
        });

        it('should check special character requirement', async () => {
            const noSpecialPassword = 'NoSpecialChars123';
            const result = await securityControls.validatePassword(noSpecialPassword);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one special character');
        });

        it('should reject common passwords', async () => {
            const commonPassword = 'password123';
            const result = await securityControls.validatePassword(commonPassword);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password is too common, please choose a more unique password');
        });

        it('should allow passwords when strong password requirement is disabled', async () => {
            const configWithoutStrongPasswords = {
                ...mockConfig,
                security: {
                    ...mockConfig.security,
                    requireStrongPasswords: false
                }
            };

            const weakSecurityControls = new SecurityControls();
            await weakSecurityControls.initialize(configWithoutStrongPasswords);
            
            const result = await weakSecurityControls.validatePassword('weak');
            expect(result.valid).toBe(true);
        });
    });

    describe('user authentication', () => {
        beforeEach(async () => {
            await securityControls.initialize(mockConfig);
        });

        it('should authenticate user with valid password', async () => {
            const credentials = {
                username: 'testuser',
                password: 'StrongP@ssw0rd123!'
            };

            const result = await securityControls.authenticateUser(credentials);
            
            expect(result.success).toBe(true);
            expect(result.sessionId).toBeDefined();
            expect(result.errors).toBeUndefined();
        });

        it('should authenticate user with valid token', async () => {
            const credentials = {
                username: 'testuser',
                token: 'valid-token-123'
            };

            const result = await securityControls.authenticateUser(credentials);
            
            expect(result.success).toBe(true);
            expect(result.sessionId).toBeDefined();
        });

        it('should reject authentication with no credentials', async () => {
            const credentials = {
                username: 'testuser'
            };

            const result = await securityControls.authenticateUser(credentials);
            
            expect(result.success).toBe(false);
            expect(result.errors).toContain('Invalid credentials');
        });

        it('should reject authentication with weak password', async () => {
            const credentials = {
                username: 'testuser',
                password: 'weak'
            };

            const result = await securityControls.authenticateUser(credentials);
            
            expect(result.success).toBe(false);
            expect(result.errors?.length).toBeGreaterThan(0);
        });

        it('should generate unique session IDs', async () => {
            const credentials = {
                username: 'testuser',
                password: 'StrongP@ssw0rd123!'
            };

            const result1 = await securityControls.authenticateUser(credentials);
            const result2 = await securityControls.authenticateUser(credentials);
            
            expect(result1.sessionId).not.toBe(result2.sessionId);
        });
    });

    describe('action authorization', () => {
        let sessionId: string;

        beforeEach(async () => {
            await securityControls.initialize(mockConfig);
            
            const authResult = await securityControls.authenticateUser({
                username: 'testuser',
                password: 'StrongP@ssw0rd123!'
            });
            sessionId = authResult.sessionId!;
        });

        it('should authorize valid actions with valid session', async () => {
            const result = await securityControls.authorizeAction(sessionId, 'context', 'read');
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBeUndefined();
        });

        it('should reject actions with invalid session', async () => {
            const result = await securityControls.authorizeAction('invalid-session', 'context', 'read');
            
            expect(result.authorized).toBe(false);
            expect(result.reason).toBe('Invalid or expired session');
        });

        it('should handle authorization errors gracefully', async () => {
            // This test ensures the method doesn't throw errors
            const result = await securityControls.authorizeAction(sessionId, 'resource', 'action');
            
            expect(typeof result.authorized).toBe('boolean');
        });
    });

    describe('data encryption', () => {
        beforeEach(async () => {
            await securityControls.initialize(mockConfig);
        });

        it('should encrypt sensitive data', async () => {
            const sensitiveData = { secret: 'confidential information' };
            
            const result = await securityControls.encryptSensitiveData(sensitiveData, 'confidential');
            
            expect(result.encrypted).toBeDefined();
            expect(result.keyId).toBeDefined();
            expect(result.encrypted).not.toBe(JSON.stringify(sensitiveData));
        });

        it('should handle different classification levels', async () => {
            const data = { info: 'test data' };
            
            const publicResult = await securityControls.encryptSensitiveData(data, 'public');
            const restrictedResult = await securityControls.encryptSensitiveData(data, 'restricted');
            
            // When encryptionRequired is true, even public data gets encrypted
            expect(publicResult.keyId).not.toBe('none');
            expect(restrictedResult.keyId).not.toBe('none');
            expect(publicResult.keyId).not.toBe(restrictedResult.keyId);
        });

        it('should generate different keys for different classifications', async () => {
            const data = { info: 'test data' };
            
            const confidentialResult = await securityControls.encryptSensitiveData(data, 'confidential');
            const restrictedResult = await securityControls.encryptSensitiveData(data, 'restricted');
            
            expect(confidentialResult.keyId).not.toBe(restrictedResult.keyId);
        });
    });

    describe('threat detection', () => {
        beforeEach(async () => {
            await securityControls.initialize(mockConfig);
        });

        it('should detect behavioral threats', async () => {
            const suspiciousContext = {
                accessCount: 150, // High access count
                userId: 'user123',
                timestamp: new Date()
            };

            const threats = await securityControls.detectThreats(suspiciousContext as unknown as Context);
            
            expect(threats).toContainEqual(expect.objectContaining({
                category: 'suspicious_activity',
                threatLevel: 'medium',
            }));
        });

        it('should not flag normal context as suspicious', async () => {
            const normalContext = {
                event: {
                    __type: 'CONTEXT_CAPTURED',
                    payload: { source: 'ide', content: 'normal code content' },
                },
                user: 'test-user',
                session: 'test-session',
                metadata: { riskLevel: 'low' },
            };

            const threats = await securityControls.detectThreats(normalContext as unknown as Context);
            
            expect(threats).toHaveLength(0);
        });

        it('should detect credential exposure', async () => {
            const suspiciousContext = {
                content: 'password = "secret123"',
                event: {
                    __type: 'CONTEXT_CAPTURED',
                    payload: { source: 'ide' },
                },
                user: 'test-user',
                session: 'test-session',
                metadata: { riskLevel: 'high' },
            };

            const threats = await securityControls.detectThreats(suspiciousContext as unknown as Context);
            
            expect(threats).toContainEqual(expect.objectContaining({
                category: 'data_breach',
                threatLevel: 'high',
            }));
        });

        it('should detect excessive access patterns', async () => {
            const threats = await securityControls.detectThreats({ accessCount: 200 } as unknown as Context);

            expect(threats).toContainEqual(expect.objectContaining({
                category: 'suspicious_activity',
                threatLevel: 'medium',
            }));
        });

        it('should include threat indicators', async () => {
            const suspiciousContext = {
                accessCount: 200,
                userId: 'user123'
            };

            const threats = await securityControls.detectThreats(suspiciousContext as unknown as Context);
            
            if (threats.length > 0) {
                const threat = threats[0];
                expect(Array.isArray(threat.indicators)).toBe(true);
                expect(threat.indicators.length).toBeGreaterThan(0);
                
                const indicator = threat.indicators[0];
                expect(indicator.type).toBeDefined();
                expect(indicator.confidence).toBeGreaterThan(0);
                expect(indicator.confidence).toBeLessThanOrEqual(100);
            }
        });

        it('should include mitigation recommendations', async () => {
            const suspiciousContext = {
                accessCount: 200,
                userId: 'user123'
            };

            const threats = await securityControls.detectThreats(suspiciousContext as unknown as Context);
            
            if (threats.length > 0) {
                const threat = threats[0];
                expect(Array.isArray(threat.recommendations)).toBe(true);
                expect(Array.isArray(threat.mitigationActions)).toBe(true);
            }
        });
    });

    describe('threat mitigation', () => {
        let threatId: string;

        beforeEach(async () => {
            await securityControls.initialize(mockConfig);
            
            const threats = await securityControls.detectThreats({ accessCount: 200 } as unknown as Context);
            if (threats.length > 0) {
                threatId = threats[0].id;
            }
        });

        it('should mitigate detected threats', async () => {
            if (threatId) {
                const actions = ['throttle_access', 'require_additional_auth'];
                
                const result = await securityControls.mitigateThreat(threatId, actions);
                
                expect(result.success).toBe(true);
                expect(Array.isArray(result.results)).toBe(true);
                expect(result.results).toHaveLength(2);
            }
        });

        it('should handle unknown mitigation actions', async () => {
            if (threatId) {
                const actions = ['unknown_action'];
                
                const result = await securityControls.mitigateThreat(threatId, actions);
                
                expect(result.success).toBe(true);
                expect(result.results[0]).toContain('Failed');
            }
        });

        it('should throw error for non-existent threat', async () => {
            await expect(
                securityControls.mitigateThreat('non-existent-threat', ['throttle_access'])
            ).rejects.toThrow('Threat not found');
        });
    });

    describe('security metrics', () => {
        beforeEach(async () => {
            await securityControls.initialize(mockConfig);
        });

        it('should generate security metrics', async () => {
            const period = {
                start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
                end: new Date()
            };

            const metrics = await securityControls.generateSecurityMetrics(period);
            
            expect(metrics).toBeDefined();
            expect(metrics.period).toEqual(period);
            expect(metrics.events).toBeDefined();
            expect(metrics.threats).toBeDefined();
            expect(metrics.compliance).toBeDefined();
            expect(metrics.performance).toBeDefined();
        });

        it('should include event statistics', async () => {
            // Generate some events first
            await securityControls.authenticateUser({
                username: 'testuser',
                password: 'StrongP@ssw0rd123!'
            });

            const period = {
                start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                end: new Date()
            };

            const metrics = await securityControls.generateSecurityMetrics(period);
            
            expect(typeof metrics.events.total).toBe('number');
            expect(typeof metrics.events.byType).toBe('object');
            expect(typeof metrics.events.bySeverity).toBe('object');
            expect(typeof metrics.events.resolved).toBe('number');
            expect(typeof metrics.events.unresolved).toBe('number');
        });

        it('should include threat statistics', async () => {
            // Generate some threats first
            await securityControls.detectThreats({ accessCount: 200 } as unknown as Context);

            const period = {
                start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                end: new Date()
            };

            const metrics = await securityControls.generateSecurityMetrics(period);
            
            expect(typeof metrics.threats.total).toBe('number');
            expect(typeof metrics.threats.byLevel).toBe('object');
            expect(typeof metrics.threats.mitigated).toBe('number');
            expect(typeof metrics.threats.active).toBe('number');
        });
    });

    describe('security event retrieval', () => {
        beforeEach(async () => {
            await securityControls.initialize(mockConfig);
            
            // Generate some test events
            await securityControls.authenticateUser({
                username: 'user1',
                password: 'StrongP@ssw0rd123!'
            });
            
            await securityControls.authenticateUser({
                username: 'user2',
                password: 'weak' // This will fail and generate an error event
            });
        });

        it('should retrieve all security events', async () => {
            const events = await securityControls.getSecurityEvents();
            
            expect(Array.isArray(events)).toBe(true);
            expect(events.length).toBeGreaterThan(0);
        });

        it('should filter events by type', async () => {
            const authEvents = await securityControls.getSecurityEvents({ _type: 'authentication' });
            
            expect(Array.isArray(authEvents)).toBe(true);
            authEvents.forEach((event: any) => {
                expect(event._type).toBe('authentication');
            });
        });

        it('should filter events by severity', async () => {
            const errorEvents = await securityControls.getSecurityEvents({ severity: 'error' });
            
            expect(Array.isArray(errorEvents)).toBe(true);
            errorEvents.forEach((event: any) => {
                expect(event.severity).toBe('error');
            });
        });

        it('should filter events by user', async () => {
            const user1Events = await securityControls.getSecurityEvents({ user: 'user1' });
            
            expect(Array.isArray(user1Events)).toBe(true);
            user1Events.forEach((event: any) => {
                expect(event.user).toBe('user1');
            });
        });

        it('should filter events by resolved status', async () => {
            const unresolvedEvents = await securityControls.getSecurityEvents({ resolved: false });
            
            expect(Array.isArray(unresolvedEvents)).toBe(true);
            unresolvedEvents.forEach((event: any) => {
                expect(event.resolved).toBe(false);
            });
        });

        it('should filter events by date', async () => {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentEvents = await securityControls.getSecurityEvents({ since: oneHourAgo });
            
            expect(Array.isArray(recentEvents)).toBe(true);
            recentEvents.forEach((event: any) => {
                expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
            });
        });
    });

    describe('error handling', () => {
        it('should handle authentication errors gracefully', async () => {
            await securityControls.initialize(mockConfig);
            
            // This should not throw an error
            const result = await securityControls.authenticateUser({
                username: 'testuser',
                password: 'weak'
            });
            
            expect(result.success).toBe(false);
            expect(Array.isArray(result.errors)).toBe(true);
        });

        it('should handle authorization errors gracefully', async () => {
            await securityControls.initialize(mockConfig);
            
            // This should not throw an error
            const result = await securityControls.authorizeAction('invalid-session', 'resource', 'action');
            
            expect(result.authorized).toBe(false);
            expect(typeof result.reason).toBe('string');
        });

        it('should handle threat detection errors gracefully', async () => {
            await securityControls.initialize(mockConfig);
            
            // This should not throw an error even with invalid context
            const threats = await securityControls.detectThreats(null as unknown as Context);
            
            expect(Array.isArray(threats)).toBe(true);
        });
    });
});