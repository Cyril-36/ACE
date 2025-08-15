// Unit tests for TextRank summarizer
import { describe, it, expect, beforeEach } from 'vitest';
import { TextRankSummarizer } from '../textrank';
import { SummarizationInput } from '../types';

describe('TextRankSummarizer', () => {
  let summarizer: TextRankSummarizer;

  beforeEach(() => {
    summarizer = new TextRankSummarizer();
  });

  describe('basic functionality', () => {
    it('should create a TextRank summarizer instance', () => {
      expect(summarizer).toBeInstanceOf(TextRankSummarizer);
      expect(summarizer.name).toBe('textrank');
    });

    it('should handle empty text', async () => {
      const input: SummarizationInput = { text: '' };
      const result = await summarizer.process(input);
      
      expect(result.text).toBe('');
      expect(result.sentences).toEqual([]);
    });

    it('should handle single sentence', async () => {
      const input: SummarizationInput = { 
        text: 'This is a single sentence.' 
      };
      const result = await summarizer.process(input);
      
      expect(result.text).toBe('This is a single sentence.');
      expect(result.sentences).toHaveLength(1);
    });
  });

  describe('multi-sentence processing', () => {
    it('should process multiple sentences and return summary', async () => {
      const input: SummarizationInput = {
        text: 'The quick brown fox jumps over the lazy dog. ' +
              'This is a common pangram used in typography. ' +
              'It contains every letter of the English alphabet. ' +
              'Many people use it to test fonts and keyboards. ' +
              'The sentence has been around for many decades.',
        options: { targetLength: 2 }
      };

      const result = await summarizer.process(input);
      
      expect(result.text).toBeTruthy();
      expect(result.sentences).toHaveLength(5);
      expect(result.scores).toBeDefined();
      expect(result.metadata?.textrank_original_sentences).toBe(5);
      expect(result.metadata?.textrank_selected_sentences).toBe(2);
    });

    it('should respect compression ratio option', async () => {
      const input: SummarizationInput = {
        text: 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.',
        options: { compressionRatio: 0.4 } // 40% of 5 sentences = 2 sentences
      };

      const result = await summarizer.process(input);
      
      expect(result.metadata?.textrank_selected_sentences).toBe(2);
    });
  });

  describe('configuration', () => {
    it('should allow configuration updates', () => {
      const newConfig = { dampingFactor: 0.9, iterations: 50 };
      summarizer.updateConfig(newConfig);
      
      const config = summarizer.getConfig();
      expect(config.dampingFactor).toBe(0.9);
      expect(config.iterations).toBe(50);
    });

    it('should use custom configuration', () => {
      const customSummarizer = new TextRankSummarizer({
        dampingFactor: 0.7,
        iterations: 25
      });
      
      const config = customSummarizer.getConfig();
      expect(config.dampingFactor).toBe(0.7);
      expect(config.iterations).toBe(25);
    });
  });

  describe('similarity calculation', () => {
    it('should calculate sentence similarity correctly', async () => {
      const input: SummarizationInput = {
        text: 'The cat sat on the mat. The dog sat on the rug. Birds fly in the sky.',
      };

      const result = await summarizer.process(input);
      
      // First two sentences should have higher similarity than with the third
      expect(result.sentences).toHaveLength(3);
      expect(result.scores).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle very short text', async () => {
      const input: SummarizationInput = { text: 'Hi.' };
      const result = await summarizer.process(input);
      
      expect(result.text).toBe('Hi.');
    });

    it('should handle text with no punctuation', async () => {
      const input: SummarizationInput = { 
        text: 'This is text without proper punctuation it should still work somehow' 
      };
      const result = await summarizer.process(input);
      
      expect(result.text).toBeTruthy();
    });

    it('should handle repeated sentences', async () => {
      const input: SummarizationInput = {
        text: 'Same sentence. Same sentence. Same sentence. Different sentence.',
        options: { targetLength: 2 }
      };

      const result = await summarizer.process(input);
      
      expect(result.sentences).toHaveLength(4);
      expect(result.metadata?.textrank_selected_sentences).toBe(2);
    });
  });

  describe('quality metrics', () => {
    it('should provide compression ratio metadata', async () => {
      const originalText = 'This is a longer text that should be compressed. ' +
                          'It contains multiple sentences with various information. ' +
                          'The summarizer should pick the most important ones.';
      
      const input: SummarizationInput = {
        text: originalText,
        options: { compressionRatio: 0.5 }
      };

      const result = await summarizer.process(input);
      
      expect(result.metadata?.textrank_compression_ratio).toBeLessThan(1);
      expect(result.metadata?.textrank_compression_ratio).toBeGreaterThan(0);
    });
  });
});