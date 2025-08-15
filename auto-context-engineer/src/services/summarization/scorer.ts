// Sentence scoring and ranking system
import { 
  SummarizationStage, 
  SummarizationInput, 
  SummarizationOutput, 
  SentenceScoringConfig,
  DEFAULT_SCORING_CONFIG,
  ProcessedSentence 
} from './types';
import { TextPreprocessor } from './preprocessing';

export class SentenceScorer implements SummarizationStage {
  name = 'scorer';
  private config: SentenceScoringConfig;

  constructor(config: Partial<SentenceScoringConfig> = {}) {
    this.config = { ...DEFAULT_SCORING_CONFIG, ...config };
  }

  async process(input: SummarizationInput): Promise<SummarizationOutput> {
    const sentences = input.metadata?.sentences as ProcessedSentence[] || 
                     TextPreprocessor.createProcessedSentences(
                       TextPreprocessor.splitIntoSentences(input.text)
                     );
    
    const keywords = input.metadata?.keywords as string[] || [];
    
    if (sentences.length === 0) {
      return {
        text: input.text,
        sentences,
        metadata: { ...input.metadata, scorer_processed: true },
      };
    }

    // Calculate comprehensive scores for each sentence
    const scoredSentences = sentences.map(sentence => ({
      ...sentence,
      score: this.calculateSentenceScore(sentence, sentences, keywords, input.text),
    }));

    // Sort sentences by score for potential selection
    const rankedSentences = [...scoredSentences].sort((a, b) => b.score - a.score);
    
    // Generate summary if target length is specified
    let summaryText = input.text;
    if (input.options?.targetLength || input.options?.compressionRatio) {
      const targetLength = this.calculateTargetLength(input, sentences.length);
      const selectedSentences = rankedSentences
        .slice(0, targetLength)
        .sort((a, b) => a.index - b.index); // Restore original order
      
      summaryText = selectedSentences.map(s => s.text).join(' ');
    }

    return {
      text: summaryText,
      sentences: scoredSentences,
      keywords,
      scores: Object.fromEntries(
        scoredSentences.map(s => [s.index.toString(), s.score])
      ),
      metadata: {
        ...input.metadata,
        scorer_processed: true,
        scorer_avg_score: this.calculateAverageScore(scoredSentences),
        scorer_score_variance: this.calculateScoreVariance(scoredSentences),
      },
    };
  }

  private calculateSentenceScore(
    sentence: ProcessedSentence,
    _allSentences: ProcessedSentence[],
    keywords: string[],
    _fullText: string
  ): number {
    let score = 0;

    // Position score - sentences at the beginning and end are often more important
    score += this.calculatePositionScore(sentence.position) * this.config.positionWeight;

    // Length score - prefer sentences of moderate length
    score += this.calculateLengthScore(sentence.text) * this.config.lengthWeight;

    // Keyword score - sentences containing more keywords are more important
    score += this.calculateKeywordScore(sentence, keywords) * this.config.keywordWeight;

    // Title/heading score - if we can detect title-like sentences
    score += this.calculateTitleScore(sentence, _fullText) * this.config.titleWeight;

    return Math.max(0, score); // Ensure non-negative scores
  }

  private calculatePositionScore(position: number): number {
    // U-shaped curve: higher scores for beginning and end
    // Position is normalized between 0 and 1
    if (position <= 0.1) {
      return 1.0; // First 10% of document
    } else if (position >= 0.9) {
      return 0.8; // Last 10% of document
    } else if (position <= 0.3) {
      return 0.6; // Early part of document
    } else {
      return 0.3; // Middle part of document
    }
  }

  private calculateLengthScore(sentenceText: string): number {
    const words = TextPreprocessor.tokenize(sentenceText);
    const wordCount = words.length;

    // Prefer sentences with 10-25 words
    if (wordCount >= 10 && wordCount <= 25) {
      return 1.0;
    } else if (wordCount >= 5 && wordCount < 10) {
      return 0.7;
    } else if (wordCount > 25 && wordCount <= 35) {
      return 0.7;
    } else if (wordCount < 5) {
      return 0.3; // Very short sentences
    } else {
      return 0.4; // Very long sentences
    }
  }

