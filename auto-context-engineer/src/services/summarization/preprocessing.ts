// Text preprocessing utilities for summarization
import { ProcessedSentence } from './types';

export class TextPreprocessor {
  // Split text into sentences
  static splitIntoSentences(text: string): string[] {
    // Enhanced sentence splitting that handles common abbreviations
    const abbreviations = new Set([
      'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Inc', 'Ltd', 'Corp', 'Co',
      'vs', 'etc', 'i.e', 'e.g', 'cf', 'al', 'Jr', 'Sr'
    ]);

    // First, protect abbreviations
    let processedText = text;
    abbreviations.forEach(abbr => {
      const regex = new RegExp(`\\b${abbr}\\.`, 'gi');
      processedText = processedText.replace(regex, `${abbr}<!PERIOD!>`);
    });

    // Split on sentence boundaries
    const sentences = processedText
      .split(/[.!?]+\s+/)
      .map(sentence => sentence.replace(/<!PERIOD!>/g, '.').trim())
      .filter(sentence => sentence.length > 0);

    return sentences;
  }

  // Tokenize text into words
  static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  // Remove stop words
  static removeStopWords(tokens: string[], stopWords: Set<string>): string[] {
    return tokens.filter(token => !stopWords.has(token));
  }

  // Calculate word frequencies
  static calculateWordFrequencies(tokens: string[]): Map<string, number> {
    const frequencies = new Map<string, number>();
    
    tokens.forEach(token => {
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    });

    return frequencies;
  }

  // Normalize word frequencies
  static normalizeFrequencies(frequencies: Map<string, number>): Map<string, number> {
    const maxFreq = Math.max(...Array.from(frequencies.values()));
    const normalized = new Map<string, number>();

    frequencies.forEach((freq, word) => {
      normalized.set(word, freq / maxFreq);
    });

    return normalized;
  }

  // Create processed sentences with metadata
  static createProcessedSentences(sentences: string[]): ProcessedSentence[] {
    return sentences.map((sentence, index) => ({
      text: sentence,
      index,
      score: 0, // Will be calculated by scoring stages
      keywords: this.extractKeywordsFromSentence(sentence),
      position: index / (sentences.length - 1 || 1), // Normalize position 0-1
    }));
  }

  // Extract keywords from a single sentence
  private static extractKeywordsFromSentence(sentence: string): string[] {
    const tokens = this.tokenize(sentence);
    // Simple keyword extraction - can be enhanced with more sophisticated methods
    return tokens.filter(token => token.length > 3); // Words longer than 3 characters
  }

  // Calculate sentence similarity using Jaccard coefficient
  static calculateSentenceSimilarity(sentence1: string, sentence2: string): number {
    const tokens1 = new Set(this.tokenize(sentence1));
    const tokens2 = new Set(this.tokenize(sentence2));

    const intersection = new Set(Array.from(tokens1).filter(token => tokens2.has(token)));
    const union = new Set([...Array.from(tokens1), ...Array.from(tokens2)]);

    return intersection.size / union.size;
  }

  // Calculate TF-IDF scores for terms in a document
  static calculateTfIdf(
    documents: string[], 
    termFrequencies: Map<string, number>
  ): Map<string, number> {
    const tfidfScores = new Map<string, number>();
    const totalDocs = documents.length;

    termFrequencies.forEach((tf, term) => {
      // Calculate document frequency
      const df = documents.filter(doc => 
        this.tokenize(doc).includes(term)
      ).length;

      // Calculate IDF
      const idf = Math.log(totalDocs / (df + 1)); // +1 to avoid division by zero

      // Calculate TF-IDF
      tfidfScores.set(term, tf * idf);
    });

    return tfidfScores;
  }

  // Clean and normalize text
  static cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.!?]/g, '') // Remove special characters except sentence endings
      .trim();
  }

  // Extract n-grams from text
  static extractNGrams(tokens: string[], n: number): string[] {
    const ngrams: string[] = [];
    
    for (let i = 0; i <= tokens.length - n; i++) {
      const ngram = tokens.slice(i, i + n).join(' ');
      ngrams.push(ngram);
    }

    return ngrams;
  }

  // Calculate readability score (simplified Flesch Reading Ease)
  static calculateReadabilityScore(text: string): number {
    const sentences = this.splitIntoSentences(text);
    const words = this.tokenize(text);
    const syllables = words.reduce((total, word) => total + this.countSyllables(word), 0);

    if (sentences.length === 0 || words.length === 0) return 0;

    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    // Simplified Flesch Reading Ease formula
    return 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  }

  // Count syllables in a word (simplified)
  private static countSyllables(word: string): number {
    const vowels = 'aeiouy';
    let count = 0;
    let previousWasVowel = false;

    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i].toLowerCase());
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }

    // Handle silent 'e'
    if (word.endsWith('e') && count > 1) {
      count--;
    }

    return Math.max(1, count); // Every word has at least one syllable
  }
}