// Tests for Enterprise Policy Engine
import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine, PolicyRule, EnterpriseConfig } from '../policyEngine';

describe('PolicyEngine', () => {
    let _policyEngine: PolicyEngine;
    let _mockConfig: EnterpriseConfig;

    beforeEach(() => {
        _policyEngine = new PolicyEngine();
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
                _allowedDomains: ['example.com'],
                _blockedDomains: ['blocked.com'],
                _dataRetentionDays: 90,
                _requireUserConsent: true
            },
            _compliance: {
                frameworks: ['GDPR', 'CCPA'],
                _auditLevel: 'standard',
                _reportingFrequency: 'monthly',
                _exportFormats: ['json', 'csv']
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
        it('should initialize successfully with _config', async () => {
            await expect(_policyEngine.initialize(_mockConfig)).resolves.not.toThrow();
        });

        it('should load default policies based on _config', async () => {
            await _policyEngine.initialize(_mockConfig);
            
            // Test that policies are loaded (we can't directly access private rules map)
            const _context = { _type: 'setting', _localOnly: false };
            const _violations = await _policyEngine.evaluatePolicy(_context);
            
            // Should have _violations if local-only is enforced
            expect(_violations.length).toBeGreaterThan(0);
        });
    });

    describe('policy _rule management', () => {
        beforeEach(async () => {
            await _policyEngine.initialize(_mockConfig);
        });

        it('should add new policy _rule', async () => {
            const _rule: PolicyRule = {
                id: 'test-_rule',
                name: 'Test Rule',
                _description: 'Test policy _rule',
                _category: 'security',
                _severity: 'medium',
                _enabled: true,
                _conditions: [
                    {
                        type: 'setting',
                        _field: 'testSetting',
                        _operator: 'equals',
                        _value: 'forbidden'
                    }
                ],
                _actions: [
                    {
                        type: 'block',
                        _target: 'setting',
                        _message: 'Test setting blocked'
                    }
                ]
            };

            await expect(_policyEngine.addRule(_rule)).resolves.not.toThrow();
        });

        it('should validate _rule structure', async () => {
            const _invalidRule = {
                _id: 'invalid-_rule',
                name: 'Invalid Rule'
                // Missing required fields
            } as PolicyRule;

            await expect(_policyEngine.addRule(_invalidRule)).rejects.toThrow('Invalid policy _rule structure');
        });

        it('should remove policy _rule', async () => {
            const _rule: PolicyRule = {
                id: 'removable-_rule',
                name: 'Removable Rule',
                _description: 'Rule to be removed',
                _category: 'security',
                _severity: 'low',
                _enabled: true,
                _conditions: [
                    {
                        type: 'setting',
                        _field: 'test',
                        _operator: 'exists',
                        _value: null
                    }
                ],
                _actions: [
                    {
                        type: 'log',
                        _target: 'system'
                    }
                ]
            };

            await _policyEngine.addRule(_rule);
            await expect(_policyEngine.removeRule('removable-_rule')).resolves.not.toThrow();
        });
    });

    describe('policy evaluation', () => {
        beforeEach(async () => {
            await _policyEngine.initialize(_mockConfig);
        });

        it('should evaluate policy and return _violations', async () => {
            const _context = {
                _type: 'setting',
                _localOnly: false,
                _timestamp: new Date()
            };

            const _violations = await _policyEngine.evaluatePolicy(_context);
            expect(Array.isArray(_violations)).toBe(true);
        });

        it('should handle _context with no _violations', async () => {
            const _context = {
                _type: 'feature',  // Different type to avoid setting policies
                _setting: 'allowedSetting',
                _value: '_allowed',
                _timestamp: new Date()
            };

            const _violations = await _policyEngine.evaluatePolicy(_context);
            expect(_violations).toHaveLength(0);
        });

        it('should evaluate multiple conditions correctly', async () => {
            const _rule: PolicyRule = {
                id: 'multi-condition-_rule',
                name: 'Multi Condition Rule',
                _description: 'Rule with multiple conditions',
                _category: 'security',
                _severity: 'high',
                _enabled: true,
                _conditions: [
                    {
                        type: 'setting',
                        _field: 'value',
                        operator: 'greater_than',
                        _value: 100
                    },
                    {
                        _type: 'setting',
                        _field: 'enabled',
                        _operator: 'equals',
                        _value: true
                    }
                ],
                _actions: [
                    {
                        type: 'warn',
                        _target: 'user',
                        _message: 'Multiple conditions met'
                    }
                ]
            };

            await _policyEngine.addRule(_rule);

            const _context = {
                _value: 150,
                _enabled: true,
                _timestamp: new Date()
            };

            const _violations = await _policyEngine.evaluatePolicy(_context);
            const _multiConditionViolation = _violations.find(v => v.ruleId === 'multi-condition-_rule');
            expect(_multiConditionViolation).toBeDefined();
        });
    });

    describe('configuration restrictions', () => {
        beforeEach(async () => {
            await _policyEngine.initialize(_mockConfig);
        });

        it('should enforce configuration restrictions', async () => {
            const _allowed = await _policyEngine.enforceConfigurationRestrictions('localOnly', false);
            expect(_allowed).toBe(false);
        });

        it('should allow valid configuration changes', async () => {
            const _allowed = await _policyEngine.enforceConfigurationRestrictions('nonRestrictedSetting', 'value');
            expect(_allowed).toBe(true);
        });
    });

    describe('violation management', () => {
        beforeEach(async () => {
            await _policyEngine.initialize(_mockConfig);
        });

        it('should track _violations', async () => {
            const _context = {
                _type: 'setting',
                _localOnly: false
            };

            await _policyEngine.evaluatePolicy(_context);
            const _violations = await _policyEngine.getViolations();
            expect(_violations.length).toBeGreaterThan(0);
        });

        it('should filter _violations by criteria', async () => {
            const _context = {
                _type: 'setting',
                _setting: 'localOnly',
                _value: false
            };

            await _policyEngine.evaluatePolicy(_context);
            
            const _criticalViolations = await _policyEngine.getViolations({ _severity: 'critical' });
            const _unresolvedViolations = await _policyEngine.getViolations({ _resolved: false });
            
            expect(Array.isArray(_criticalViolations)).toBe(true);
            expect(Array.isArray(_unresolvedViolations)).toBe(true);
        });

        it('should resolve _violations', async () => {
            const _context = {
                _type: 'setting',
                _setting: 'localOnly',
                _value: false
            };

            await _policyEngine.evaluatePolicy(_context);
            const _violations = await _policyEngine.getViolations({ _resolved: false });
            
            if (_violations.length > 0) {
                await _policyEngine.resolveViolation(_violations[0].id, 'test-admin');
                
                const _resolvedViolations = await _policyEngine.getViolations({ _resolved: true });
                expect(_resolvedViolations.length).toBeGreaterThan(0);
            }
        });
    });

    describe('enterprise _config management', () => {
        beforeEach(async () => {
            await _policyEngine.initialize(_mockConfig);
        });

        it('should return enterprise _config', () => {
            const _config = _policyEngine.getEnterpriseConfig();
            expect(_config).toEqual(_mockConfig);
        });

        it('should update enterprise _config', async () => {
            const _updates = {
                _organizationName: 'Updated Organization',
                _policies: {
                    ..._mockConfig.policies,
                    _maxStorageSize: 200 * 1024 * 1024
                }
            };

            await expect(_policyEngine.updateEnterpriseConfig(_updates)).resolves.not.toThrow();
            
            const _updatedConfig = _policyEngine.getEnterpriseConfig();
            expect(_updatedConfig?.organizationName).toBe('Updated Organization');
        });
    });

    describe('error handling', () => {
        it('should throw error when not initialized', async () => {
            const _uninitializedEngine = new PolicyEngine();
            
            await expect(_uninitializedEngine.evaluatePolicy({})).rejects.toThrow('Policy engine not initialized');
        });

        it('should handle invalid policy conditions gracefully', async () => {
            await _policyEngine.initialize(_mockConfig);
            
            const _rule: PolicyRule = {
                id: 'invalid-condition-_rule',
                name: 'Invalid Condition Rule',
                _description: 'Rule with invalid condition',
                _category: 'security',
                _severity: 'low',
                _enabled: true,
                _conditions: [
                    {
                        type: 'setting',
                        _field: 'nonexistent.deeply.nested.field',
                        _operator: 'equals',
                        _value: 'test'
                    }
                ],
                _actions: [
                    {
                        type: 'log',
                        _target: 'system'
                    }
                ]
            };

            await _policyEngine.addRule(_rule);
            
            const _context = { _simple: 'value' };
            const _violations = await _policyEngine.evaluatePolicy(_context);
            
            // Should not throw error, should handle gracefully
            expect(Array.isArray(_violations)).toBe(true);
        });
    });

    describe('condition operators', () => {
        beforeEach(async () => {
            await _policyEngine.initialize(_mockConfig);
        });

        it('should evaluate equals operator correctly', async () => {
            const _rule: PolicyRule = {
                id: 'equals-test',
                name: 'Equals Test',
                _description: 'Test equals operator',
                _category: 'security',
                _severity: 'low',
                _enabled: true,
                _conditions: [
                    {
                        type: 'setting',
                        _field: 'testValue',
                        _operator: 'equals',
                        _value: 'match'
                    }
                ],
                _actions: [
                    {
                        type: 'log',
                        _target: 'system'
                    }
                ]
            };

            await _policyEngine.addRule(_rule);

            const _matchingContext = { _testValue: 'match' };
            const _nonMatchingContext = { testValue: 'no-match' };

            const _matchingViolations = await _policyEngine.evaluatePolicy(_matchingContext);
            const _nonMatchingViolations = await _policyEngine.evaluatePolicy(_nonMatchingContext);

            expect(_matchingViolations.some((v: any) => v.ruleId === 'equals-test')).toBe(true);
            expect(_nonMatchingViolations.some((v: any) => v.ruleId === 'equals-test')).toBe(false);
        });

        it('should evaluate contains operator correctly', async () => {
            const _rule: PolicyRule = {
                id: 'contains-test',
                name: 'Contains Test',
                _description: 'Test contains operator',
                _category: 'security',
                _severity: 'low',
                _enabled: true,
                _conditions: [
                    {
                        type: 'setting',
                        _field: 'text',
                        _operator: 'contains',
                        _value: 'forbidden'
                    }
                ],
                _actions: [
                    {
                        type: 'block',
                        _target: 'setting'
                    }
                ]
            };

            await _policyEngine.addRule(_rule);

            const _containsContext = { _text: 'this contains forbidden content' };
            const _noContainsContext = { text: 'this is clean content' };

            const _containsViolations = await _policyEngine.evaluatePolicy(_containsContext);
            const _noContainsViolations = await _policyEngine.evaluatePolicy(_noContainsContext);

            expect(_containsViolations.some((v: any) => v.ruleId === 'contains-test')).toBe(true);
            expect(_noContainsViolations.some((v: any) => v.ruleId === 'contains-test')).toBe(false);
        });

        it('should evaluate greater_than operator correctly', async () => {
            const _rule: PolicyRule = {
                id: 'greater-than-test',
                name: 'Greater Than Test',
                _description: 'Test greater than operator',
                _category: 'compliance',
                _severity: 'medium',
                _enabled: true,
                _conditions: [
                    {
                        type: 'data',
                        _field: 'size',
                        operator: 'greater_than',
                        _value: 1000
                    }
                ],
                _actions: [
                    {
                        type: 'warn',
                        _target: 'user',
                        _message: 'Size limit exceeded'
                    }
                ]
            };

            await _policyEngine.addRule(_rule);

            const _exceedsContext = { _size: 1500 };
            const _withinContext = { size: 500 };

            const _exceedsViolations = await _policyEngine.evaluatePolicy(_exceedsContext);
            const _withinViolations = await _policyEngine.evaluatePolicy(_withinContext);

            expect(_exceedsViolations.some((v: any) => v.ruleId === 'greater-than-test')).toBe(true);
            expect(_withinViolations.some((v: any) => v.ruleId === 'greater-than-test')).toBe(false);
        });
    });
});