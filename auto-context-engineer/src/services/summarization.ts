// Summarization service interface
import { Summary, SummarizationOptions, CloudProvider, LocalAlgorithm } from "../types";
import { ProcessedSentence } from "./summarization/types";

export interface SummarizationService {
  // Local summarization
  summarizeLocal(
    content: string,
    options: SummarizationOptions,
  ): Promise<Summary>;

  // Cloud summarization
  summarizeCloud(
    content: string,
    _provider: CloudProvider,
    apiKey: string,
  ): Promise<Summary>;

  // Comparison and evaluation
  compareSummaries(summaries: Summary[]): unknown;
  evaluateQuality(original: string, summary: Summary): unknown;
}

import { SummarizationPipeline } from './summarization/pipeline';
import { TextRankSummarizer } from './summarization/textrank';
import { TfIdfKeywordExtractor } from './summarization/tfidf';
import { SentenceScorer } from './summarization/scorer';
import { PipelineConfig } from './summarization/types';

export class TextSummarizationService implements SummarizationService {
  private pipeline: SummarizationPipeline;

  constructor() {
    // Initialize with default pipeline configuration
    const defaultConfig: PipelineConfig = {
      stages: ['tfidf', 'textrank', 'scorer'],
    };

    this.pipeline = new SummarizationPipeline(defaultConfig);
    
    // Register all available stages
    this.pipeline.registerStages([
      new TfIdfKeywordExtractor(),
      new TextRankSummarizer(),
      new SentenceScorer(),
    ]);
  }

  async summarizeLocal(content: string, options: SummarizationOptions): Promise<Summary> {
    try {
      const result = await this.pipeline.run({
        text: content,
        options,
      });

      // Convert pipeline output to Summary format
      const qualityScore = this.calculateQualityScore(content, result.text, result.sentences || []);
      const summary: Summary = {
        id: this.generateSummaryId(),
        contextId: 'generated-' + this.generateSummaryId(),
        content: result.text,
        method: 'local',
        metadata: {
          timestamp: new Date(),
          tokens: Math.ceil(result.text.length / 4), // Rough token estimate
          quality: qualityScore.overall
        },
        algorithm: this.getAlgorithmName(options),
        timestamp: new Date(),
        originalLength: content.length,
        summaryLength: result.text.length,
        compressionRatio: result.text.length / content.length,
        quality: qualityScore,
        keywords: result.keywords || [],
      };

      return summary;
    } catch (error) {
      throw new Error(`Local summarization failed: ${error}`);
    }
  }

  async summarizeCloud(_content: string, _provider: CloudProvider, _apiKey: string): Promise<Summary> {
    throw new Error("Cloud summarization not implemented yet");
  }

  compareSummaries(summaries: Summary[]): {
    bestSummary: Summary;
    comparison: Array<{
      summary: Summary;
      scores: {
        compression: number;
        quality: number;
        keywordCoverage: number;
        overall: number;
      };
    }>;
  } {
    if (summaries.length === 0) {
      throw new Error("No summaries to compare");
    }

    const comparison = summaries.map(summary => {
      const scores = {
        compression: this.scoreCompression(summary.compressionRatio),
        quality: summary.quality.overall,
        keywordCoverage: this.scoreKeywordCoverage(summary.keywords),
        overall: 0,
      };
      
      // Calculate overall score as weighted average
      scores.overall = (scores.compression * 0.3) + 
                      (scores.quality * 0.5) + 
                      (scores.keywordCoverage * 0.2);

      return { summary, scores };
    });

    // Find best summary
    const bestSummary = comparison.reduce((best, current) => 
      current.scores.overall > best.scores.overall ? current : best
    ).summary;

    return { bestSummary, comparison };
  }

  evaluateQuality(original: string, summary: Summary): {
    coherence: number;
    relevance: number;
    completeness: number;
    readability: number;
    overall: number;
  } {
    const coherence = this.evaluateCoherence(summary.content);
    const relevance = this.evaluateRelevance(original, summary.content, summary.keywords);
    const completeness = this.evaluateCompleteness(original, summary.content);
    const readability = this.evaluateReadability(summary.content);
    
    const overall = (coherence + relevance + completeness + readability) / 4;

    return {
      coherence,
      relevance,
      completeness,
      readability,
      overall,
    };
  }

