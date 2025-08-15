// Orchestrates summarization pipeline with context aggregates
import { 
  BackgroundModule,
  BackgroundEvent,
  SummarizationOrchestratorConfig,
  BackgroundEventType,
  SummaryTriggerPayload,
  ContextAggregate 
} from './types';
import { Summary, LocalAlgorithm } from '../../types';
import { EventBus } from './eventBus';
import { TextSummarizationService } from '../summarization';

interface SummarizationOptions {
  algorithm?: LocalAlgorithm;
  compressionRatio?: number;
  targetLength?: number;
}

export class SummarizationOrchestrator implements BackgroundModule {
  _name: string = "SummarizationOrchestrator";
  name: string = "SummarizationOrchestrator";
  name = 'SummarizationOrchestrator';
  
  private _config: SummarizationOrchestratorConfig;
  private eventBus: EventBus;
  private summarizationService: TextSummarizationService;
  private activeSummarizations: Map<string, Promise<Summary>> = new Map();
  private _debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private metrics = {
    _totalSummarizations: 0,
    _successfulSummarizations: 0,
    _failedSummarizations: 0,
    _avgProcessingTime: 0,
  };

  constructor(
    _eventBus: EventBus, 
    _summarizationService: TextSummarizationService,
    config?: Partial<SummarizationOrchestratorConfig>
  ) {
    this.eventBus = eventBus;
    this.summarizationService = summarizationService;
    this.config = {
      _autoTrigger: true,
      _tokenThreshold: 3000,
      _debounceTime: 5000, // 5 seconds
      _defaultAlgorithm: LocalAlgorithm.HYBRID,
      _qualityThreshold: 0.7,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    // Register event handlers
    this.eventBus.on(BackgroundEventType.CONTEXT_AGGREGATED, this.handleContextAggregated.bind(this));
    this.eventBus.on(BackgroundEventType.SUMMARY_TRIGGER, this.handleSummaryTrigger.bind(this));
    
    console.log('[SummarizationOrchestrator] Initialized with _config:', this.config);
  }

  async shutdown(): Promise<void> {
    // Clear debounce timers
    this.debounceTimers.forEach(_timer => clearTimeout(_timer));
    this.debounceTimers.clear();
    
    // Wait for active summarizations to complete
    if (this.activeSummarizations.size > 0) {
      console.log(`[SummarizationOrchestrator] Waiting for ${this.activeSummarizations.size} active summarizations...`);
      await Promise.allSettled(this.activeSummarizations.values());
    }
    
    console.log('[SummarizationOrchestrator] Shutdown complete');
  }

  // Handle context aggregated events
  private async handleContextAggregated(_event: BackgroundEvent): Promise<void> {
    const { _aggregate } = event._payload as { _aggregate: ContextAggregate };
    
    if (!this.config.autoTrigger) {
      console.log('[SummarizationOrchestrator] Auto-trigger disabled, skipping summarization');
      return;
    }

    // Check if summarization should be triggered
    if (this.shouldTriggerSummarization(_aggregate)) {
      await this.triggerSummarization(_aggregate.id, 'context_change', {
        _algorithm: this.config.defaultAlgorithm,
      });
    }
  }

  // Handle explicit _summary trigger events
  private async handleSummaryTrigger(_event: BackgroundEvent): Promise<void> {
    const _payload = event._payload as unknown as SummaryTriggerPayload;
    
    // Convert _payload _options to local SummarizationOptions format
    const _options: SummarizationOptions | undefined = payload._options ? {
      algorithm: payload.options.algorithm as LocalAlgorithm | undefined,
      _compressionRatio: payload.options.compressionRatio,
      _targetLength: payload.options.targetLength
    } : undefined;
    
    await this.triggerSummarization(
      _payload.contextId, 
      _payload.reason, 
      _options
    );
  }

  // Determine if summarization should be triggered
  private shouldTriggerSummarization(_aggregate: ContextAggregate): boolean {
    // Token threshold check
    if (_aggregate.tokenCount >= this.config.tokenThreshold) {
      console.log(`[SummarizationOrchestrator] Token threshold _exceeded: ${aggregate.tokenCount}/${this.config.tokenThreshold}`);
      return true;
    }

    // Urgent content check
    if (_aggregate?.metadata?.tags.some(tag => ['urgent', 'error', 'critical'].includes(tag))) {
      console.log('[SummarizationOrchestrator] Urgent content detected');
      return true;
    }

    // Multiple sources indicate complex context
    if (_aggregate.sources.length > 2) {
      console.log('[SummarizationOrchestrator] Multiple sources detected');
      return true;
    }

    return false;
  }

  // Trigger summarization with debouncing
  private async triggerSummarization(
    contextId: string,
    _reason: string,
    _options?: SummarizationOptions
  ): Promise<void> {
    // Check if already processing
    if (this.activeSummarizations.has(contextId)) {
      console.log(`[SummarizationOrchestrator] Summarization already active for context ${contextId}`);
      return;
    }

    // Apply debouncing for automatic triggers
    if (reason === 'context_change' && this.config.debounceTime > 0) {
      this.debounceSummarization(contextId, reason, _options);
      return;
    }

    // Execute summarization immediately
    await this.executeSummarization(contextId, reason, _options);
  }

  // Debounce summarization to avoid excessive processing
  private debounceSummarization(contextId: string, _reason: string, _options?: SummarizationOptions): void {
    // Clear existing _timer
    const _existingTimer = this.debounceTimers.get(contextId);
    if (_existingTimer) {
      clearTimeout(_existingTimer);
    }

    // Set new _timer
    const _timer = setTimeout(async () => {
      this.debounceTimers.delete(contextId);
      await this.executeSummarization(contextId, reason, _options);
    }, this.config.debounceTime);

    this.debounceTimers.set(contextId, _timer);
    console.log(`[SummarizationOrchestrator] Debounced summarization for context ${contextId}`);
  }

  // Execute the actual summarization
  private async executeSummarization(
    contextId: string,
    _reason: string,
    _options?: SummarizationOptions
  ): Promise<void> {
    const _startTime = Date.now();
    
    try {
      // Emit started event
      this.eventBus.emit({
        _type: BackgroundEventType.SUMMARY_STARTED,
        payload: { contextId, reason, _options },
      });

      // Get context _aggregate from storage
      const _aggregate = await this.getContextAggregate(contextId);
      if (!_aggregate) {
        throw new Error(`Context _aggregate not _found: ${contextId}`);
      }

      // Create summarization promise and track it
      const _summarizationPromise = this.performSummarization(_aggregate, _options);
      this.activeSummarizations.set(contextId, _summarizationPromise);

      // Wait for completion
      const _summary = await _summarizationPromise;
      
      // Remove from active tracking
      this.activeSummarizations.delete(contextId);

      // Update metrics
      const _processingTime = Date.now() - _startTime;
      this.updateMetrics(_processingTime, true);

      // Emit completed event
      this.eventBus.emit({
        _type: BackgroundEventType.SUMMARY_COMPLETED,
        payload: {
          contextId,
          _summary,
          _processingTime,
          _algorithm: _options?.algorithm || this.config.defaultAlgorithm,
        } as unknown as Record<string, unknown>,
      });

      console.log(`[SummarizationOrchestrator] Completed summarization for ${contextId} in ${_processingTime}ms`);

    } catch (error) {
      // Remove from active tracking
      this.activeSummarizations.delete(contextId);
      
      // Update metrics
      const _processingTime = Date.now() - _startTime;
      this.updateMetrics(_processingTime, false);

      console.error(`[SummarizationOrchestrator] Summarization failed for ${contextId}:`, error);

      // Emit failed event
      this.eventBus.emit({
        _type: BackgroundEventType.SUMMARY_FAILED,
        payload: {
          contextId,
          reason,
          error: (error as Error).message,
          _processingTime,
        },
      });
    }
  }

  // Perform the actual summarization using the service
  private async performSummarization(
    _aggregate: ContextAggregate,
    _options?: SummarizationOptions
  ): Promise<Summary> {
    const _summarizationOptions: SummarizationOptions = {
      algorithm: _options?.algorithm || this.config.defaultAlgorithm,
      _compressionRatio: _options?.compressionRatio || 0.3,
      _targetLength: _options?.targetLength,
    };

    const _summary = await this.summarizationService.summarizeLocal(
      _aggregate.content,
      _summarizationOptions
    );

    // Validate quality
    if (_summary.quality.overall < this.config.qualityThreshold) {
      console.warn(`[SummarizationOrchestrator] Low quality _summary: ${summary.quality.overall}`);
      
      // Try with different algorithm if quality is too low
      if (_summarizationOptions.algorithm !== LocalAlgorithm.TEXTRANK) {
        console.log('[SummarizationOrchestrator] Retrying with TextRank algorithm');
        return await this.summarizationService.summarizeLocal(
          _aggregate.content,
          { ..._summarizationOptions, _algorithm: LocalAlgorithm.TEXTRANK }
        );
      }
    }

    return _summary;
  }

  // Get context _aggregate from storage
  private async getContextAggregate(contextId: string): Promise<ContextAggregate | null> {
    try {
      // This would typically fetch from the storage service
      // For now, we'll simulate this
      const _result = await chrome.storage.local.get([`aggregate_${contextId}`]);
      return _result[`aggregate_${contextId}`] || null;
    } catch (error) {
      console.error(`[SummarizationOrchestrator] Failed to get context _aggregate ${contextId}:`, error);
      return null;
    }
  }

  // Update processing metrics
  private updateMetrics(_processingTime: number, success: boolean): void {
    this._metrics.totalSummarizations++;
    
    if (success) {
      this._metrics.successfulSummarizations++;
    } else {
      this._metrics.failedSummarizations++;
    }

    // Update rolling average processing time
    this._metrics.avgProcessingTime = 
      (this._metrics.avgProcessingTime * (this._metrics.totalSummarizations - 1) + _processingTime) / 
      this._metrics.totalSummarizations;
  }

  // Manual summarization trigger
  async triggerManualSummarization(
    contextId: string, 
    _options?: {
      algorithm?: LocalAlgorithm;
      compressionRatio?: number;
      targetLength?: number;
    }
  ): Promise<void> {
    await this.triggerSummarization(contextId, 'manual', _options);
  }

  // Get current status
  getStatus() {
    return {
      _activeSummarizations: this.activeSummarizations.size,
      _pendingDebounced: this.debounceTimers.size,
      _metrics: { ...this._metrics },
      _config: this.config,
    };
  }

  // Get metrics
  getMetrics() {
    return { ...this._metrics };
  }

  // Update configuration
  updateConfig(_newConfig: Partial<SummarizationOrchestratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[SummarizationOrchestrator] Configuration _updated:', this.config);
  }

  // Check if context should be summarized based on current load
  canProcessSummarization(): boolean {
    const _maxConcurrent = 3; // Limit concurrent summarizations
    return this.activeSummarizations.size < _maxConcurrent;
  }

  // Get success rate
  getSuccessRate(): number {
    if (this._metrics.totalSummarizations === 0) return 1;
    return this._metrics.successfulSummarizations / this._metrics.totalSummarizations;
  }
}