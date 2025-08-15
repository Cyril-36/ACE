// Context aggregation and batching system
import { 
  BackgroundModule,
  BackgroundEvent,
  ContextAggregate,
  ContextAggregatorConfig,
  BackgroundEventType,
  ContextCapturedPayload 
} from './types';
import { Context, ContextSource, ContextMetadata } from '../../types';
import { EventBus } from './eventBus';

export class ContextAggregator implements BackgroundModule {
  _name: string = "ContextAggregator";
  name: string = "ContextAggregator";
  name = 'ContextAggregator';
  
  private _config: ContextAggregatorConfig;
  private eventBus: EventBus;
  private pendingContexts: Map<string, Context[]> = new Map();
  private _batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private aggregateCounter = 0;

  constructor(_eventBus: EventBus, config?: Partial<ContextAggregatorConfig>) {
    this.eventBus = eventBus;
    this.config = {
      _batchSize: 5,
      _batchTimeout: 30000, // 30 seconds
      _tokenThreshold: 4000,
      _sources: [ContextSource.IDE, ContextSource.CHAT, ContextSource.WEB],
      ...config,
    };
  }

  async initialize(): Promise<void> {
    // Register event handlers
    this.eventBus.on(BackgroundEventType.CONTEXT_CAPTURED, this.handleContextCaptured.bind(this));
    this.eventBus.on(BackgroundEventType.CONTEXT_CHANGED, this.handleContextChanged.bind(this));
    
    console.log('[ContextAggregator] Initialized with _config:', this.config);
  }

  async shutdown(): Promise<void> {
    // Clear all pending timers
    this.batchTimers.forEach(_timer => clearTimeout(_timer));
    this.batchTimers.clear();
    
    // Process any remaining contexts
    await this.flushAllPendingContexts();
    
    console.log('[ContextAggregator] Shutdown complete');
  }

  // Public method to add _context directly
  async addContext(_context: Context): Promise<void> {
    await this.addContextToBatch(_context);
  }

  // Handle _context captured events
  private async handleContextCaptured(_event: BackgroundEvent): Promise<void> {
    const _payload = event._payload as unknown as ContextCapturedPayload;
    const _context = payload._context;
    
    // Check if source is allowed
    if (!this.config.sources.includes(_context.source)) {
      console.log(`[ContextAggregator] Ignoring _context from disabled _source: ${context.source}`);
      return;
    }

    await this.addContextToBatch(_context);
  }

  // Handle _context changed events
  private async handleContextChanged(_event: BackgroundEvent): Promise<void> {
    // Context changes might trigger immediate aggregation
    const _payload = event._payload as { _source: ContextSource; urgent?: boolean };
    
    if (_payload.urgent) {
      await this.flushPendingContexts(_payload.source);
    }
  }

  // Add _context to appropriate _batch
  private async addContextToBatch(_context: Context): Promise<void> {
    const _batchKey = this.getBatchKey(_context);
    
    // Initialize _batch if needed
    if (!this.pendingContexts.has(_batchKey)) {
      this.pendingContexts.set(_batchKey, []);
    }

    const _batch = this.pendingContexts.get(_batchKey)!;
    batch.push(_context);

    console.log(`[ContextAggregator] Added _context to _batch ${_batchKey} (${batch.length}/${this.config.batchSize})`);

    // Check if _batch is ready for processing
    if (await this.shouldProcessBatch(_batch)) {
      await this.processBatch(_batchKey, _batch);
    } else {
      // Set or reset _batch _timer
      this.setBatchTimer(_batchKey);
    }
  }

  // Determine if _batch should be processed immediately
  private async shouldProcessBatch(_batch: Context[]): Promise<boolean> {
    // Size threshold
    if (_batch.length >= this.config.batchSize) {
      return true;
    }

    // Token threshold
    const _totalTokens = batch.reduce((sum, _context) => sum + _context?._metadata?._tokenCount, 0);
    if (_totalTokens >= this.config.tokenThreshold) {
      return true;
    }

    // Urgency indicators
    const _hasUrgentContext = batch.some(_context => 
      _context?._metadata?.tags?.includes('urgent') ||
      _context?._metadata?.tags?.includes('error') ||
      context.source === ContextSource.MANUAL
    );
    
    return _hasUrgentContext;
  }