  // Configure the summarization pipeline
  configurePipeline(config: Partial<PipelineConfig>): void {
    this.pipeline.updateConfig(config);
  }

  // Get available pipeline stages
  getAvailableStages(): string[] {
    return this.pipeline.getAvailableStages();
  }

  private generateSummaryId(): string {
    return `summary_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private getAlgorithmName(options: SummarizationOptions): LocalAlgorithm {
    return options.algorithm || LocalAlgorithm.HYBRID;
  }

  private calculateQualityScore(original: string, summary: string, _sentences: ProcessedSentence[]): {
    coherence: number;
    relevance: number;
    completeness: number;
    overall: number;
  } {
    const coherence = this.evaluateCoherence(summary);
    const relevance = this.evaluateRelevance(original, summary, []);
    const completeness = this.evaluateCompleteness(original, summary);
    const overall = (coherence + relevance + completeness) / 3;

    return {
      coherence,
      relevance,
      completeness,
      overall,
    };
  }

  private evaluateCoherence(text: string): number {
    // Simple coherence evaluation based on sentence transitions
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= 1) return 1.0;

    let coherenceScore = 0;
    for (let i = 1; i < sentences.length; i++) {
      // Simple word overlap between consecutive sentences
      const words1 = new Set(sentences[i-1].toLowerCase().split(/\s+/));
      const words2 = new Set(sentences[i].toLowerCase().split(/\s+/));
      const overlap = new Set(Array.from(words1).filter(word => words2.has(word)));
      coherenceScore += overlap.size / Math.max(words1.size, words2.size);
    }

    return Math.min(coherenceScore / (sentences.length - 1), 1.0);
  }

  private evaluateRelevance(original: string, summary: string, keywords: string[]): number {
    // Evaluate how well the summary captures the main topics
    const originalWords = new Set(original.toLowerCase().split(/\s+/));
    const summaryWords = new Set(summary.toLowerCase().split(/\s+/));
    
    const overlap = new Set(Array.from(originalWords).filter(word => summaryWords.has(word)));
    const baseRelevance = overlap.size / originalWords.size;
    
    // Bonus for keyword coverage
    const keywordBonus = keywords.length > 0 ? 
      keywords.filter(kw => summaryWords.has(kw.toLowerCase())).length / keywords.length : 0;
    
    return Math.min((baseRelevance * 0.7) + (keywordBonus * 0.3), 1.0);
  }

  private evaluateCompleteness(original: string, summary: string): number {
    // Simple completeness based on length ratio and content coverage
    const lengthRatio = summary.length / original.length;
    
    // Penalize very short summaries, reward moderate compression
    if (lengthRatio < 0.1) return lengthRatio * 5; // Boost very short summaries
    if (lengthRatio > 0.8) return 0.8; // Cap very long summaries
    
    return Math.min(lengthRatio * 2, 1.0);
  }

  private evaluateReadability(text: string): number {
    // Simple readability based on sentence length and word complexity
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/);
    
    if (sentences.length === 0 || words.length === 0) return 0;
    
    const avgSentenceLength = words.length / sentences.length;
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    
    // Optimal sentence length: 15-20 words
    const sentenceLengthScore = avgSentenceLength >= 15 && avgSentenceLength <= 20 ? 1.0 : 
                               Math.max(0, 1 - Math.abs(avgSentenceLength - 17.5) / 17.5);
    
    // Optimal word length: 4-6 characters
    const wordLengthScore = avgWordLength >= 4 && avgWordLength <= 6 ? 1.0 :
                           Math.max(0, 1 - Math.abs(avgWordLength - 5) / 5);
    
    return (sentenceLengthScore + wordLengthScore) / 2;
  }

  private scoreCompression(ratio: number): number {
    // Optimal compression ratio: 0.2-0.4 (20-40% of original)
    if (ratio >= 0.2 && ratio <= 0.4) return 1.0;
    if (ratio < 0.1) return ratio * 5; // Very aggressive compression
    if (ratio > 0.8) return 0.2; // Minimal compression
    
    return Math.max(0, 1 - Math.abs(ratio - 0.3) / 0.3);
  }

  private scoreKeywordCoverage(keywords: string[]): number {
    // Score based on number and quality of keywords
    if (keywords.length === 0) return 0;
    if (keywords.length >= 5 && keywords.length <= 15) return 1.0;
    
    return Math.min(keywords.length / 10, 1.0);
  }
}
