// Cloud service fallback mechanisms for API failures
import { globalErrorHandler } from '../error/errorHandler';
import { ErrorCode } from '../../types';

export interface CloudProvider {
  id: string;
  name: string;
  available: boolean;
  priority: number;
  summarize(text: string, options?: SummarizationOptions): Promise<SummarizationResult>;
  checkHealth(): Promise<boolean>;
}

export interface SummarizationOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  quality?: 'fast' | 'balanced' | 'quality';
}

export interface SummarizationResult {
  summary: string;
  method: string;
  tokens: number;
  cost?: number;
  quality?: number;
  metadata?: Record<string, unknown>;
}

interface CloudAPIClient {
  summarize(text: string, options?: SummarizationOptions): Promise<SummarizationResult>;
}

export class LocalSummarizationProvider implements CloudProvider {
  id = 'local';
  name = 'Local Processing';
  available = true;
  priority = 10; // Lowest priority - fallback only

  async summarize(text: string, options?: SummarizationOptions): Promise<SummarizationResult> {
    // Simple extractive summarization using sentence ranking
    const sentences = this.splitIntoSentences(text);
    const scores = this.scoreSentences(sentences, text);
    
    // Simulate async operation
    await Promise.resolve();
    
    const maxSentences = Math.min(
      Math.ceil(sentences.length * 0.3), // 30% of original
      options?.maxTokens ? Math.floor(options.maxTokens / 20) : 5 // Rough token estimate
    );
    
    const topSentences = scores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSentences)
      .sort((a, b) => a.index - b.index) // Maintain original order
      .map(item => item.sentence);
    
    const summary = topSentences.join(' ');
    
    return {
      summary,
      method: 'local',
      tokens: this.estimateTokens(summary),
      cost: 0,
      quality: 0.6, // Local processing has lower quality
      metadata: {
        originalSentences: sentences.length,
        selectedSentences: topSentences.length,
        compressionRatio: summary.length / text.length,
      },
    };
  }

  async checkHealth(): Promise<boolean> {
    await Promise.resolve(); // Simulate async check
    return true; // Local processing is always available
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter out very short sentences
  }

  private scoreSentences(sentences: string[], fullText: string): Array<{
    sentence: string;
    score: number;
    index: number;
  }> {
    const words = fullText.toLowerCase().split(/\s+/);
    const wordFreq = this.calculateWordFrequency(words);
    
    return sentences.map((sentence, index) => {
      const sentenceWords = sentence.toLowerCase().split(/\s+/);
      const score = sentenceWords.reduce((sum, word) => {
        return sum + (wordFreq[word] || 0);
      }, 0) / sentenceWords.length;
      
      return { sentence, score, index };
    });
  }

  private calculateWordFrequency(words: string[]): Record<string, number> {
    const freq: Record<string, number> = {};
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);
    
    words.forEach((word: any) => {
      const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
      if (cleanWord.length > 2 && !stopWords.has(cleanWord)) {
        freq[cleanWord] = (freq[cleanWord] || 0) + 1;
      }
    });
    
    return freq;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}

export class CloudProviderWrapper implements CloudProvider {
  constructor(
    public id: string,
    public name: string,
    public priority: number,
    private apiClient: CloudAPIClient, // Actual API client
    private healthCheckFn: () => Promise<boolean>
  ) {}

  get available(): boolean {
    return !!this.apiClient;
  }

  async summarize(text: string, options?: SummarizationOptions): Promise<SummarizationResult> {
    if (!this.available) {
      throw new Error(`${this.name} provider not available`);
    }

    try {
      // This would call the actual API client
      const result = await this.apiClient.summarize(text, options);
      return {
        ...result,
        method: this.id,
      };
    } catch (error) {
      throw new Error(`${this.name} summarization failed: ${(error as Error).message}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    if (!this.available) return false;
    
    try {
      return await this.healthCheckFn();
    } catch {
      return false;
    }
  }
}

export class CloudFallbackService {
  private providers: CloudProvider[] = [];
  private healthCheckInterval?: NodeJS.Timeout;
  private healthStatus = new Map<string, boolean>();

  constructor() {
    this.initializeProviders();
    this.startHealthChecks();
  }

  /**
   * Add a cloud provider
   */
  addProvider(provider: CloudProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Summarize text with automatic fallback
   */
  async summarize(text: string, options?: SummarizationOptions): Promise<SummarizationResult> {
    const availableProviders = this.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      throw new Error('No summarization providers available');
    }

    let lastError: Error | null = null;

    for (const provider of availableProviders) {
      try {
        const result = await provider.summarize(text, options);
        
        // Track successful usage
        await globalErrorHandler.handleError(
          globalErrorHandler.createError(
            ErrorCode.PROCESSING_ERROR,
            `Successfully used ${provider.name} for summarization`,
            undefined,
            true,
            { provider: provider.id, fallback: provider.priority > 1 }
          ),
          {
            component: 'CloudFallbackService',
            operation: 'summarize',
            metadata: { provider: provider.id, success: true },
          }
        );

        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Mark provider as unhealthy temporarily
        this.healthStatus.set(provider.id, false);
        
        await globalErrorHandler.handleError(error as Error, {
          component: 'CloudFallbackService',
          operation: 'summarize',
          metadata: { 
            provider: provider.id, 
            text: text.substring(0, 100) + '...',
            willRetry: availableProviders.indexOf(provider) < availableProviders.length - 1
          },
        });

        // Continue to next provider
        continue;
      }
    }

    // All providers failed
    throw new Error(`All summarization providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Get provider statistics
   */
  getProviderStats(): Array<{
    id: string;
    name: string;
    available: boolean;
    healthy: boolean;
    priority: number;
  }> {
    return this.providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      available: provider.available,
      healthy: this.healthStatus.get(provider.id) ?? false,
      priority: provider.priority,
    }));
  }

  /**
   * Force health check for all providers
   */
  async checkAllProviders(): Promise<void> {
    const checks = this.providers.map(async (provider: any) => {
      try {
        const healthy = await provider.checkHealth();
        this.healthStatus.set(provider.id, healthy);
      } catch (error) {
        this.healthStatus.set(provider.id, false);
        console.warn(`Health check failed for ${provider._name}:`, error);
      }
    });

    await Promise.all(checks);
  }

  /**
   * Get the best available provider
   */
  getBestProvider(): CloudProvider | null {
    const available = this.getAvailableProviders();
    return available.length > 0 ? available[0] : null;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  private initializeProviders(): void {
    // Add local provider as fallback
    this.addProvider(new LocalSummarizationProvider());
  }

  private getAvailableProviders(): CloudProvider[] {
    return this.providers
      .filter(provider => 
        provider.available && 
        (this.healthStatus.get(provider.id) !== false) // Include unknown status
      )
      .sort((a, b) => a.priority - b.priority);
  }

  private startHealthChecks(): void {
    // Check provider health every 5 minutes
    this.healthCheckInterval = setInterval(() => {
      void this.checkAllProviders();
    }, 5 * 60 * 1000);

    // Initial health check
    void this.checkAllProviders();
  }
}

// Global cloud fallback service
export const globalCloudFallback = new CloudFallbackService();