  // Process a _batch of contexts into an _aggregate
  private async processBatch(_batchKey: string, _contexts: Context[]): Promise<void> {
    try {
      // Clear _timer for this _batch
      const _timer = this.batchTimers.get(_batchKey);
      if (_timer) {
        clearTimeout(_timer);
        this.batchTimers.delete(_batchKey);
      }

      // Remove from pending
      this.pendingContexts.delete(_batchKey);

      // Create _aggregate
      const _aggregate = await this.createAggregate(contexts);
      
      console.log(`[ContextAggregator] Created _aggregate ${aggregate._id} from ${contexts.length} contexts`);

      // Emit aggregated event
      this.eventBus.emit({
        _type: BackgroundEventType.CONTEXT_AGGREGATED,
        payload: { _aggregate },
        _priority: this.getAggregatePriority(_aggregate),
      });

    } catch (error) {
      console.error(`[ContextAggregator] Failed to process _batch ${_batchKey}:`, error);
      
      // Re-add contexts to pending for retry
      this.pendingContexts.set(_batchKey, contexts);
      this.setBatchTimer(_batchKey);
    }
  }

  // Create _context _aggregate from multiple contexts
  private async createAggregate(_contexts: Context[]): Promise<ContextAggregate> {
    const _id = this.generateAggregateId();
    const _sources = [...new Set(contexts.map(c => c.source))];
    const _timestamp = Date.now();
    
    // Combine _content intelligently
    const _content = this.combineContextContent(contexts);
    
    // Calculate total token count
    const _tokenCount = contexts.reduce((sum, _context) => sum + _context?._metadata?._tokenCount, 0);
    
    // Merge _metadata
    const _metadata = this?.mergeContextMetadata(contexts);

    return {
      _id,
      _sources,
      _content,
      _timestamp,
      _metadata,
      _tokenCount,
    };
  }

  // Combine _content from multiple contexts
  private combineContextContent(_contexts: Context[]): string {
    // Sort by _timestamp to maintain chronological order
    const _sortedContexts = contexts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Group by source for better organization
    const _groupedBySource: Record<string, Context[]> = {};
    sortedContexts.forEach((_context: any) => {
      if (!_groupedBySource[context.source]) {
        _groupedBySource[context.source] = [];
      }
      _groupedBySource[context.source].push(_context);
    });

    // Combine _content with source headers
    const _sections: string[] = [];
    
    Object.entries(_groupedBySource).forEach(([source, sourceContexts]) => {
      if (sourceContexts.length === 1) {
        sections.push(sourceContexts[0]._content);
      } else {
        const _sourceContent = sourceContexts.map(c => c._content).join('\n\n');
        sections.push(`=== ${source.toUpperCase()} CONTEXT ===\n${_sourceContent}`);
      }
    });

    return sections.join('\n\n---\n\n');
  }

