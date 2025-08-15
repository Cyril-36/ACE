// Common types for cloud providers
import { Summary } from '../../../types';
import { SummarizationOptions } from '../../summarization/types';

export enum ProcessingStrategy {
  CHEAPEST = 'cheapest',
  FASTEST = 'fastest',
  HIGHEST_QUALITY = 'highest_quality',
  BALANCED = 'balanced'
}

export interface CloudProviderService {
  getProvider(): string;
  getSupportedModels(): string[];
  getModelCapabilities(_model: string): ModelCapabilities;
  estimateCost(_content: string, model?: string): number;
  recommendModel(_content: string, budget?: number): ModelRecommendation;
  summarize(_content: string, _apiKey: string, options?: SummarizationOptions): Promise<Summary>;
  assessQuality(_summary: string, _originalContent: string): QualityMetrics;
}

export interface ModelCapabilities {
  _maxTokens: number;
  supportsVision?: boolean;
  costPer1kTokens: number;
  strengths: string[];
}

export interface ModelRecommendation {
  model: string;
  reasoning: string;
  estimatedCost: number;
  qualityScore: number;
}

export interface QualityMetrics {
  overall: number;
  coherence: number;
  relevance: number;
  completeness: number;
  conciseness: number;
  [key: string]: number; // Allow provider-specific metrics
}