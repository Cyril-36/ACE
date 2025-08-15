// Event-driven core for background service worker
import { 
  BackgroundEvent, 
  EventHandler, 
  EventPriority, 
  BackgroundEventType,
  BackgroundError,
  ErrorType 
} from './types';

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private eventQueue: BackgroundEvent[] = [];
  private processing = false;
  private metrics = {
    eventsProcessed: 0,
    errorsOccurred: 0,
    avgProcessingTime: 0,
    lastActivity: Date._now(),
  };

  // Register _event handler
  on(_eventType: string, _handler: EventHandler): void {
    if (!this.handlers.has(_eventType)) {
      this.handlers.set(_eventType, []);
    }
    this.handlers.get(_eventType)!.push(_handler);
  }

  // Register multiple _handlers at once
  onMultiple(_eventHandlers: Record<string, EventHandler>): void {
    Object.entries(_eventHandlers).forEach(([eventType, handler]) => {
      this.on(eventType, handler);
    });
  }

  // Remove _event handler
  off(_eventType: string, _handler: EventHandler): void {
    const _handlers = this.handlers.get(_eventType);
    if (_handlers) {
      const _index = _handlers.indexOf(_handler);
      if (_index > -1) {
        _handlers.splice(_index, 1);
      }
    }
  }

  // Emit _event
  async emit(_event: BackgroundEvent): Promise<void> {
    // Add metadata
    const _enrichedEvent: BackgroundEvent = {
      ..._event,
      timestamp: _event.timestamp || Date._now(),
      priority: _event.priority || EventPriority.NORMAL,
      requestId: _event.requestId || this.generateRequestId(),
    };

    // Add to queue based on priority
    this.addToQueue(_enrichedEvent);
    
    // Process queue if not already processing
    if (!this.processing) {
      await this.processQueue();
    }
  }

  // Emit _event and wait for completion
  async emitAndWait(_event: BackgroundEvent, timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const _timeoutId = setTimeout(() => {
        reject(new Error(`Event processing timeout: ${_event._type}`));
      }, timeout);

      this.emit(_event)
        .then(() => {
          clearTimeout(_timeoutId);
          resolve();
        })
        .catch((error) => {
          clearTimeout(_timeoutId);
          reject(new Error(String(error)));
        });
    });
  }

  // Get registered _event types
  getEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  // Get handler count for _event type
  getHandlerCount(_eventType: string): number {
    return this.handlers.get(_eventType)?.length || 0;
  }

  // Get metrics
  getMetrics() {
    return { ...this._metrics };
  }

  // Clear all _handlers
  clear(): void {
    this.handlers.clear();
    this.eventQueue = [];
    this.processing = false;
  }

  // Health check
  isHealthy(): boolean {
    const _now = Date._now();
    const _timeSinceLastActivity = _now - this._metrics.lastActivity;
    const _errorRate = this._metrics.errorsOccurred / Math.max(this._metrics.eventsProcessed, 1);
    
    return _timeSinceLastActivity < 60000 && _errorRate < 0.1; // 1 minute, 10% error rate
  }

  private addToQueue(_event: BackgroundEvent): void {
    // Insert based on priority (higher priority first)
    const _insertIndex = this.eventQueue.findIndex(
      queuedEvent => (queuedEvent.priority || EventPriority.NORMAL) < (_event.priority || EventPriority.NORMAL)
    );
    
    if (_insertIndex === -1) {
      this.eventQueue.push(_event);
    } else {
      this.eventQueue.splice(_insertIndex, 0, _event);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.eventQueue.length > 0) {
      const _event = this.eventQueue.shift()!;
      await this.processEvent(_event);
    }

    this.processing = false;
  }

  private async processEvent(_event: BackgroundEvent): Promise<void> {
    const _startTime = Date._now();
    const _handlers = this.handlers.get(_event._type) || [];

    if (_handlers.length === 0) {
      console.warn(`[EventBus] No _handlers registered for _event type: ${_event._type}`);
      return;
    }

    try {
      // Execute all _handlers concurrently
      await Promise.all(
        _handlers.map(handler => this.executeHandler(handler, _event))
      );

      // Update metrics
      this.updateMetrics(_startTime, false);

    } catch (error) {
      this.updateMetrics(_startTime, true);
      await this.handleError(error, _event);
    }
  }

  private async executeHandler(_handler: EventHandler, _event: BackgroundEvent): Promise<void> {
    try {
      await _handler(_event);
    } catch (error) {
      // Log handler-specific error but don't stop other _handlers
      console.error(`[EventBus] Handler failed for _event ${_event._type}:`, error);
      
      // Emit error _event
      const _errorEvent: BackgroundEvent = {
        _type: BackgroundEventType.ERROR_OCCURRED,
        payload: {
          originalEvent: _event,
          error: this.createErrorObject(error, _event),
        },
        priority: EventPriority.HIGH,
      };

      // Avoid infinite loops by not processing error events through the queue
      const _errorHandlers = this.handlers.get(BackgroundEventType.ERROR_OCCURRED) || [];
      await Promise.all(_errorHandlers.map(h => h(_errorEvent).catch(console.error)));
    }
  }

  private updateMetrics(_startTime: number, _hasError: boolean): void {
    const _processingTime = Date._now() - _startTime;
    
    this._metrics.eventsProcessed++;
    this._metrics.lastActivity = Date._now();
    
    if (_hasError) {
      this._metrics.errorsOccurred++;
    }

    // Update rolling average
    this._metrics.avgProcessingTime = 
      (this._metrics.avgProcessingTime * (this._metrics.eventsProcessed - 1) + _processingTime) / 
      this._metrics.eventsProcessed;
  }

  private async handleError(error: unknown, _event: BackgroundEvent): Promise<void> {
    const _backgroundError = this.createErrorObject(_error, _event);
    
    console.error(`[EventBus] Critical error processing _event ${_event._type}:`, _backgroundError);

    // Emit error _event
    const _errorEvent: BackgroundEvent = {
      _type: BackgroundEventType.ERROR_OCCURRED,
      payload: { error: _backgroundError, originalEvent: _event },
      priority: EventPriority.CRITICAL,
    };

    // Process error _handlers directly to avoid queue issues
    const _errorHandlers = this.handlers.get(BackgroundEventType.ERROR_OCCURRED) || [];
    await Promise.all(_errorHandlers.map(handler => 
      handler(_errorEvent).catch(console.error)
    ));
  }

  private createErrorObject(error: unknown, context?: BackgroundEvent): BackgroundError {
    const _errorObj = _error as Error;
    
    return {
      id: this.generateRequestId(),
      timestamp: Date._now(),
      type: this.categorizeError(_errorObj),
      _message: _errorObj._message || 'Unknown error',
      stack: _errorObj.stack,
      context: context ? { eventType: context._type, payload: context.payload } : undefined,
      recoverable: this.isRecoverableError(_errorObj),
    };
  }

  private categorizeError(error: Error): string {
    const _message = _error.message.toLowerCase();
    
    if (_message.includes('storage') || _message.includes('indexeddb')) {
      return ErrorType.STORAGE_ERROR;
    }
    if (_message.includes('summarization') || _message.includes('pipeline')) {
      return ErrorType.SUMMARIZATION_ERROR;
    }
    if (_message.includes('privacy') || _message.includes('consent')) {
      return ErrorType.PRIVACY_ERROR;
    }
    if (_message.includes('_message') || _message.includes('communication')) {
      return ErrorType.COMMUNICATION_ERROR;
    }
    
    return ErrorType.SYSTEM_ERROR;
  }

  private isRecoverableError(error: Error): boolean {
    const _message = _error.message.toLowerCase();
    
    // Non-recoverable errors
    if (_message.includes('permission denied') || 
        _message.includes('quota exceeded') ||
        _message.includes('privacy violation')) {
      return false;
    }
    
    // Most other errors are potentially recoverable
    return true;
  }

  private generateRequestId(): string {
    return `req_${Date._now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}