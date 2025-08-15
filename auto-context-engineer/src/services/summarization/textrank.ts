// TextRank algorithm implementation for extractive summarization
import { 
  SummarizationStage, 
  SummarizationInput, 
  SummarizationOutput, 
  TextRankConfig,
  DEFAULT_TEXTRANK_CONFIG,
  ProcessedSentence 
} from './types';
import { TextPreprocessor } from './preprocessing';

export class TextRankSummarizer implements SummarizationStage {
  name = 'textrank';
  private config: TextRankConfig;

  constructor(config: Partial<TextRankConfig> = {}) {
    this.config = { ...DEFAULT_TEXTRANK_CONFIG, ...config };
  }

  async process(input: SummarizationInput): Promise<SummarizationOutput> {
    const sentences = TextPreprocessor.splitIntoSentences(input.text);
    
    if (sentences.length <= 1) {
      return {
        text: input.text,
        sentences: TextPreprocessor.createProcessedSentences(sentences),
        metadata: { ...input.metadata, textrank_sentences: sentences.length },
      };
    }

    // Build similarity matrix
    const similarityMatrix = this.buildSimilarityMatrix(sentences);
    
    // Apply PageRank algorithm
    const scores = this.pageRank(similarityMatrix);
    
    // Create processed sentences with scores
    const processedSentences = sentences.map((sentence, index) => ({
      text: sentence,
      index,
      score: scores[index],
      keywords: TextPreprocessor.tokenize(sentence).filter(word => word.length > 3),
      position: index / (sentences.length - 1 || 1),
    }));

    // Sort by score and select top sentences
    const targetLength = this.calculateTargetLength(input, sentences.length);
    const topSentences = this.selectTopSentences(processedSentences, targetLength);
    
    // Reorder by original position
    const orderedSentences = topSentences.sort((a, b) => a.index - b.index);
    const summaryText = orderedSentences.map(s => s.text).join(' ');

    return {
      text: summaryText,
      sentences: processedSentences,
      scores: Object.fromEntries(scores.map((score, index) => [index.toString(), score])),
      metadata: {
        ...input.metadata,
        textrank_original_sentences: sentences.length,
        textrank_selected_sentences: topSentences.length,
        textrank_compression_ratio: summaryText.length / input.text.length,
      },
    };
  }

  private buildSimilarityMatrix(sentences: string[]): number[][] {
    const matrix: number[][] = [];
    
    for (let i = 0; i < sentences.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < sentences.length; j++) {
        if (i === j) {
          matrix[i][j] = 0;
        } else {
          matrix[i][j] = this.calculateSentenceSimilarity(sentences[i], sentences[j]);
        }
      }
    }

    return matrix;
  }

  private calculateSentenceSimilarity(sentence1: string, sentence2: string): number {
    const tokens1 = new Set(TextPreprocessor.tokenize(sentence1));
    const tokens2 = new Set(TextPreprocessor.tokenize(sentence2));

    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    const intersection = new Set(Array.from(tokens1).filter(token => tokens2.has(token)));
    const union = new Set([...Array.from(tokens1), ...Array.from(tokens2)]);

    return intersection.size / union.size;
  }

  private pageRank(similarityMatrix: number[][]): number[] {
    const n = similarityMatrix.length;
    let scores = new Array(n).fill(1.0);
    
    for (let iteration = 0; iteration < this.config.iterations; iteration++) {
      const newScores = new Array(n).fill(0);
      
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          if (i !== j && this.getOutDegree(similarityMatrix, j) > 0) {
            sum += (similarityMatrix[j][i] / this.getOutDegree(similarityMatrix, j)) * scores[j];
          }
        }
        newScores[i] = (1 - this.config.dampingFactor) + this.config.dampingFactor * sum;
      }
      
      // Check for convergence
      const maxDiff = Math.max(...newScores.map((score, i) => Math.abs(score - scores[i])));
      scores = newScores;
      
      if (maxDiff < this.config.convergenceThreshold) {
        break;
      }
    }

    return scores;
  }

  private getOutDegree(matrix: number[][], nodeIndex: number): number {
    return matrix[nodeIndex].reduce((sum, weight) => sum + weight, 0);
  }

  private calculateTargetLength(input: SummarizationInput, totalSentences: number): number {
    const options = input.options;
    
    if (options?.targetLength) {
      return Math.min(options.targetLength, totalSentences);
    }
    
    if (options?.compressionRatio) {
      return Math.max(1, Math.floor(totalSentences * options.compressionRatio));
    }

    // Default: select top 30% of sentences, minimum 1, maximum 10
    return Math.max(1, Math.min(10, Math.floor(totalSentences * 0.3)));
  }

  private selectTopSentences(sentences: ProcessedSentence[], targetLength: number): ProcessedSentence[] {
    return sentences
      .sort((a, b) => b.score - a.score)
      .slice(0, targetLength);
  }

  // Update configuration
  updateConfig(config: Partial<TextRankConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Get current configuration
  getConfig(): TextRankConfig {
    return { ...this.config };
  }
}