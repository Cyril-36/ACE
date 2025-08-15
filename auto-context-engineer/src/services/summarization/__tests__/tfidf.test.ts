// Unit tests for TF-IDF keyword extractor
import { describe, it, expect, beforeEach } from 'vitest';
import { TfIdfKeywordExtractor } from '../tfidf';
import { SummarizationInput } from '../types';

describe('TfIdfKeywordExtractor', () => {
  let extractor: TfIdfKeywordExtractor;

  beforeEach(() => {
    extractor = new TfIdfKeywordExtractor();
  });

  describe('basic functionality', () => {
    it('should create a TF-IDF extractor instance', () => {
      expect(extractor).toBeInstanceOf(TfIdfKeywordExtractor);
      expect(extractor.name).toBe('tfidf');
    });

    it('should handle empty text', async () => {
      const input: SummarizationInput = { text: '' };
      const result = await extractor.process(input);
      
      expect(result.text).toBe('');
      expect(result.keywords).toEqual([]);
    });

    it('should extract keywords from text', async () => {
      const input: SummarizationInput = {
        text: 'Machine learning algorithms are powerful tools for data analysis. ' +
              'These algorithms can process large datasets efficiently. ' +
              'Data scientists use machine learning for predictive modeling.',
        options: { targetLength: 5 }
      };

      const result = await extractor.process(input);
      
      expect(result.keywords).toBeDefined();
      expect(result.keywords!.length).toBeGreaterThan(0);
      expect(result.keywords!.length).toBeLessThanOrEqual(5);
      expect(result.metadata?.tfidf_keywords_extracted).toBeGreaterThan(0);
    });
  });

  describe('keyword extraction quality', () => {
    it('should extract relevant keywords', async () => {
      const input: SummarizationInput = {
        text: 'Artificial intelligence and machine learning are transforming technology. ' +
              'Deep learning neural networks enable complex pattern recognition. ' +
              'Natural language processing helps computers understand human language.',
        options: { targetLength: 8 }
      };

      const result = await extractor.process(input);
      
      // Should extract technical terms, not common words
      const keywords = result.keywords || [];
      expect(keywords.some((kw: any) => ['artificial', 'intelligence', 'machine', 'learning', 'neural', 'networks'].includes(kw))).toBe(true);
      
      // Should not extract stop words
      expect(keywords.some((kw: any) => ['the', 'and', 'are', 'is'].includes(kw))).toBe(false);
    });

    it('should filter out stop words', async () => {
      const input: SummarizationInput = {
        text: 'The quick brown fox jumps over the lazy dog and runs fast.',
      };

      const result = await extractor.process(input);
      const keywords = result.keywords || [];
      
      // Common stop words should not appear
      const stopWords = ['the', 'and', 'over'];
      const hasStopWords = keywords.some((kw: any) => stopWords.includes(kw));
      expect(hasStopWords).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should allow configuration updates', () => {
      const newConfig = { 
        minTermFreq: 2, 
        maxTermFreq: 0.7,
        stopWords: new Set(['custom', 'stop', 'word'])
      };
      extractor.updateConfig(newConfig);
      
      const config = extractor.getConfig();
      expect(config.minTermFreq).toBe(2);
      expect(config.maxTermFreq).toBe(0.7);
      expect(config.stopWords.has('custom')).toBe(true);
    });

    it('should allow adding custom stop words', () => {
      extractor.addStopWords(['technical', 'jargon']);
      const config = extractor.getConfig();
      
      expect(config.stopWords.has('technical')).toBe(true);
      expect(config.stopWords.has('jargon')).toBe(true);
    });

    it('should allow removing stop words', () => {
      extractor.removeStopWords(['the', 'and']);
      const config = extractor.getConfig();
      
      expect(config.stopWords.has('the')).toBe(false);
      expect(config.stopWords.has('and')).toBe(false);
    });
  });

  describe('advanced features', () => {
    it('should extract keywords with scores', () => {
      const text = 'Data science involves statistical analysis and machine learning. ' +
                   'Statistical methods help analyze data patterns effectively.';
      
      const keywordsWithScores = extractor.extractKeywordsWithScores(text, 5);
      
      expect(keywordsWithScores).toBeInstanceOf(Array);
      expect(keywordsWithScores.length).toBeGreaterThan(0);
      expect(keywordsWithScores[0]).toHaveProperty('keyword');
      expect(keywordsWithScores[0]).toHaveProperty('score');
      expect(typeof keywordsWithScores[0].score).toBe('number');
    });

    it('should extract n-gram keywords', () => {
      const text = 'Machine learning algorithms process big data efficiently. ' +
                   'Deep learning networks analyze complex patterns in data.';
      
      const bigrams = extractor.extractNGramKeywords(text, 2, 3);
      
      expect(bigrams).toBeInstanceOf(Array);
      expect(bigrams.length).toBeGreaterThan(0);
      expect(bigrams.some((bg: any) => bg.includes(' '))).toBe(true); // Should contain multi-word phrases
    });
  });

  describe('sentence enhancement', () => {
    it('should enhance sentences with keyword information', async () => {
      const input: SummarizationInput = {
        text: 'Artificial intelligence is revolutionizing healthcare. ' +
              'Machine learning helps doctors diagnose diseases faster.',
        metadata: {
          sentences: [
            { text: 'Artificial intelligence is revolutionizing healthcare.', index: 0, score: 0, keywords: [], position: 0 },
            { text: 'Machine learning helps doctors diagnose diseases faster.', index: 1, score: 0, keywords: [], position: 1 }
          ]
        }
      };

      const result = await extractor.process(input);
      
      expect(result.sentences).toBeDefined();
      if (result.sentences) {
        expect(result.sentences[0].keywords).toBeDefined();
        expect(result.sentences[1].keywords).toBeDefined();
      }
    });
  });

  describe('edge cases', () => {
    it('should handle single word text', async () => {
      const input: SummarizationInput = { text: 'Hello' };
      const result = await extractor.process(input);
      
      expect(result.keywords).toBeDefined();
    });

    it('should handle text with only stop words', async () => {
      const input: SummarizationInput = { text: 'The and or but is are was were' };
      const result = await extractor.process(input);
      
      expect(result.keywords).toEqual([]);
    });

    it('should handle text with repeated words', async () => {
      // Use a more lenient extractor for repeated words
      const lenientExtractor = new TfIdfKeywordExtractor({
        maxTermFreq: 1.0, // Allow all frequencies
        minTermFreq: 1,   // Allow single occurrences
        maxDocFreq: 1.0,  // Allow words that appear in all documents
        stopWords: new Set() // Remove all stop words to ensure our test words aren't filtered
      });
      
      const input: SummarizationInput = { 
        text: 'Data data data analysis analysis processing processing processing' 
      };
      const result = await lenientExtractor.process(input);
      
      expect(result.keywords).toBeDefined();
      expect(result.keywords!.length).toBeGreaterThan(0);
    });
  });

  describe('frequency filtering', () => {
    it('should respect minimum term frequency', () => {
      const customExtractor = new TfIdfKeywordExtractor({
        minTermFreq: 3 // Require words to appear at least 3 times
      });

      const text = 'word appears once. another appears twice twice. frequent appears three three three times.';
      const keywords = customExtractor.extractKeywordsWithScores(text, 10);
      
      // Only 'three' should meet the minimum frequency requirement (appears 3 times)
      expect(keywords.some((kw: any) => kw.keyword === 'three')).toBe(true);
      expect(keywords.some((kw: any) => kw.keyword === 'frequent')).toBe(false); // Appears only once
      expect(keywords.some((kw: any) => kw.keyword === 'word')).toBe(false); // Appears only once
    });
  });
});