  private calculateKeywordScore(sentence: ProcessedSentence, keywords: string[]): number {
    if (keywords.length === 0) return 0.5; // Neutral score if no keywords

    const sentenceTokens = new Set(TextPreprocessor.tokenize(sentence.text));
    const keywordMatches = keywords.filter(keyword => sentenceTokens.has(keyword));
    
    // Score based on keyword density
    const keywordDensity = keywordMatches.length / Math.max(sentenceTokens.size, 1);
    
    // Bonus for having multiple keywords
    const keywordBonus = Math.min(keywordMatches.length / keywords.length, 1);
    
    return (keywordDensity * 0.7) + (keywordBonus * 0.3);
  }

  private calculateTitleScore(sentence: ProcessedSentence, _fullText: string): number {
    const text = sentence.text;
    let score = 0;

    // Check for title-like characteristics
    if (this.isLikelyTitle(text)) {
      score += 0.8;
    }

    // Check if sentence appears early and is short (likely a heading)
    if (sentence.position < 0.1 && TextPreprocessor.tokenize(text).length <= 10) {
      score += 0.6;
    }

    // Check for formatting indicators (if preserved in text)
    if (this.hasFormattingIndicators(text)) {
      score += 0.4;
    }

    return Math.min(score, 1.0);
  }

  private isLikelyTitle(text: string): boolean {
    // Simple heuristics for title detection
    const words = TextPreprocessor.tokenize(text);
    
    // Titles are usually short
    if (words.length > 15) return false;
    
    // Check for title-like patterns
    const titlePatterns = [
      /^(chapter|section|part)\s+\d+/i,
      /^\d+\.\s+/,
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/,
    ];

    return titlePatterns.some(pattern => pattern.test(text));
  }

  private hasFormattingIndicators(text: string): boolean {
    // Check for common formatting indicators that might indicate importance
    return /^[A-Z\s]+$/.test(text) || // ALL CAPS
           text.includes('**') ||      // Bold markdown
           text.includes('__') ||      // Bold markdown
           text.startsWith('#');       // Markdown heading
  }

  private calculateTargetLength(input: SummarizationInput, totalSentences: number): number {
    const options = input.options;
    
    if (options?.targetLength) {
      return Math.min(options.targetLength, totalSentences);
    }
    
    if (options?.compressionRatio) {
      return Math.max(1, Math.floor(totalSentences * options.compressionRatio));
    }

    // Default: select top 30% of sentences
    return Math.max(1, Math.floor(totalSentences * 0.3));
  }

  private calculateAverageScore(sentences: ProcessedSentence[]): number {
    if (sentences.length === 0) return 0;
    const totalScore = sentences.reduce((sum, sentence) => sum + sentence.score, 0);
    return totalScore / sentences.length;
  }

  private calculateScoreVariance(sentences: ProcessedSentence[]): number {
    if (sentences.length === 0) return 0;
    
    const avgScore = this.calculateAverageScore(sentences);
    const squaredDiffs = sentences.map(sentence => Math.pow(sentence.score - avgScore, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / sentences.length;
    
    return variance;
  }

  // Calculate sentence importance based on centrality
  calculateCentralityScore(
    sentence: ProcessedSentence, 
    allSentences: ProcessedSentence[]
  ): number {
    let centralityScore = 0;
    
    allSentences.forEach(otherSentence => {
      if (sentence.index !== otherSentence.index) {
        const similarity = TextPreprocessor.calculateSentenceSimilarity(
          sentence.text, 
          otherSentence.text
        );
        centralityScore += similarity;
      }
    });

    return centralityScore / Math.max(allSentences.length - 1, 1);
  }

  // Calculate novelty score (how different a sentence is from others)
  calculateNoveltyScore(
    sentence: ProcessedSentence, 
    allSentences: ProcessedSentence[]
  ): number {
    let maxSimilarity = 0;
    
    allSentences.forEach(otherSentence => {
      if (sentence.index !== otherSentence.index) {
        const similarity = TextPreprocessor.calculateSentenceSimilarity(
          sentence.text, 
          otherSentence.text
        );
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
    });

    return 1 - maxSimilarity; // Higher novelty = lower max similarity
  }

  // Update configuration
  updateConfig(config: Partial<SentenceScoringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Get current configuration
  getConfig(): SentenceScoringConfig {
    return { ...this.config };
  }
}