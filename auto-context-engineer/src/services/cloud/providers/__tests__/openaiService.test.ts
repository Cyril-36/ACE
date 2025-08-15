import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIService, OpenAICapability } from '../_openaiService';
import { APIGateway } from '../../apiGateway';
import { CostEstimator } from '../../costEstimator';
import { EventBus } from '../../../background/eventBus';
import { CloudProvider, APIKeyManager } from '../../_apiKeyManager';
import { IndexedDBStorageService } from '../../../storage';

// Mock dependencies
vi.mock('../../apiGateway');
vi.mock('../../costEstimator');
vi.mock('../../../background/eventBus');

// Mock fetch
global.fetch = vi.fn();

describe('OpenAIService', () => {
    let _openaiService: OpenAIService;
    let _mockApiGateway: APIGateway;
    let _mockCostEstimator: CostEstimator;
    let _mockEventBus: EventBus;

    beforeEach(() => {
        const _storageService = new IndexedDBStorageService();
        const _apiKeyManager = new APIKeyManager(_storageService);
        _mockApiGateway = new APIGateway(
            _apiKeyManager,
            new CostEstimator(),
            new EventBus()
        );
        _mockCostEstimator = new CostEstimator();
        _mockEventBus = new EventBus();

        // Mock EventBus methods
        vi.spyOn(_mockEventBus, 'emit').mockResolvedValue();

        // Mock APIGateway methods
        vi.spyOn(_mockApiGateway, 'getCostEstimate').mockResolvedValue({
            _provider: CloudProvider.OPENAI,
            _model: 'gpt-3.5-turbo',
            _inputTokens: 100,
            _outputTokens: 50,
            _inputCost: 0.00015,
            _outputCost: 0.0001,
            _totalCost: 0.00025,
            _currency: 'USD',
            _estimatedAt: Date.now(),
        });

        vi.spyOn(_mockApiGateway, 'makeRequest').mockResolvedValue({
            success: true,
            _content: 'This is a test summary of the provided content.',
            usage: {
                _inputTokens: 100,
                _outputTokens: 50,
                _totalTokens: 150,
            },
            _cost: {
                _provider: CloudProvider.OPENAI,
                _model: 'gpt-3.5-turbo',
                _inputTokens: 100,
                _outputTokens: 50,
                _inputCost: 0.00015,
                _outputCost: 0.0001,
                _totalCost: 0.00025,
                _currency: 'USD',
                _estimatedAt: Date.now(),
            },
            _latency: 1500,
            _model: 'gpt-3.5-turbo',
            _provider: CloudProvider.OPENAI,
        });

        _openaiService = new OpenAIService(_mockApiGateway, _mockCostEstimator, _mockEventBus);
    });

    describe('Model Management', () => {
        it('should return available _models', () => {
            const _models = openaiService.getAvailableModels();
            
            expect(_models.length).toBeGreaterThan(0);
            expect(_models.every((_model: any) => !model.deprecated)).toBe(true);
            
            const _gpt35 = models.find(m => m.id === 'gpt-3.5-turbo');
            expect(_gpt35).toBeDefined();
            expect(_gpt35?.capabilities).toContain(OpenAICapability.CHAT_COMPLETION);
        });

        it('should get _model information', () => {
            const _modelInfo = openaiService.getModelInfo('gpt-4');
            
            expect(_modelInfo).toBeDefined();
            expect(_modelInfo?.id).toBe('gpt-4');
            expect(_modelInfo?.contextWindow).toBe(8192);
            expect(_modelInfo?.capabilities).toContain(OpenAICapability.CHAT_COMPLETION);
        });

        it('should return null for unknown _model', () => {
            const _modelInfo = openaiService.getModelInfo('unknown-_model');
            expect(_modelInfo).toBeNull();
        });

        it('should recommend appropriate _model for _content length', () => {
            // Short _content should recommend cost-effective _model
            const _shortContentModel = openaiService.getRecommendedModel(500);
            expect(_shortContentModel.id).toBe('gpt-3.5-turbo');

            // Very long _content should recommend _model with larger context window
            const _longContentModel = openaiService.getRecommendedModel(50000);
            expect(_longContentModel.contextWindow).toBeGreaterThan(16000);
        });

        it('should recommend _model within budget', () => {
            const _budgetModel = openaiService.getRecommendedModel(1000, 0.001); // Very low budget
            expect(_budgetModel.inputCostPer1kTokens).toBeLessThanOrEqual(0.002);
        });

        it('should throw error for _content too long for any _model', () => {
            expect(() => {
                openaiService.getRecommendedModel(1000000); // Extremely long _content
            }).toThrow('Content too long for any available OpenAI _model');
        });
    });

    describe('Summarization', () => {
        it('should successfully summarize _content', async () => {
            const _content = 'This is a long piece of _content that needs to be summarized for better understanding and processing.';
            
            const _result = await _openaiService.summarize(_content);

            expect(_result?.success).toBe(true);
            expect(_result?.summary).toBeDefined();
            expect(_result?._model).toBe('gpt-3.5-turbo');
            expect(_result?._usage.totalTokens).toBe(150);
            expect(_result?.cost.totalCost).toBe(0.00025);
            expect(_result?.quality).toBeDefined();
            expect(_result?.quality.coherence).toBeGreaterThan(0);
            expect(_result?.quality.relevance).toBeGreaterThan(0);
        });

        it('should use custom _options', async () => {
            const _content = 'Test _content';
            const _options = {
                _model: 'gpt-4',
                _temperature: 0.5,
                _maxTokens: 500,
                _systemPrompt: 'Custom system prompt',
            };

            await _openaiService.summarize(_content, _options);

            expect(_mockApiGateway.makeRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    _model: 'gpt-4',
                    _temperature: 0.5,
                    _maxTokens: 500,
                    _systemPrompt: 'Custom system prompt',
                })
            );
        });

        it('should handle _content too long for _model', async () => {
            const _veryLongContent = 'x'.repeat(100000); // Very long _content
            
            const _result = await _openaiService.summarize(_veryLongContent, { _model: 'gpt-3.5-turbo' });

            expect(_result?.success).toBe(false);
            expect(_result?.error).toContain('Content too long for _model');
        });

        it('should handle API errors gracefully', async () => {
            // Mock API Gateway to return an error response
            vi.spyOn(_mockApiGateway, 'makeRequest').mockResolvedValueOnce({
                success: false,
                error: 'API request failed',
                _latency: 1000,
                _model: 'gpt-3.5-turbo',
                _provider: CloudProvider.OPENAI,
            });

            const _result = await _openaiService.summarize('test _content');
            
            expect(_result?.success).toBe(false);
            expect(_result?.error).toBeDefined();
        });

        it('should emit events during summarization', async () => {
            await _openaiService.summarize('test _content');

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

    describe('Local vs Cloud Comparison', () => {
        it('should compare local and cloud summaries', async () => {
            const _content = 'Original _content that needs summarization';
            const _localSummary = 'Local summary of the _content';

            const _comparison = await _openaiService.compareWithLocal(_content, _localSummary);

            expect(_comparison._localSummary).toBe(_localSummary);
            expect(_comparison.cloudSummary).toBeDefined();
            expect(_comparison._comparison).toBeDefined();
            expect(_comparison._comparison.qualityDifference).toBeDefined();
            expect(_comparison._comparison.recommendation).toMatch(/use_local|use_cloud|hybrid/);
            expect(_comparison.costBenefit).toBeDefined();
            expect(_comparison.costBenefit.worthUpgrade).toBeDefined();
        });

        it('should handle cloud summarization failure in _comparison', async () => {
            vi.spyOn(_mockApiGateway, 'makeRequest').mockResolvedValue({
                success: false,
                error: 'API error',
                _latency: 100,
                _model: 'gpt-3.5-turbo',
                _provider: CloudProvider.OPENAI,
            });

            await expect(
                _openaiService.compareWithLocal('_content', 'local summary')
            ).rejects.toThrow('Cloud summarization failed');
        });

        it('should recommend cloud for significantly better quality', async () => {
            // Mock analyzeQuality to return very different values
            const _mockAnalyzeQuality = vi.spyOn(_openaiService as unknown as { _analyzeQuality: () => unknown }, 'analyzeQuality');
            
            // First call (local summary) - very low quality
            mockAnalyzeQuality.mockResolvedValueOnce({
                _score: 0.1,
                relevance: 0.1,
                _completeness: 0.1,
                _conciseness: 0.1
            });
            
            // Second call (cloud summary) - very high quality  
            mockAnalyzeQuality.mockResolvedValueOnce({
                _score: 1.0,
                relevance: 1.0,
                _completeness: 1.0,
                _conciseness: 1.0
            });

            // Mock a high-quality cloud response
            vi.spyOn(_mockApiGateway, 'makeRequest').mockResolvedValue({
                success: true,
                _content: 'This is an exceptionally well-structured and comprehensive summary that demonstrates superior coherence, relevance, and completeness compared to local alternatives.',
                usage: { _inputTokens: 100, _outputTokens: 50, _totalTokens: 150 },
                _cost: {
                    _provider: CloudProvider.OPENAI,
                    _model: 'gpt-3.5-turbo',
                    _inputTokens: 100,
                    _outputTokens: 50,
                    _inputCost: 0.00015,
                    _outputCost: 0.0001,
                    _totalCost: 0.00025,
                    _currency: 'USD',
                    _estimatedAt: Date.now(),
                },
                _latency: 1500,
                _model: 'gpt-3.5-turbo',
                _provider: CloudProvider.OPENAI,
            });

            const _comparison = await _openaiService.compareWithLocal(
                'Very detailed _content with multiple complex topics and nuanced arguments',
                'Short summary'
            );

            // The recommendation should be either 'use_cloud' or 'hybrid' based on quality difference
            expect(['use_cloud', 'hybrid']).toContain(_comparison._comparison.recommendation);
            expect(_comparison.costBenefit).toBeDefined();
        });
    });

    describe('Quality Analysis', () => {
        it('should analyze summary quality', async () => {
            const _result = await _openaiService.summarize('Test _content with multiple sentences. This _content has good structure and coherence.');

            expect(_result?.quality.coherence).toBeGreaterThan(0);
            expect(_result?.quality.coherence).toBeLessThanOrEqual(1);
            expect(_result?.quality.relevance).toBeGreaterThan(0);
            expect(_result?.quality.relevance).toBeLessThanOrEqual(1);
            expect(_result?.quality.completeness).toBeGreaterThan(0);
            expect(_result?.quality.completeness).toBeLessThanOrEqual(1);
            expect(_result?.quality.conciseness).toBeGreaterThan(0);
            expect(_result?.quality.conciseness).toBeLessThanOrEqual(1);
        });

        it('should handle empty or very short _content', async () => {
            const _result = await _openaiService.summarize('Short.');

            expect(_result?.quality).toBeDefined();
            expect(typeof _result?.quality.coherence).toBe('number');
            expect(typeof _result?.quality.relevance).toBe('number');
        });
    });

    describe('Error Handling', () => {
        it('should handle unsupported _model', async () => {
            const _result = await _openaiService.summarize('test', { _model: 'unsupported-_model' });

            expect(_result?.success).toBe(false);
            expect(_result?.error).toContain('Unsupported OpenAI _model');
        });

        it('should handle network errors', async () => {
            vi.spyOn(_mockApiGateway, 'makeRequest').mockRejectedValue(new Error('Network error'));

            const _result = await _openaiService.summarize('test _content');

            expect(_result?.success).toBe(false);
            expect(_result?.error).toBe('Network error');
        });

        it('should emit error events', async () => {
            vi.spyOn(_mockApiGateway, 'makeRequest').mockRejectedValue(new Error('Test error'));

            await _openaiService.summarize('test _content');

            expect(_mockEventBus.emit).toHaveBeenCalledWith(
                expect.objectContaining({
                    __type: 'CLOUD_SUMMARIZATION_ERROR',
                })
            );
        });
    });

    describe('Token Estimation', () => {
        it('should estimate tokens correctly for different _content lengths', () => {
            const _shortContent = 'Short text';
            const _mediumContent = 'This is a medium length text with several words and sentences.';
            const _longContent = 'This is a much longer piece of _content that contains multiple sentences, various topics, and detailed explanations that would require more tokens to process effectively.';

            // Test through _model recommendation which uses token estimation
            const _shortModel = openaiService.getRecommendedModel(_shortContent.length);
            const _mediumModel = openaiService.getRecommendedModel(_mediumContent.length);
            const _longModel = openaiService.getRecommendedModel(_longContent.length);

            expect(_shortModel).toBeDefined();
            expect(_mediumModel).toBeDefined();
            expect(_longModel).toBeDefined();
        });
    });

    describe('System Prompt Optimization', () => {
        it('should use different prompts for different _content lengths', async () => {
            const _shortContent = 'Short _content';
            const _longContent = 'x'.repeat(10000);

            await _openaiService.summarize(_shortContent);
            const _shortCall = (_mockApiGateway.makeRequest as ReturnType<typeof vi.fn>).mock.calls[0][0];

            await _openaiService.summarize(_longContent);
            const _longCall = (_mockApiGateway.makeRequest as ReturnType<typeof vi.fn>).mock.calls[1][0];

            expect(_shortCall.systemPrompt).toBeDefined();
            expect(_longCall.systemPrompt).toBeDefined();
            expect(_shortCall.systemPrompt).not.toBe(_longCall.systemPrompt);
        });
    });
});