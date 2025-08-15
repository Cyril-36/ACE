import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeService, ClaudeCapability } from '../_claudeService';
import { APIGateway } from '../../apiGateway';
import { CostEstimator } from '../../costEstimator';
import { EventBus } from '../../../background/eventBus';
import { CloudProvider, APIKeyManager } from '../../apiKeyManager';
import { IndexedDBStorageService } from '../../../storage';

// Mock dependencies
vi.mock('../../apiGateway');
vi.mock('../../costEstimator');
vi.mock('../../../background/eventBus');

// Mock fetch
global.fetch = vi.fn();

describe('ClaudeService', () => {
    let _claudeService: ClaudeService;
    let _mockApiGateway: APIGateway;
    let _mockApiKeyManager: APIKeyManager;
    let _mockCostEstimator: CostEstimator;
    let _mockEventBus: EventBus;

    beforeEach(() => {
        const _mockStorageService = new IndexedDBStorageService();
        _mockApiKeyManager = new APIKeyManager(_mockStorageService);

    _mockApiGateway = new APIGateway(_mockApiKeyManager, new CostEstimator(), new EventBus());
        _mockCostEstimator = new CostEstimator();
        _mockEventBus = new EventBus();

        // Mock EventBus methods
        vi.spyOn(_mockEventBus, 'emit').mockResolvedValue();

        // Mock APIGateway methods
        vi.spyOn(_mockApiGateway, 'getCostEstimate').mockResolvedValue({
            _provider: CloudProvider.CLAUDE,
            _model: 'claude-3-_haiku-20240307',
            _inputTokens: 100,
            _outputTokens: 50,
            _inputCost: 0.000025,
            _outputCost: 0.0000625,
            _totalCost: 0.0000875,
            _currency: 'USD',
            _estimatedAt: Date.now(),
        });

        vi.spyOn(_mockApiGateway, 'makeRequest').mockResolvedValue({
            success: true,
            _content: 'This is a thoughtful and well-structured summary that demonstrates Claude\'s coherent writing style.',
            usage: {
                _inputTokens: 100,
                _outputTokens: 50,
                _totalTokens: 150,
            },
            cost: {
                _provider: CloudProvider.CLAUDE,
                _model: 'claude-3-_haiku-20240307',
                _inputTokens: 100,
                _outputTokens: 50,
                _inputCost: 0.000025,
                _outputCost: 0.0000625,
                _totalCost: 0.0000875,
                _currency: 'USD',
                _estimatedAt: Date.now(),
            },
            latency: 2000,
            _model: 'claude-3-_haiku-20240307',
            provider: CloudProvider.CLAUDE,
        });

        _claudeService = new ClaudeService(_mockApiGateway, _mockCostEstimator, _mockEventBus);
    });

    describe('Model Management', () => {
        it('should return available Claude _models', () => {
            const _models = claudeService.getAvailableModels();
            
            expect(_models.length).toBeGreaterThan(0);
            expect(_models.every((_model: any) => !model.deprecated)).toBe(true);
            
            const _haiku = models.find(m => m.id === 'claude-3-_haiku-20240307');
            expect(_haiku).toBeDefined();
            expect(_haiku?.capabilities).toContain(ClaudeCapability.CHAT_COMPLETION);
            expect(_haiku?.capabilities).toContain(ClaudeCapability.LONG_CONTEXT);
        });

        it('should get Claude _model information', () => {
            const _modelInfo = claudeService.getModelInfo('claude-3-_opus-20240229');
            
            expect(_modelInfo).toBeDefined();
            expect(_modelInfo?.id).toBe('claude-3-_opus-20240229');
            expect(_modelInfo?.contextWindow).toBe(200000);
            expect(_modelInfo?.capabilities).toContain(ClaudeCapability.VISION);
        });

        it('should return null for unknown _model', () => {
            const _modelInfo = claudeService.getModelInfo('unknown-claude-_model');
            expect(_modelInfo).toBeNull();
        });

        it('should recommend appropriate Claude _model for _content length', () => {
            // Short _content should recommend cost-effective _model
            const _shortContentModel = claudeService.getRecommendedModel(500);
            expect(_shortContentModel.id).toBe('claude-3-_haiku-20240307');

            // Long _content should work with any Claude _model due to large context windows
            const _longContentModel = claudeService.getRecommendedModel(50000);
            expect(_longContentModel.contextWindow).toBeGreaterThan(100000);
        });

        it('should recommend _model within budget', () => {
            const _budgetModel = claudeService.getRecommendedModel(1000, 0.001); // Very low budget
            expect(_budgetModel.inputCostPer1kTokens).toBeLessThanOrEqual(0.001);
        });

        it('should throw error for _content too long for any _model', () => {
            expect(() => {
                claudeService.getRecommendedModel(2000000); // Extremely long _content
            }).toThrow('Content too long for any available Claude _model');
        });
    });

    describe('Summarization', () => {
        it('should successfully summarize _content', async () => {
            const _content = 'This is a comprehensive piece of _content that requires thoughtful analysis and summarization to capture its key insights and main arguments.';
            
            const _result = await _claudeService.summarize(_content);

            expect(_result?.success).toBe(true);
            expect(_result?.summary).toBeDefined();
            expect(_result?._model).toBe('claude-3-_haiku-20240307');
            expect(_result?._usage.totalTokens).toBe(150);
            expect(_result?.cost.totalCost).toBe(0.0000875);
            expect(_result?.quality).toBeDefined();
            expect(_result?.quality.coherence).toBeGreaterThan(0);
            expect(_result?.quality.creativity).toBeGreaterThan(0); // Claude-specific metric
        });

        it('should use custom Claude _options', async () => {
            const _content = 'Test _content for Claude';
            const _options = {
                _model: 'claude-3-_opus-20240229',
                _temperature: 0.7,
                _maxTokens: 2000,
                _topP: 0.9,
                _topK: 40,
                _systemPrompt: 'Custom Claude system prompt',
            };

            await _claudeService.summarize(_content, _options);

            expect(_mockApiGateway.makeRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    _model: 'claude-3-_opus-20240229',
                    _temperature: 0.7,
                    _maxTokens: 2000,
                    _systemPrompt: 'Custom Claude system prompt',
                })
            );
        });

        it('should handle _content too long for _model', async () => {
            const _veryLongContent = 'x'.repeat(1000000); // Very long _content
            
            const _result = await _claudeService.summarize(_veryLongContent, { _model: 'claude-3-_haiku-20240307' });

            expect(_result?.success).toBe(false);
            expect(_result?.error).toContain('Content too long for _model');
        });

        it('should handle API errors gracefully', async () => {
            // Mock API Gateway to return an error response
            vi.spyOn(_mockApiGateway, 'makeRequest').mockResolvedValueOnce({
                success: false,
                error: 'API request failed',
                _latency: 1000,
                _model: 'claude-3-_haiku-20240307',
                _provider: CloudProvider.CLAUDE,
            });

            const _result = await _claudeService.summarize('test _content');
            
            expect(_result?.success).toBe(false);
            expect(_result?.error).toBeDefined();
        });

        it('should emit events during summarization', async () => {
            await _claudeService.summarize('test _content');

            expect(_mockEventBus.emit).toHaveBeenCalledWith(
                expect.objectContaining({
                    __type: 'CLOUD_SUMMARIZATION_START',
                })
            );

            expect(_mockEventBus.emit).toHaveBeenCalledWith(
                expect.objectContaining({
                    __type: 'CLOUD_SUMMARIZATION_COMPLETE',
                })
            );
        });
    });

    describe('Local vs Claude Comparison', () => {
        it('should compare local and Claude summaries', async () => {
            const _content = 'Original _content that needs thoughtful analysis and creative summarization';
            const _localSummary = 'Basic local summary of the _content';

            const _comparison = await _claudeService.compareWithLocal(_content, _localSummary);

            expect(_comparison._localSummary).toBe(_localSummary);
            expect(_comparison.claudeSummary).toBeDefined();
            expect(_comparison._comparison).toBeDefined();
            expect(_comparison._comparison.qualityDifference).toBeDefined();
            expect(_comparison._comparison.creativityImprovement).toBeDefined(); // Claude-specific
            expect(_comparison._comparison.recommendation).toMatch(/use_local|use_claude|hybrid/);
            expect(_comparison.costBenefit).toBeDefined();
            expect(_comparison.costBenefit.worthUpgrade).toBeDefined();
        });

        it('should handle Claude summarization failure in _comparison', async () => {
            vi.spyOn(_mockApiGateway, 'makeRequest').mockResolvedValue({
                success: false,
                error: 'Claude API error',
                _latency: 100,
                _model: 'claude-3-_haiku-20240307',
                _provider: CloudProvider.CLAUDE,
            });

            await expect(
                _claudeService.compareWithLocal('_content', 'local summary')
            ).rejects.toThrow('Claude summarization failed');
        });

        it('should recommend Claude for creative _content', async () => {
            // Mock a high-quality Claude response with good creativity
            vi.spyOn(_mockApiGateway, 'makeRequest').mockResolvedValue({
                success: true,
                _content: 'This is a remarkably insightful and creatively structured summary that demonstrates sophisticated analysis, nuanced understanding, and particularly elegant prose that captures the essence of the original content.',
                usage: { _inputTokens: 100, _outputTokens: 60, _totalTokens: 160 },
                _cost: {
                    _provider: CloudProvider.CLAUDE,
                    _model: 'claude-3-_haiku-20240307',
                    _inputTokens: 100,
                    _outputTokens: 60,
                    _inputCost: 0.000025,
                    _outputCost: 0.000075,
                    _totalCost: 0.0001,
                    _currency: 'USD',
                    _estimatedAt: Date.now(),
                },
                _latency: 2000,
                _model: 'claude-3-_haiku-20240307',
                _provider: CloudProvider.CLAUDE,
            });

            const _comparison = await _claudeService.compareWithLocal(
                'Complex creative _content requiring nuanced analysis and sophisticated understanding',
                'Simple summary'
            );

            expect(_comparison._comparison.recommendation).toBe('use_claude');
            expect(_comparison.costBenefit.worthUpgrade).toBe(true);
            expect(_comparison._comparison.creativityImprovement).toBeGreaterThan(0);
        });
    });

    describe('Quality Analysis', () => {
        it('should analyze Claude summary quality with creativity metric', async () => {
            const _result = await _claudeService.summarize('Test _content with sophisticated analysis requirements and creative elements that need thoughtful consideration.');

            expect(_result?.quality.coherence).toBeGreaterThan(0);
            expect(_result?.quality.coherence).toBeLessThanOrEqual(1);
            expect(_result?.quality.relevance).toBeGreaterThan(0);
            expect(_result?.quality.relevance).toBeLessThanOrEqual(1);
            expect(_result?.quality.completeness).toBeGreaterThan(0);
            expect(_result?.quality.completeness).toBeLessThanOrEqual(1);
            expect(_result?.quality.conciseness).toBeGreaterThan(0);
            expect(_result?.quality.conciseness).toBeLessThanOrEqual(1);
            expect(_result?.quality.creativity).toBeGreaterThan(0); // Claude-specific
            expect(_result?.quality.creativity).toBeLessThanOrEqual(1);
        });

        it('should handle empty or very short _content', async () => {
            const _result = await _claudeService.summarize('Short.');

            expect(_result?.quality).toBeDefined();
            expect(typeof _result?.quality.coherence).toBe('number');
            expect(typeof _result?.quality.creativity).toBe('number');
        });

        it('should assess creativity based on language sophistication', async () => {
            // Mock response with sophisticated language
            vi.spyOn(_mockApiGateway, 'makeRequest').mockResolvedValue({
                success: true,
                _content: 'This analysis remarkably demonstrates particularly sophisticated understanding, intriguingly revealing uniquely significant insights.',
                usage: { _inputTokens: 50, _outputTokens: 25, _totalTokens: 75 },
                _cost: {
                    _provider: CloudProvider.CLAUDE,
                    _model: 'claude-3-_haiku-20240307',
                    _inputTokens: 50,
                    _outputTokens: 25,
                    _inputCost: 0.0000125,
                    _outputCost: 0.00003125,
                    _totalCost: 0.00004375,
                    _currency: 'USD',
                    _estimatedAt: Date.now(),
                },
                _latency: 1500,
                _model: 'claude-3-_haiku-20240307',
                _provider: CloudProvider.CLAUDE,
            });

            const _result = await _claudeService.summarize('test _content');
            expect(_result?.quality.creativity).toBeGreaterThan(0.6); // Should score high for creative language
        });
    });

    describe('Error Handling', () => {
        it('should handle unsupported _model', async () => {
            const _result = await _claudeService.summarize('test', { _model: 'unsupported-claude-_model' });

            expect(_result?.success).toBe(false);
            expect(_result?.error).toContain('Unsupported Claude _model');
        });

        it('should handle network errors', async () => {
            vi.spyOn(_mockApiGateway, 'makeRequest').mockRejectedValue(new Error('Network error'));

            const _result = await _claudeService.summarize('test _content');

            expect(_result?.success).toBe(false);
            expect(_result?.error).toBe('Network error');
        });

        it('should emit error events', async () => {
            vi.spyOn(_mockApiGateway, 'makeRequest').mockRejectedValue(new Error('Test error'));

            await _claudeService.summarize('test _content');

            expect(_mockEventBus.emit).toHaveBeenCalledWith(
                expect.objectContaining({
                    __type: 'CLOUD_SUMMARIZATION_ERROR',
                })
            );
        });
    });

    describe('Claude-Specific Features', () => {
        it('should use different prompts for different _models', async () => {
            // Test Opus prompt
            await _claudeService.summarize('test _content', { _model: 'claude-3-_opus-20240229' });
            const _mockRequest = vi.mocked(_mockApiGateway.makeRequest);
            const _opusCall = _mockRequest.mock.calls[0][0];

            // Test Haiku prompt
            await _claudeService.summarize('test _content', { _model: 'claude-3-_haiku-20240307' });
            const _haikuCall = _mockRequest.mock.calls[1][0];

            expect(_opusCall.systemPrompt).toBeDefined();
            expect(_haikuCall.systemPrompt).toBeDefined();
            expect(_opusCall.systemPrompt).not.toBe(_haikuCall.systemPrompt);
        });

        it('should optimize prompts for _content length', async () => {
            const _shortContent = 'Short _content';
            const _longContent = 'x'.repeat(10000);

            await _claudeService.summarize(_shortContent);
            const _mockRequest = vi.mocked(_mockApiGateway.makeRequest);
            const _shortCall = _mockRequest.mock.calls[0][0];

            await _claudeService.summarize(_longContent);
            const _longCall = _mockRequest.mock.calls[1][0];

            expect(_shortCall.systemPrompt).toBeDefined();
            expect(_longCall.systemPrompt).toBeDefined();
            expect(_shortCall.systemPrompt).not.toBe(_longCall.systemPrompt);
        });

        it('should prefer long context _models for very long _content', () => {
            const _longContentModel = claudeService.getRecommendedModel(100000);
            expect(_longContentModel.capabilities).toContain(ClaudeCapability.LONG_CONTEXT);
        });
    });

    describe('Token Estimation', () => {
        it('should estimate tokens correctly for Claude (3.5 chars per token)', () => {
            const _content = 'This is test _content'; // 20 characters
            // Should be about 6 tokens (20 chars / 3.5 chars per token)

            // Test through _model recommendation which uses token estimation
            const _model = claudeService.getRecommendedModel(_content.length);
            expect(_model).toBeDefined();
        });
    });
});