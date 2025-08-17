// Search orchestrator for background service integration
import {
  BackgroundModule,
  BackgroundEvent,
  BackgroundEventType,
  ContextAggregate,
} from '../background/types';
import { EventBus } from '../background/eventBus';
import { FullTextSearchService } from '../search';
import { IndexedDBStorageService } from '../storage';
import { Context, SearchQuery, SearchResult, ContextSource } from '../../types';
import { Summary } from '../../types/index';

export interface SearchOrchestratorConfig {
  autoIndex: boolean;
  indexingDelay: number; // ms
  maxConcurrentSearches: number;
  enablePerformanceMonitoring: boolean;
}

interface IndexingQueueItem {
  contextId: string;
  content: string;
  metadata?: {
    source: ContextSource;
    timestamp: number;
    tags: string[];
    summary?: string;
    tokenCount: number;
    language?: string;
    platform?: string;
    retryCount?: number;
  };
}

interface SearchEventPayload {
  aggregate?: ContextAggregate;
  summary?: Summary;
}

export class SearchOrchestrator implements BackgroundModule {
  _name = 'SearchOrchestrator';
  
  private config: SearchOrchestratorConfig;
  private eventBus: EventBus;
  private searchService: FullTextSearchService;
  // private _storageService: IndexedDBStorageService;
  private indexingQueue: IndexingQueueItem[] = [];
  private activeSearches: Map<string, Promise<SearchResult[]>> = new Map();
  private indexingTimer?: NodeJS.Timeout;
  private metrics = {
    totalSearches: 0,
    totalIndexOperations: 0,
    avgSearchTime: 0,
    avgIndexTime: 0,
    lastActivity: Date.now(),
  };

