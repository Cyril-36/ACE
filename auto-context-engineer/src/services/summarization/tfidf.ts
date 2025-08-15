// TF-IDF keyword extraction implementation
import {
  SummarizationStage,
  SummarizationInput,
  SummarizationOutput,
  TfIdfConfig,
  DEFAULT_TFIDF_CONFIG,
  ProcessedSentence
} from './types';
import { TextPreprocessor } from './preprocessing';

export class TfIdfKeywordExtractor implements SummarizationStage {
  name = 'tfidf';
  private config: TfIdfConfig;

  constructor(config: Partial<TfIdfConfig> = {}) {
    this.config = { 
      ...DEFAULT_TFIDF_CONFIG, 
      ...config,
      stopWords: config.stopWords || DEFAULT_TFIDF_CONFIG.stopWords
    };
  }

  async process(input: SummarizationInput): Promise<SummarizationOutput> {
    const sentences = TextPreprocessor.splitIntoSentences(input.text);
    
    if (sentences.length === 0) {
      return {
        text: input.text,
        keywords: [],
        metadata: { ...input.metadata, tfidf_keywords_extracted: 0 },
      };
    }

    // Extract keywords using TF-IDF
    const keywords = this.extractKeywords(sentences, input.options?.targetLength || 10);
    
    // Enhance existing sentences with keyword information if available
    const existingSentences = input.metadata?.sentences as ProcessedSentence[] || [];
    const enhancedSentences = existingSentences.map(sentence => ({
      ...sentence,
      keywords: this.extractSentenceKeywords(sentence.text, keywords),
    }));

    return {
      text: input.text,
      sentences: enhancedSentences.length > 0 ? enhancedSentences : undefined,
      keywords,
      metadata: {
        ...input.metadata,
        tfidf_keywords_extracted: keywords.length,
        tfidf_total_terms: this.getTotalTermCount(sentences),
      },
    };
  }

  private extractKeywords(sentences: string[], maxKeywords: number): string[] {
    // Tokenize all sentences
    const allTokens: string[] = [];
    const documentTokens: string[][] = [];

    sentences.forEach(sentence => {
      const tokens = TextPreprocessor.removeStopWords(
        TextPreprocessor.tokenize(sentence),
        this.config.stopWords
      );
      documentTokens.push(tokens);
      allTokens.push(...tokens);
    });

    // Calculate term frequencies
    const termFrequencies = TextPreprocessor.calculateWordFrequencies(allTokens);
    
    // Filter terms based on frequency thresholds
    const filteredTerms = this.filterTermsByFrequency(termFrequencies, sentences.length);
    
    // Calculate TF-IDF scores
    const tfidfScores = this.calculateTfIdfScores(filteredTerms, documentTokens);
    
    // Sort by TF-IDF score and return top keywords
    return Array.from(tfidfScores.entries())
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .slice(0, maxKeywords)
      .map(([term]) => term);
  }

  private filterTermsByFrequency(
    termFrequencies: Map<string, number>, 
    _totalDocuments: number
  ): Map<string, number> {
    const filtered = new Map<string, number>();
    const totalTerms = Array.from(termFrequencies.values()).reduce((sum, freq) => sum + freq, 0);

    termFrequencies.forEach((freq, term) => {
      const termFreqRatio = freq / totalTerms;
      
      // Filter by term frequency thresholds
      if (freq >= this.config.minTermFreq && 
          termFreqRatio <= this.config.maxTermFreq &&
          term.length > 2) { // Minimum term length
        filtered.set(term, freq);
      }
    });

    return filtered;
  }