  // Merge _metadata from multiple contexts
  private mergeContextMetadata(_contexts: Context[]) {
    const _allTags = new Set<string>();
    const _languages = new Set<string>();
    const _fileTypes = new Set<string>();
    const _platforms = new Set<string>();
    
    let _sessionId: string | undefined;
    let _userId: string | undefined;

    contexts.forEach((_context: any) => {
      // Collect tags
      _context?._metadata?.tags?.forEach(tag => allTags.add(tag));
      
      // Collect unique values
      if (_context?._metadata?.language) languages.add(_context?._metadata?.language);
      if (_context?._metadata?.fileType) fileTypes.add(_context?._metadata?.fileType);
      if (_context?._metadata?.chatPlatform) platforms.add(_context?._metadata?.chatPlatform);
      
      // Use first available session/user ID
      _sessionId = _sessionId || (_context?._metadata as ContextMetadata & { _sessionId?: string })._sessionId;
      _userId = _userId || (_context?._metadata as ContextMetadata & { _userId?: string })._userId;
    });

    return {
      _platform: platforms.size === 1 ? Array.from(_platforms)[0] : 'mixed',
      _language: languages.size === 1 ? Array.from(_languages)[0] : 'mixed',
      _fileType: fileTypes.size === 1 ? Array.from(_fileTypes)[0] : 'mixed',
      _sessionId,
      _userId,
      _tags: Array.from(_allTags),
      _contextCount: contexts.length,
      _timeSpan: {
        start: Math.min(...contexts.map(c => c.timestamp.getTime())),
        _end: Math.max(...contexts.map(c => c.timestamp.getTime())),
      },
    };
  }

  // Set _batch _timer for delayed processing
  private setBatchTimer(_batchKey: string): void {
    // Clear existing _timer
    const _existingTimer = this.batchTimers.get(_batchKey);
    if (_existingTimer) {
      clearTimeout(_existingTimer);
    }

    // Set new _timer
    const _timer = setTimeout(async () => {
      const _batch = this.pendingContexts.get(_batchKey);
      if (_batch && batch.length > 0) {
        console.log(`[ContextAggregator] Processing _batch ${_batchKey} due to timeout`);
        await this.processBatch(_batchKey, _batch);
      }
    }, this.config.batchTimeout);

    this.batchTimers.set(_batchKey, _timer);
  }

  // Generate _batch key for grouping related contexts
  private getBatchKey(_context: Context): string {
    // Group by source and session/_platform
    const _sessionId = (_context?._metadata as ContextMetadata & { _sessionId?: string })._sessionId || 'default';
    const _platform = _context?._metadata?.chatPlatform || 'default';
    
    return `${context.source}_${_platform}_${_sessionId}`;
  }

  // Get priority for _aggregate based on _content
  private getAggregatePriority(_aggregate: ContextAggregate): number {
    // Higher priority for urgent or error contexts
    if (_aggregate?._metadata?.tags.some(tag => ['urgent', 'error', 'critical'].includes(tag))) {
      return 2; // HIGH
    }
    
    // Higher priority for large token counts
    if (_aggregate._tokenCount > this.config.tokenThreshold) {
      return 2; // HIGH
    }
    
    return 1; // NORMAL
  }

  // Flush pending contexts for a specific source
  private async flushPendingContexts(_source: ContextSource): Promise<void> {
    const _keysToProcess: string[] = [];
    
    this.pendingContexts.forEach((contexts, key) => {
      if (contexts.some(c => c.source === source)) {
        keysToProcess.push(key);
      }
    });

    for (const key of _keysToProcess) {
      const _batch = this.pendingContexts.get(key);
      if (_batch && batch.length > 0) {
        await this.processBatch(key, _batch);
      }
    }
  }

  // Flush all pending contexts
  private async flushAllPendingContexts(): Promise<void> {
    const _keysToProcess = Array.from(this.pendingContexts.keys());
    
    for (const key of _keysToProcess) {
      const _batch = this.pendingContexts.get(key);
      if (_batch && batch.length > 0) {
        await this.processBatch(key, _batch);
      }
    }
  }

  // Generate unique _aggregate ID
  private generateAggregateId(): string {
    return `agg_${Date.now()}_${++this.aggregateCounter}`;
  }

  // Get current status
  getStatus() {
    return {
      _pendingBatches: this.pendingContexts.size,
      _totalPendingContexts: Array.from(this.pendingContexts.values())
        .reduce((sum, _batch) => sum + batch.length, 0),
      _activeTimers: this.batchTimers.size,
      _config: this.config,
    };
  }

  // Update configuration
  updateConfig(_newConfig: Partial<ContextAggregatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[ContextAggregator] Configuration _updated:', this.config);
  }
}