// Summarization pipeline types and interfaces

export interface SummarizationInput {
  text: string;
  options?: SummarizationOptions;
  metadata?: Record<string, unknown>;
}

export interface SummarizationOutput {
  text: string;
  sentences?: ProcessedSentence[];
  keywords?: string[];
  scores?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

import { LocalAlgorithm, CloudProvider } from '../../types';

export interface SummarizationOptions {
  targetLength?: number;
  compressionRatio?: number;
  preserveKeywords?: string[];
  quality?: 'fast' | 'balanced' | 'high';
  algorithm?: LocalAlgorithm | CloudProvider | 'hybrid';
}

export interface ProcessedSentence {
  text: string;
  index: number;
  score: number;
  keywords: string[];
  position: number; // Relative position in document (0-1)
}

export interface SummarizationStage {
  name: string;
  process(input: SummarizationInput): Promise<SummarizationOutput>;
}

export interface TextRankConfig {
  dampingFactor: number;
  iterations: number;
  convergenceThreshold: number;
  windowSize: number;
}

export interface TfIdfConfig {
  minTermFreq: number;
  maxTermFreq: number;
  minDocFreq: number;
  maxDocFreq: number;
  stopWords: Set<string>;
}

export interface SentenceScoringConfig {
  positionWeight: number;
  lengthWeight: number;
  keywordWeight: number;
  titleWeight: number;
}

export interface PipelineConfig {
  stages: string[];
  textrank?: TextRankConfig;
  tfidf?: TfIdfConfig;
  scoring?: SentenceScoringConfig;
}

// Default configurations
export const DEFAULT_TEXTRANK_CONFIG: TextRankConfig = {
  dampingFactor: 0.85,
  iterations: 100,
  convergenceThreshold: 0.0001,
  windowSize: 2,
};

export const DEFAULT_TFIDF_CONFIG: TfIdfConfig = {
  minTermFreq: 1,
  maxTermFreq: 0.8,
  minDocFreq: 1,
  maxDocFreq: 0.5,
  stopWords: new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
    'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs'
  ]),
};

export const DEFAULT_SCORING_CONFIG: SentenceScoringConfig = {
  positionWeight: 0.2,
  lengthWeight: 0.1,
  keywordWeight: 0.5,
  titleWeight: 0.2,
};