  constructor(
    eventBus: EventBus,
    searchService?: FullTextSearchService,
    _storageService?: IndexedDBStorageService,
    config?: Partial<SearchOrchestratorConfig>
  ) {
    this.eventBus = eventBus;
    this.searchService = searchService || new FullTextSearchService();
    // this._storageService = storageService || new IndexedDBStorageService();
    this.config = {
      autoIndex: true,
      indexingDelay: 2000, // 2 seconds
      maxConcurrentSearches: 5,
      enablePerformanceMonitoring: true,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    // Initialize search service
    await this.searchService.initialize();
    
    // Register event handlers
    this.eventBus.on(BackgroundEventType.CONTEXT_AGGREGATED, this.handleContextAggregated.bind(this));
    this.eventBus.on(BackgroundEventType.SUMMARY_COMPLETED, this.handleSummaryCompleted.bind(this));
    this.eventBus.on(BackgroundEventType.STORAGE_WRITE, this.handleStorageWrite.bind(this));
    
    // Start indexing timer
    this.startIndexingTimer();
    
    console.log('[SearchOrchestrator] Initialized with config:', this.config);
  }

  async shutdown(): Promise<void> {
    // Clear indexing timer
    if (this.indexingTimer) {
      clearTimeout(this.indexingTimer);
    }
    
    // Process any remaining indexing queue
    await this.processIndexingQueue();
    
    // Wait for active searches to complete
    if (this.activeSearches.size > 0) {
      console.log(`[SearchOrchestrator] Waiting for ${this.activeSearches.size} active searches...`);
      await Promise.allSettled(this.activeSearches.values());
    }
    
    console.log('[SearchOrchestrator] Shutdown complete');
  }

  // Public search interface
  async search(query: SearchQuery, requestId?: string): Promise<SearchResult[]> {
    const searchId = requestId || this.generateSearchId();
    const startTime = Date.now();
    
    try {
      // Check concurrent search limit
      if (this.activeSearches.size >= this.config.maxConcurrentSearches) {
        throw new Error('Maximum concurrent searches exceeded');
      }
      
      // Perform search
      const searchPromise = this.searchService.search(query);
      this.activeSearches.set(searchId, searchPromise);
      
      const results = await searchPromise;
      
      // Update metrics
      if (this.config.enablePerformanceMonitoring) {
        this.updateSearchMetrics(Date.now() - startTime);
      }
      
      // Emit search completed event
      void this.eventBus.emit({
        _type: 'SEARCH_COMPLETED' as BackgroundEventType,
        payload: {
          searchId,
          query,
          resultCount: results.length,
          processingTime: Date.now() - startTime,
        },
      });
      
      return results;
      
    } catch (error) {
      console.error('[SearchOrchestrator] Search failed:', error);
      
      // Emit search failed event
      void this.eventBus.emit({
        _type: 'SEARCH_FAILED' as BackgroundEventType,
        payload: {
          searchId,
          query,
          error: (error as Error).message,
          processingTime: Date.now() - startTime,
        },
      });
      
      throw error;
      
    } finally {
      this.activeSearches.delete(searchId);
    }
  }

  // Manual indexing operations
  async indexContext(context: Context): Promise<void> {
    const startTime = Date.now();
    
    try {
      const metadata = {
        source: context.source,
        timestamp: context.timestamp.getTime(),
        tags: context.metadata.tags || [],
        tokenCount: context.metadata.tokenCount,
        language: context.metadata.language,
        platform: context.metadata.chatPlatform,
      };
      
      await this.searchService.indexContent(context.id, context.content, metadata);
      
      if (this.config.enablePerformanceMonitoring) {
        this.updateIndexMetrics(Date.now() - startTime);
      }
      
      console.log(`[SearchOrchestrator] Indexed context: ${context.id}`);
      
    } catch (error) {
      console.error('[SearchOrchestrator] Context indexing failed:', error);
      throw error;
    }
  }

  async indexSummary(summary: Summary): Promise<void> {
    const startTime = Date.now();
    
    try {
      const metadata = {
        source: ContextSource.MANUAL, // Summaries are manually generated
        timestamp: summary.timestamp,
        tags: ['summary'],
        summary: summary.content,
        tokenCount: summary.summaryLength,
      };
      
      await this.searchService.indexContent(summary.id, summary.content, metadata);
      
      if (this.config.enablePerformanceMonitoring) {
        this.updateIndexMetrics(Date.now() - startTime);
      }
      
      console.log(`[SearchOrchestrator] Indexed summary: ${summary.id}`);
      
    } catch (error) {
      console.error('[SearchOrchestrator] Summary indexing failed:', error);
      throw error;
    }
  }

  async removeFromIndex(contextId: string): Promise<void> {
    try {
      await this.searchService.removeFromIndex(contextId);
      console.log(`[SearchOrchestrator] Removed from index: ${contextId}`);
    } catch (error) {
      console.error('[SearchOrchestrator] Remove from index failed:', error);
      throw error;
    }
  }

  async rebuildIndex(): Promise<void> {
    try {
      console.log('[SearchOrchestrator] Starting index rebuild...');
      await this.searchService.rebuildIndex();
      console.log('[SearchOrchestrator] Index rebuild completed');
      
      // Emit rebuild completed event
      void this.eventBus.emit({
        _type: 'SEARCH_INDEX_REBUILT' as BackgroundEventType,
        payload: {
          timestamp: Date.now(),
          stats: await this.searchService.getSearchStats(),
        },
      });
      
    } catch (error) {
      console.error('[SearchOrchestrator] Index rebuild failed:', error);
      throw error;
    }
  }

  // Get search statistics
  async getSearchStats() {
    const searchServiceStats = await this.searchService.getSearchStats();
    
    return {
      ...searchServiceStats,
      orchestratorMetrics: { ...this.metrics },
      activeSearches: this.activeSearches.size,
      queuedIndexOperations: this.indexingQueue.length,
    };
  }

  // Event handlers
  private async handleContextAggregated(event: BackgroundEvent): Promise<void> {
    if (!this.config.autoIndex) return;

    const { aggregate } = event.payload as SearchEventPayload;

    if (!aggregate) {
      console.warn('[SearchOrchestrator] Aggregate is undefined in event payload');
      return;
    }

    // Queue for indexing
    this.indexingQueue.push({
      contextId: aggregate.id,
      content: aggregate.content,
      metadata: {
        source: aggregate.sources[0], // Use first source
        timestamp: aggregate.timestamp,
        tags: aggregate.metadata.tags,
        tokenCount: aggregate.tokenCount,
      },
    });

    console.log(`[SearchOrchestrator] Queued context aggregate for indexing: ${aggregate.id}`);
  }

  private async handleSummaryCompleted(event: BackgroundEvent): Promise<void> {
    if (!this.config.autoIndex) return;

    const { summary } = event.payload as SearchEventPayload;

    if (!summary) {
      console.warn('[SearchOrchestrator] Summary is undefined in event payload');
      return;
    }

    // Queue for indexing
    this.indexingQueue.push({
      contextId: summary.id,
      content: summary.content,
      metadata: {
        source: ContextSource.MANUAL, // Summaries are manually generated
        timestamp: summary.timestamp,
        tags: ['summary'],
        summary: summary.content,
        tokenCount: summary.summaryLength,
      },
    });

    console.log(`[SearchOrchestrator] Queued summary for indexing: ${summary.id}`);
  }

  private async handleStorageWrite(_event: BackgroundEvent): Promise<void> {
    // Handle storage write events for index maintenance
    // This could be used for more sophisticated index maintenance
    // For now, we rely on the automatic indexing from other events
  }

  // Private helper methods
  private startIndexingTimer(): void {
    this.indexingTimer = setInterval(async () => {
      if (this.indexingQueue.length > 0) {
        await this.processIndexingQueue();
      }
    }, this.config.indexingDelay);
  }

  private async processIndexingQueue(): Promise<void> {
    if (this.indexingQueue.length === 0) return;
    
    const batch = this.indexingQueue.splice(0, 10); // Process up to 10 items at once
    
    for (const item of batch) {
      try {
        await this.searchService.indexContent(item.contextId, item.content, item.metadata);

        if (this.config.enablePerformanceMonitoring) {
          this.updateIndexMetrics(0); // Time already measured in individual operations
        }

      } catch (error) {
        console.error(`[SearchOrchestrator] Failed to index ${item.contextId}:`, error);

        // Re-queue failed items (with limit to prevent infinite loops)
        if (item.metadata && (!item.metadata.retryCount || item.metadata.retryCount < 3)) {
          item.metadata.retryCount = (item.metadata.retryCount || 0) + 1;
          this.indexingQueue.push(item);
        }
      }
    }
    
    if (batch.length > 0) {
      console.log(`[SearchOrchestrator] Processed ${batch.length} indexing operations`);
    }
  }

  private updateSearchMetrics(searchTime: number): void {
    this.metrics.totalSearches++;
    this.metrics.avgSearchTime = 
      (this.metrics.avgSearchTime * (this.metrics.totalSearches - 1) + searchTime) / 
      this.metrics.totalSearches;
    this.metrics.lastActivity = Date.now();
  }

  private updateIndexMetrics(indexTime: number): void {
    this.metrics.totalIndexOperations++;
    this.metrics.avgIndexTime = 
      (this.metrics.avgIndexTime * (this.metrics.totalIndexOperations - 1) + indexTime) / 
      this.metrics.totalIndexOperations;
    this.metrics.lastActivity = Date.now();
  }

  private generateSearchId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Configuration management
  updateConfig(newConfig: Partial<SearchOrchestratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[SearchOrchestrator] Configuration updated:', this.config);
    
    // Restart indexing timer if delay changed
    if (newConfig.indexingDelay !== undefined) {
      if (this.indexingTimer) {
        clearTimeout(this.indexingTimer);
      }
      this.startIndexingTimer();
    }
  }

  // Health check
  isHealthy(): boolean {
    const now = Date.now();
    const timeSinceLastActivity = now - this.metrics.lastActivity;
    
    // Consider healthy if active within last 5 minutes or no activity expected
    return timeSinceLastActivity < 300000 || this.metrics.totalSearches === 0;
  }
}