  private calculateTfIdfScores(
    termFrequencies: Map<string, number>,
    documentTokens: string[][]
  ): Map<string, number> {
    const tfidfScores = new Map<string, number>();
    const totalDocuments = documentTokens.length;

    termFrequencies.forEach((tf, term) => {
      // Calculate document frequency (number of documents containing the term)
      const df = documentTokens.filter(docTokens => docTokens.includes(term)).length;
      
      // Skip terms that appear in too many or too few documents
      const docFreqRatio = df / totalDocuments;
      if (docFreqRatio < this.config.minDocFreq / totalDocuments || 
          docFreqRatio > this.config.maxDocFreq) {
        return;
      }

      // Calculate IDF (Inverse Document Frequency)
      const idf = Math.log(totalDocuments / df);
      
      // Calculate normalized TF
      const maxTf = Math.max(...Array.from(termFrequencies.values()));
      const normalizedTf = tf / maxTf;
      
      // Calculate TF-IDF score
      const tfidfScore = normalizedTf * idf;
      tfidfScores.set(term, tfidfScore);
    });

    return tfidfScores;
  }

  private extractSentenceKeywords(sentence: string, globalKeywords: string[]): string[] {
    const sentenceTokens = new Set(
      TextPreprocessor.removeStopWords(
        TextPreprocessor.tokenize(sentence),
        this.config.stopWords
      )
    );

    return globalKeywords.filter(keyword => sentenceTokens.has(keyword));
  }

  private getTotalTermCount(sentences: string[]): number {
    return sentences.reduce((total, sentence) => {
      const tokens = TextPreprocessor.removeStopWords(
        TextPreprocessor.tokenize(sentence),
        this.config.stopWords
      );
      return total + tokens.length;
    }, 0);
  }

  // Extract keywords with scores
  extractKeywordsWithScores(text: string, maxKeywords: number = 10): Array<{ keyword: string; score: number }> {
    const sentences = TextPreprocessor.splitIntoSentences(text);
    const documentTokens: string[][] = [];

    sentences.forEach(sentence => {
      const tokens = TextPreprocessor.removeStopWords(
        TextPreprocessor.tokenize(sentence),
        this.config.stopWords
      );
      documentTokens.push(tokens);
    });

    const allTokens = documentTokens.flat();
    const termFrequencies = TextPreprocessor.calculateWordFrequencies(allTokens);
    const filteredTerms = this.filterTermsByFrequency(termFrequencies, sentences.length);
    const tfidfScores = this.calculateTfIdfScores(filteredTerms, documentTokens);

    return Array.from(tfidfScores.entries())
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .slice(0, maxKeywords)
      .map(([keyword, score]) => ({ keyword, score }));
  }

  // Extract n-gram keywords
  extractNGramKeywords(text: string, n: number = 2, maxKeywords: number = 5): string[] {
    const sentences = TextPreprocessor.splitIntoSentences(text);
    const ngramFrequencies = new Map<string, number>();

    sentences.forEach(sentence => {
      const tokens = TextPreprocessor.removeStopWords(
        TextPreprocessor.tokenize(sentence),
        this.config.stopWords
      );
      
      const ngrams = TextPreprocessor.extractNGrams(tokens, n);
      ngrams.forEach(ngram => {
        ngramFrequencies.set(ngram, (ngramFrequencies.get(ngram) || 0) + 1);
      });
    });

    return Array.from(ngramFrequencies.entries())
      .sort(([, freqA], [, freqB]) => freqB - freqA)
      .slice(0, maxKeywords)
      .map(([ngram]) => ngram);
  }

  // Update configuration
  updateConfig(config: Partial<TfIdfConfig>): void {
    this.config = { 
      ...this.config, 
      ...config,
      stopWords: config.stopWords || this.config.stopWords
    };
  }

  // Get current configuration
  getConfig(): TfIdfConfig {
    return { 
      ...this.config,
      stopWords: new Set(this.config.stopWords) // Return a copy
    };
  }

  // Add custom stop words
  addStopWords(words: string[]): void {
    words.forEach(word => this.config.stopWords.add(word.toLowerCase()));
  }

  // Remove stop words
  removeStopWords(words: string[]): void {
    words.forEach(word => this.config.stopWords.delete(word.toLowerCase()));
  }
}