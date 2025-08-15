// Token Counter Tests
import { describe, it, expect } from 'vitest';
import { TokenCounter } from '../tokenCounter';

describe('TokenCounter', () => {
  let tokenCounter: TokenCounter;

  beforeEach(() => {
    tokenCounter = new TokenCounter();
  });

  describe('Basic Token Counting', () => {
    it('should count tokens for simple text', () => {
      const text = 'Hello world, how are you today?';
      const count = tokenCounter.count(text);
      
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(20); // Should be reasonable
    });

    it('should return 0 for empty text', () => {
      expect(tokenCounter.count('')).toBe(0);
      expect(tokenCounter.count('   ')).toBe(0);
      expect(tokenCounter.count('\n\t')).toBe(0);
    });

    it('should handle null and undefined', () => {
      expect(tokenCounter.count(null as unknown as string)).toBe(0);
      expect(tokenCounter.count(undefined as unknown as string)).toBe(0);
    });

    it('should count tokens for longer text', () => {
      const longText = `
        This is a longer piece of text that contains multiple sentences.
        It should have a reasonable token count that reflects the content length.
        The token counter should handle this appropriately.
      `;
      
      const count = tokenCounter.count(longText);
      expect(count).toBeGreaterThan(20);
      expect(count).toBeLessThan(50);
    });
  });

  describe('Code Token Counting', () => {
    it('should detect and count code tokens', () => {
      const codeText = `
        function hello(name) {
          console.log("Hello, " + name);
          return true;
        }
      `;
      
      const count = tokenCounter.count(codeText);
      expect(count).toBeGreaterThan(10);
      
      // Code should generally have more tokens than regular text
      const regularText = 'function hello name console log Hello return true';
      const regularCount = tokenCounter.count(regularText);
      expect(count).toBeGreaterThan(regularCount);
    });

    it('should handle different programming languages', () => {
      const jsCode = 'const x = 5; function test() { return x; }';
      const pythonCode = 'def test(): x = 5; return x';
      const javaCode = 'public class Test { private int x = 5; }';
      
      expect(tokenCounter.count(jsCode)).toBeGreaterThan(0);
      expect(tokenCounter.count(pythonCode)).toBeGreaterThan(0);
      expect(tokenCounter.count(javaCode)).toBeGreaterThan(0);
    });
  });

  describe('Non-English Text', () => {
    it('should handle non-English text', () => {
      const chineseText = '你好世界，今天天气怎么样？';
      const spanishText = 'Hola mundo, ¿cómo estás hoy?';
      const arabicText = 'مرحبا بالعالم، كيف حالك اليوم؟';
      
      expect(tokenCounter.count(chineseText)).toBeGreaterThan(0);
      expect(tokenCounter.count(spanishText)).toBeGreaterThan(0);
      expect(tokenCounter.count(arabicText)).toBeGreaterThan(0);
    });

    it('should use character-based counting for non-English', () => {
      const chineseText = '你好世界';
      const count = tokenCounter.count(chineseText);
      
      // Should be roughly based on character count
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(10);
    });
  });

  describe('Multiple Text Counting', () => {
    it('should count tokens for multiple texts', () => {
      const texts = [
        'Hello world',
        'How are you?',
        'This is a test'
      ];
      
      const totalCount = tokenCounter.countMultiple(texts);
      const individualSum = texts.reduce((sum, text) => sum + tokenCounter.count(text), 0);
      
      expect(totalCount).toBe(individualSum);
    });

    it('should handle empty array', () => {
      expect(tokenCounter.countMultiple([])).toBe(0);
    });
  });

  describe('Conversation Token Counting', () => {
    it('should count tokens for conversation messages', () => {
      const messages = [
        { role: 'user', content: 'Hello, how are you?' },
        { role: 'assistant', content: 'I am doing well, thank you!' },
        { role: 'user', content: 'Can you help me with coding?' }
      ];
      
      const count = tokenCounter.countConversation(messages);
      expect(count).toBeGreaterThan(0);
      
      // Should include overhead for roles and formatting
      const contentOnlyCount = tokenCounter.countMultiple(messages.map((m: any) => m.content));
      expect(count).toBeGreaterThan(contentOnlyCount);
    });

    it('should handle empty conversation', () => {
      expect(tokenCounter.countConversation([])).toBe(3); // Just overhead
    });
  });

  describe('Token Breakdown', () => {
    it('should provide detailed token breakdown', () => {
      const text = 'Hello world, this is a test message.';
      const breakdown = tokenCounter.getTokenBreakdown(text);
      
      expect(breakdown).toHaveProperty('total');
      expect(breakdown).toHaveProperty('words');
      expect(breakdown).toHaveProperty('characters');
      expect(breakdown).toHaveProperty('type');
      expect(breakdown).toHaveProperty('estimationMethod');
      
      expect(breakdown.total).toBeGreaterThan(0);
      expect(breakdown.words).toBeGreaterThan(0);
      expect(breakdown.characters).toBeGreaterThan(0);
      expect(['text', 'code', 'non-english']).toContain(breakdown.type);
    });

    it('should identify code type correctly', () => {
      const codeText = 'function test() { return true; }';
      const breakdown = tokenCounter.getTokenBreakdown(codeText);
      
      expect(breakdown.type).toBe('code');
    });

    it('should identify non-English type correctly', () => {
      const nonEnglishText = '你好世界，这是一个测试消息。';
      const breakdown = tokenCounter.getTokenBreakdown(nonEnglishText);
      
      expect(breakdown.type).toBe('non-english');
    });
  });

  describe('Utility Methods', () => {
    it('should estimate summary tokens', () => {
      const originalTokens = 1000;
      const compressionRatio = 0.3;
      
      const estimatedTokens = tokenCounter.estimateSummaryTokens(originalTokens, compressionRatio);
      expect(estimatedTokens).toBe(300);
    });

    it('should check if text exceeds limit', () => {
      const shortText = 'Hello world';
      const longText = 'This is a much longer text that contains many more words and should exceed a small token limit for testing purposes.';
      
      expect(tokenCounter.exceedsLimit(shortText, 100)).toBe(false);
      expect(tokenCounter.exceedsLimit(longText, 5)).toBe(true);
    });

    it('should truncate text to token limit', () => {
      const longText = 'This is a very long text that needs to be truncated to fit within a specific token limit for testing purposes.';
      const truncated = tokenCounter.truncateToTokenLimit(longText, 10);
      
      expect(truncated.length).toBeLessThan(longText.length);
      expect(truncated).toMatch(/\.\.\.$/); // Should end with ellipsis
      expect(tokenCounter.count(truncated)).toBeLessThanOrEqual(10);
    });

    it('should not truncate text that fits within limit', () => {
      const shortText = 'Hello world';
      const result = tokenCounter.truncateToTokenLimit(shortText, 100);
      
      expect(result).toBe(shortText);
    });

    it('should truncate at word boundaries', () => {
      const text = 'This is a test message that should be truncated properly';
      const truncated = tokenCounter.truncateToTokenLimit(text, 5);
      
      // Should be truncated and end with ellipsis
      expect(truncated.length).toBeLessThan(text.length);
      expect(truncated).toMatch(/\.\.\.$/);
      expect(tokenCounter.count(truncated)).toBeLessThanOrEqual(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long text', () => {
      const veryLongText = 'word '.repeat(10000);
      const count = tokenCounter.count(veryLongText);
      
      expect(count).toBeGreaterThan(10000);
      expect(count).toBeLessThan(20000);
    });

    it('should handle text with special characters', () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const count = tokenCounter.count(specialText);
      
      expect(count).toBeGreaterThan(0);
    });

    it('should handle mixed content', () => {
      const mixedText = `
        Here is some regular text.
        
        function example() {
          return "Hello, 世界!";
        }
        
        And some more regular text with émojis 🚀 and symbols!
      `;
      
      const count = tokenCounter.count(mixedText);
      expect(count).toBeGreaterThan(0);
    });

    it('should handle whitespace-only text', () => {
      const whitespaceText = '   \n\t   \r\n   ';
      expect(tokenCounter.count(whitespaceText)).toBe(0);
    });
  });
});