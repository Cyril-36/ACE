// Token counting utilities for different text types
export class TokenCounter {
  // Approximate token counting based on common tokenization patterns
  // This is a simplified version - in production, you might use tiktoken or similar
  
  private static readonly TOKENS_PER_WORD = 1.3; // Average tokens per word
  private static readonly TOKENS_PER_CHAR = 0.25; // For non-English text
  
  count(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0;
    }

    // Clean the text
    const cleanText = this.cleanText(text);
    
    // Count words and characters
    const words = this.countWords(cleanText);
    const chars = cleanText.length;
    
    // Estimate tokens based on content type
    if (this.isCodeLike(cleanText)) {
      return this.countCodeTokens(cleanText);
    } else if (this.isNonEnglish(cleanText)) {
      return Math.ceil(chars * TokenCounter.TOKENS_PER_CHAR);
    } else {
      return Math.ceil(words * TokenCounter.TOKENS_PER_WORD);
    }
  }

  // Count tokens for multiple texts
  countMultiple(texts: string[]): number {
    return texts.reduce((total, text) => total + this.count(text), 0);
  }

  // Estimate tokens for a conversation
  countConversation(messages: Array<{ role: string; content: string }>): number {
    let total = 0;
    
    messages.forEach(message => {
      // Add tokens for the message content
      total += this.count(message.content);
      
      // Add tokens for role and formatting (approximate)
      total += 4; // Role tokens and separators
    });
    
    // Add conversation overhead
    total += 3; // Conversation start/end tokens
    
    return total;
  }

  // Clean text for token counting
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Count words in text
  private countWords(text: string): number {
    if (!text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  }

  // Check if text looks like code
  private isCodeLike(text: string): boolean {
    const codeIndicators = [
      /function\s+\w+\s*\(/,
      /class\s+\w+/,
      /import\s+.*from/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /def\s+\w+\s*\(/,
      /public\s+class/,
      /private\s+\w+/,
      /#include\s*</,
      /\{\s*\n[\s\S]*\n\s*\}/,
    ];
    
    return codeIndicators.some(pattern => pattern.test(text));
  }

  // Check if text is primarily non-English
  private isNonEnglish(text: string): boolean {
    // Simple heuristic: if more than 30% of characters are non-ASCII
    const nonAsciiChars = text.match(/[^\u0020-\u007F]/g) || [];
    return text.length > 0 && nonAsciiChars.length / text.length > 0.3;
  }

  // Count tokens for code-like content
  private countCodeTokens(text: string): number {
    // Code typically has more tokens per word due to symbols and structure
    const words = this.countWords(text);
    const symbols = (text.match(/[{}()[\];,.:]/g) || []).length;
    const operators = (text.match(/[=+\-*/<>!&|]/g) || []).length;
    
    return Math.ceil(words * 1.5 + symbols * 0.5 + operators * 0.3);
  }

  // Get token count breakdown for debugging
  getTokenBreakdown(text: string): {
    total: number;
    words: number;
    characters: number;
    type: 'text' | 'code' | 'non-english';
    estimationMethod: string;
  } {
    const cleanText = this.cleanText(text);
    const words = this.countWords(cleanText);
    const characters = cleanText.length;
    
    let type: 'text' | 'code' | 'non-english' = 'text';
    let estimationMethod = 'words * 1.3';
    
    if (this.isCodeLike(cleanText)) {
      type = 'code';
      estimationMethod = 'code-specific counting';
    } else if (this.isNonEnglish(cleanText)) {
      type = 'non-english';
      estimationMethod = 'characters * 0.25';
    }
    
    return {
      total: this.count(text),
      words,
      characters,
      type,
      estimationMethod,
    };
  }

  // Estimate tokens needed for a summary of given compression ratio
  estimateSummaryTokens(originalTokens: number, compressionRatio: number): number {
    return Math.ceil(originalTokens * compressionRatio);
  }

  // Check if token count exceeds limit
  exceedsLimit(text: string, limit: number): boolean {
    return this.count(text) > limit;
  }

  // Truncate text to fit within token limit (approximate)
  truncateToTokenLimit(text: string, limit: number): string {
    const currentTokens = this.count(text);
    
    if (currentTokens <= limit) {
      return text;
    }
    
    // Binary search approach for more accurate truncation
    const words = text.split(' ');
    let left = 0;
    let right = words.length;
    let bestResult = text;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const candidate = words.slice(0, mid).join(' ') + '...';
      const candidateTokens = this.count(candidate);
      
      if (candidateTokens <= limit) {
        bestResult = candidate;
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    return bestResult;
  }
}