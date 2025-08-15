// Cloud Services Index
export { APIKeyManager, CloudProvider, type APIKey, type APIKeyValidationResult } from './apiKeyManager';
export { CostEstimator, type CostEstimate, type ProviderPricing, type UsageMetrics } from './costEstimator';
export { APIGateway, type CloudRequest, type CloudResponse, type RateLimitInfo } from './apiGateway';
export { 
  CloudService, 
  type CloudServiceConfig, 
  type SummarizationRequest, 
  type SummarizationResponse,
  type CloudServiceStatus 
} from './cloudService';

// OpenAI Provider
export { 
  OpenAIService, 
  type OpenAIModel, 
  type OpenAISummarizationOptions, 
  type OpenAISummarizationResult,
  type OpenAIComparisonResult,
  OpenAICapability 
} from './providers/openaiService';

export { 
  OpenAIIntegration,
  type OpenAIIntegrationConfig,
  type SummarizationStrategy,
  type HybridSummarizationResult
} from './providers/openaiIntegration';

// Claude Provider
export {
  ClaudeService,
  type ClaudeModel,
  type ClaudeSummarizationOptions,
  type ClaudeSummarizationResult,
  type ClaudeComparisonResult,
  ClaudeCapability
} from './providers/claudeService';

// Gemini Provider
export {
  GeminiService,
  type GeminiModel,
  type GeminiSummarizationOptions,
  type GeminiSummarizationResult,
  type GeminiComparisonResult,
  GeminiCapability
} from './providers/geminiService';

// Multi-Provider Integration
export {
  MultiProviderIntegration,
  type MultiProviderConfig,
  type ProviderSummarizationOptions,
  type MultiProviderResult,
  type ProviderComparison
} from './providers/multiProviderIntegration';

// Provider Types
export {
  type CloudProviderService,
  type ModelCapabilities,
  type ModelRecommendation,
  type QualityMetrics,
  ProcessingStrategy
} from './providers/types';