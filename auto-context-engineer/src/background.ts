// Background Service Worker Core for Auto Context Engineer
import { initializeI18n } from "@/i18n";
import { ContextSource, Summary } from "@/types";
import { EventBus } from "./services/background/eventBus";
import { PrivacyAuditor } from "./services/background/privacyAuditor";
import { ContextAggregator } from "./services/background/contextAggregator";
import { SummarizationOrchestrator } from "./services/background/summarizationOrchestrator";
import { SearchOrchestrator } from "./services/search/searchOrchestrator";
import { TextSummarizationService } from "./services/summarization";
import { IndexedDBStorageService } from "./services/storage";
import { PrivacyService } from "./services/privacy";
import { ConsentType } from "./services/privacy/consentManager";
import { CloudService } from "./services/cloud";
import {
  BackgroundEventType,
  BackgroundEvent,
  BackgroundModule,
  HealthStatus,
  ModuleHealth,
} from "./services/background/types";
import { _compatibilityIntegration, _initializeCompatibility } from "./services/compatibility/compatibilityIntegration";
import { optimizationService } from "./services/performance/optimizationService";

// Type definitions for event payloads

interface IDEContextData {
  context: {
    metadata: {
      tokenCount: number;
      platform: string;
      fileType: string;
    };
    content: string;
    timestamp: number;
  };
  timestamp: number;
}

interface IDETokenUsageData {
  usage: {
    platform: string;
    current: number;
    limit: number;
    percentage: number;
  };
}

class BackgroundServiceWorker {
  private eventBus!: EventBus;
  private privacyAuditor!: PrivacyAuditor;
  private privacyService!: PrivacyService;
  private cloudService!: CloudService;
  private contextAggregator!: ContextAggregator;
  private summarizationOrchestrator!: SummarizationOrchestrator;
  private searchOrchestrator!: SearchOrchestrator;
  private storageService!: IndexedDBStorageService;
  private summarizationService!: TextSummarizationService;
  private modules: BackgroundModule[] = [];
  private startTime = Date.now();
  private healthCheckInterval?: NodeJS.Timeout;
  
  // Performance optimizations
  private messageHandlers = new Map<string, (message: Record<string, string | number | boolean>, sender: chrome.runtime.MessageSender, sendResponse: (response?: Record<string, string | number | boolean>) => void) => void>();
  private initializationPromise?: Promise<void>;

  constructor() {
    this.setupMessageHandlers();
    void this.initialize();
  }

  // Pre-setup message handlers for better performance
  private setupMessageHandlers(): void {
    this.messageHandlers.set('CONTEXT_CHANGED', (message) => {
      void this.handleLegacyContextChange(message.context, message.source as ContextSource);
    });
    this.messageHandlers.set('TOKEN_LIMIT_APPROACHING', (message) => {
      void this.handleTokenLimitApproaching(message._usage, message.platform as string);
    });
    this.messageHandlers.set('CHAT_MONITOR_INITIALIZED', (message) => {
      void this.handleChatMonitorInitialized(message);
    });
    this.messageHandlers.set('IDE_MONITOR_INITIALIZED', (message) => {
      void this.handleIDEMonitorInitialized(message);
    });
    this.messageHandlers.set('IDE_CONTEXT_CAPTURED', (message) => {
      void this.handleIDEContextCaptured(message as unknown as IDEContextData);
    });
    this.messageHandlers.set('IDE_TOKEN_LIMIT_APPROACHING', (message) => {
      void this.handleIDETokenLimitApproaching(message as unknown as IDETokenUsageData);
    });
    this.messageHandlers.set('GET_EXTENSION_STATUS', (message, sender, sendResponse) => {
      this.handleGetExtensionStatus(message, sender, (response) => {
        sendResponse(response as unknown as Record<string, string | number | boolean>);
      });
    });
    this.messageHandlers.set('GET_METRICS', (message, sender, sendResponse) => {
      this.handleGetMetrics(message, sender, (response) => {
        sendResponse(response as Record<string, string | number | boolean>);
      });
    });
    this.messageHandlers.set('SEARCH_CONTEXTS', (message, _sender, sendResponse) => {
      this.handleSearchRequest(message.query as string, (response) => {
        sendResponse(response as unknown as Record<string, string | number | boolean>);
      }).catch(console.error);
    });
    this.messageHandlers.set('REBUILD_SEARCH_INDEX', (_message, _sender, sendResponse) => {
      this.handleRebuildIndex((response) => {
        sendResponse(response as unknown as Record<string, string | number | boolean>);
      }).catch(console.error);
    });
    this.messageHandlers.set('GET_PRIVACY_DASHBOARD', (_message, _sender, sendResponse) => {
      this.handleGetPrivacyDashboard((response) => {
        sendResponse(response as unknown as Record<string, string | number | boolean>);
      }).catch(console.error);
    });
    this.messageHandlers.set('GET_AUDIT_REPORT', (message, _sender, sendResponse) => {
      this.handleGetAuditReport(message as unknown as Record<string, string>, (response) => {
        sendResponse(response as unknown as Record<string, string | number | boolean>);
      }).catch(console.error);
    });
    this.messageHandlers.set('EXPORT_AUDIT_LOG', (message, _sender, sendResponse) => {
      this.handleExportAuditLog(message.format as 'json' | 'csv', message as unknown as Record<string, string>, (response) => {
        sendResponse(response as Record<string, string | number | boolean>);
      }).catch(console.error);
    });
    this.messageHandlers.set('UPDATE_PRIVACY_POLICY', (message, _sender, sendResponse) => {
      this.handleUpdatePrivacyPolicy(message as unknown as { localOnly: boolean; cloudOptIn: boolean; _auditLogging: boolean; dataRetention: number; }, (response) => {
        sendResponse(response as unknown as Record<string, string | number | boolean>);
      }).catch(console.error);
    });
    this.messageHandlers.set('REQUEST_CONSENT', (message, _sender, sendResponse) => {
      this.handleRequestConsent(message as unknown as { type: string; title: string; description: string; details: string; dataTypes?: string[]; purposes?: string[]; }, (response) => {
        sendResponse(response as Record<string, string | number | boolean>);
      }).catch(console.error);
    });
    this.messageHandlers.set('REVOKE_CONSENT', (message, _sender, sendResponse) => {
      this.handleRevokeConsent(message.consentType as string, (response) => {
        sendResponse(response as Record<string, string | number | boolean>);
      }).catch(console.error);
    });
    this.messageHandlers.set('GET_THREAT_ALERTS', (_message, _sender, sendResponse) => {
      this.handleGetThreatAlerts((response) => {
        sendResponse(response as unknown as Record<string, string | number | boolean>);
      }).catch(console.error);
    });
    this.messageHandlers.set('CLEAR_PRIVACY_DATA', (_message, _sender, sendResponse) => {
      void this.handleClearPrivacyData((response) => {
        sendResponse(response as Record<string, string | number | boolean>);
      });
    });
    this.messageHandlers.set('SHOW_CONSENT_DIALOG', (message) => {
      this.handleShowConsentDialog(message as unknown as { request: { type: string; title: string; description: string; details: string } });
    });
  }

  private async initialize(): Promise<void> {
    // Prevent multiple initialization attempts
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      console.log("[BackgroundServiceWorker] Initializing...");

      // Initialize performance optimization service
      optimizationService.startTimer('background_initialization');

      // Initialize cross-browser compatibility first
      await _initializeCompatibility({
        _enablePolyfills: true,
        enableErrorReporting: true,
        enablePerformanceMonitoring: true,
        storageStrategy: 'auto',
      });

      // Initialize cross-browser API
      void _compatibilityIntegration.getAPI();
      console.log("[BackgroundServiceWorker] Cross-browser compatibility initialized");

      // Initialize i18n
      initializeI18n();

      // Initialize core services with singleton pattern
      this.eventBus = new EventBus();
      this.storageService = IndexedDBStorageService.getInstance();
      this.summarizationService = new TextSummarizationService();

      // Initialize modules in parallel for better performance
      const moduleInitPromises = [
        this.initializePrivacyModule(),
        this.initializeCloudModule(),
        this.initializeContextModule(),
        this.initializeSummarizationModule(),
        this.initializeSearchModule(),
      ];

      await Promise.all(moduleInitPromises);

      // Initialize batch processors for efficient operations
      this.initializeBatchProcessors();

      // Set up handlers
      this.setupEventHandlers();
      this.setupOptimizedMessageHandlers();
      this.setupTabHandlers();
      this.setupStorageHandlers();

      // Start health monitoring with reduced frequency
      this.startHealthMonitoring();

      // Emit startup event
      await this.eventBus.emit({
        _type: BackgroundEventType.EXTENSION_STARTUP,
        payload: { timestamp: Date.now(), version: "1.0.0" },
      });

      console.log("[BackgroundServiceWorker] Initialization complete");
      optimizationService.endTimer('background_initialization');
    } catch (error) {
      console.error("[BackgroundServiceWorker] Initialization failed:", error);
      this.initializationPromise = undefined; // Allow retry
      throw error;
    }
  }

  // Initialize batch processors for efficient operations
  private initializeBatchProcessors(): void {
    // Batch processing is handled internally by the services
    console.log('[BackgroundServiceWorker] Batch processors initialized');
  }



  // Optimized module initialization
  private async initializePrivacyModule(): Promise<void> {
    this.privacyAuditor = new PrivacyAuditor();
    this.privacyService = new PrivacyService(this.eventBus, this.storageService, {
      enableRealTimeMonitoring: true,
      enableThreatDetection: true,
    });
    await Promise.all([
      this.privacyAuditor.initialize(),
      this.privacyService.initialize(),
    ]);
    this.modules.push(this.privacyAuditor, this.privacyService);
  }

  private async initializeCloudModule(): Promise<void> {
    this.cloudService = new CloudService(this.eventBus, this.storageService, {
      enableCostTracking: true,
      enableUsageAnalytics: true,
      maxConcurrentRequests: 3, // Reduced for better performance
    });
    await this.cloudService.initialize();
    this.modules.push(this.cloudService);
  }

  private async initializeContextModule(): Promise<void> {
    this.contextAggregator = new ContextAggregator(this.eventBus);
    await this.contextAggregator.initialize();
    this.modules.push(this.contextAggregator);
  }

  private async initializeSummarizationModule(): Promise<void> {
    this.summarizationOrchestrator = new SummarizationOrchestrator(
      this.eventBus,
      this.summarizationService,
    );
    await this.summarizationOrchestrator.initialize();
    this.modules.push(this.summarizationOrchestrator);
  }

  private async initializeSearchModule(): Promise<void> {
    this.searchOrchestrator = new SearchOrchestrator(
      this.eventBus,
      undefined, // Use default search service
      this.storageService,
    );
    await this.searchOrchestrator.initialize();
    this.modules.push(this.searchOrchestrator);
  }

  private setupEventHandlers(): void {
    // Core event handlers
    this.eventBus.onMultiple({
      [BackgroundEventType.CONTEXT_CAPTURED]:
        this.handleContextCaptured.bind(this),
      [BackgroundEventType.CONTEXT_AGGREGATED]:
        this.handleContextAggregated.bind(this),
      [BackgroundEventType.SUMMARY_COMPLETED]:
        this.handleSummaryCompleted.bind(this),
      [BackgroundEventType.STORAGE_WRITE]: this.handleStorageWrite.bind(this),
      [BackgroundEventType.PRIVACY_AUDIT]: this.handlePrivacyAudit.bind(this),
      [BackgroundEventType.ERROR_OCCURRED]: this.handleError.bind(this),
      [BackgroundEventType.HEALTH_CHECK]: this.handleHealthCheck.bind(this),
    });
  }

  private setupOptimizedMessageHandlers(): void {
    chrome.runtime.onMessage.addListener((message: Record<string, string | number | boolean>, sender, sendResponse) => {
      // Emit message event through event bus (non-blocking)
      this.eventBus.emit({
        _type: BackgroundEventType.MESSAGE_FROM_CONTENT,
        payload: {
          message,
          sender: sender.tab?.id ? `tab_${sender.tab.id}` : "unknown",
          tabId: sender.tab?.id,
          frameId: sender.frameId,
        },
      }).catch(console.error);

      // Use pre-built handler map for better performance
      const messageType = typeof message.type === 'string' ? message.type : String(message.type);
      const handler = this.messageHandlers.get(messageType);
      if (handler) {
        try {
          handler(message, sender, sendResponse);
        } catch (error) {
          console.error(`[BackgroundServiceWorker] Handler error for ${messageType}:`, error);
          sendResponse({ success: false, error: (error as Error).message });
        }
      } else {
        console.warn("[BackgroundServiceWorker] Unknown message type:", messageType);
        sendResponse({ success: false, error: "Unknown message type" });
      }

      // Return true to indicate async response
      return true;
    });
  }

  // Optimized handler methods
  private handleGetExtensionStatus(_message: Record<string, string | number | boolean>, _sender: chrome.runtime.MessageSender, sendResponse: (response?: { status: string; version: string; health: HealthStatus; uptime: number }) => void): void {
    sendResponse({
      status: "active",
      version: "1.0.0",
      health: this.getHealthStatus(),
      uptime: Date.now() - this.startTime,
    });
  }

  private handleGetMetrics(_message: Record<string, string | number | boolean>, _sender: chrome.runtime.MessageSender, sendResponse: (response?: Record<string, string | number | boolean>) => void): void {
    this.getMetrics().then((metrics: any) => {
      sendResponse(metrics);
    }).catch((error: any) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse({ success: false, error: errorMessage });
    });
  }

  private setupTabHandlers(): void {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url) {
        void this.handleTabUpdate(tabId, tab.url);
      }
    });
  }

  private setupStorageHandlers(): void {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      void this.eventBus.emit({
        _type: BackgroundEventType.STORAGE_WRITE,
        payload: { changes, namespace },
      });
    });
  }

  // Event handlers
  private async handleContextCaptured(event: BackgroundEvent): Promise<void> {
    // Privacy check
    if (!this.privacyAuditor.enforcePolicy(event)) {
      console.warn(
        "[BackgroundServiceWorker] Context capture blocked by privacy policy",
      );
      return;
    }

    // Log privacy audit
    await Promise.resolve(); // Simulate async operation
    this.privacyAuditor.log(event, "context_capture", true);
  }

  private async handleContextAggregated(event: BackgroundEvent): Promise<void> {
    const payload = event.payload as Record<string, Record<string, string | number>>;
    const aggregate = payload.aggregate;

    try {
      // Store aggregate
      await this.storageService.store(`aggregate_${aggregate.id}`, aggregate);

      console.log(
        `[BackgroundServiceWorker] Stored context aggregate: ${aggregate.id}`,
      );
    } catch (error) {
      console.error(
        "[BackgroundServiceWorker] Failed to store context aggregate:",
        error,
      );
    }
  }

  private async handleSummaryCompleted(event: BackgroundEvent): Promise<void> {
    const payload = event.payload as Record<string, Record<string, string | number>>;
    const summary = payload.summary;

    try {
      // Convert the summary object to proper Summary type
      const summaryData = summary as unknown as Summary;
      await this.storageService.storeSummary(summaryData);

      console.log(
        `[BackgroundServiceWorker] Stored summary: ${summaryData.id}`,
      );
    } catch (error) {
      console.error(
        "[BackgroundServiceWorker] Failed to store summary:",
        error,
      );
    }
  }

  private async handleStorageWrite(event: BackgroundEvent): Promise<void> {
    // Privacy audit for storage operations
    await Promise.resolve(); // Simulate async operation
    this.privacyAuditor.log(event, "storage_write", true);
  }

  private async handlePrivacyAudit(event: BackgroundEvent): Promise<void> {
    // Handle privacy audit events
    await Promise.resolve(); // Simulate async operation
    console.log("[BackgroundServiceWorker] Privacy audit:", event.payload);
  }

  private async handleError(event: BackgroundEvent): Promise<void> {
    const payload = event.payload as Record<string, Record<string, string>>;
    const error = payload.error;
    console.error("[BackgroundServiceWorker] System error: ", error);

    // Log privacy audit for errors
    await Promise.resolve(); // Simulate async operation
    this.privacyAuditor.log(event, "error_handling", true, { error });
  }

  private async handleHealthCheck(event: BackgroundEvent): Promise<void> {
    await Promise.resolve(); // Simulate async operation
    const healthStatus = this.getHealthStatus();
    console.log("[BackgroundServiceWorker] Health check:", healthStatus, event._type);
  }

  // Legacy support
  private async handleLegacyContextChange(
    context: unknown,
    source: ContextSource,
  ): Promise<void> {
    // Convert legacy context change to new event format
    await this.eventBus.emit({
      _type: BackgroundEventType.CONTEXT_CAPTURED,
      payload: {
        context,
        source,
        automatic: true,
      },
    });
  }

  private async handleTokenLimitApproaching(usage: unknown, platform: string): Promise<void> {
    console.warn(`[BackgroundServiceWorker] Token limit approaching on ${platform}:`, usage);
    
    // Emit token limit event
    await this.eventBus.emit({
      _type: BackgroundEventType.SUMMARY_TRIGGER,
      payload: {
        contextId: `platform_${platform}_${Date.now()}`,
        reason: 'token_limit',
        options: {
          algorithm: 'textrank',
          compressionRatio: 0.3,
        },
      },
      priority: 2, // HIGH priority
    });
  }

  private async handleChatMonitorInitialized(data: unknown): Promise<void> {
    console.log('[BackgroundServiceWorker] Chat monitor initialized:', data);
    
    // Emit initialization event
    await this.eventBus.emit({
      _type: BackgroundEventType.CONTEXT_CHANGED,
      payload: {
        event: 'chat_monitor_initialized',
        data,
      },
    });
  }

  private async handleIDEMonitorInitialized(data: unknown): Promise<void> {
    console.log('[BackgroundServiceWorker] IDE monitor initialized:', data);
    
    // Emit initialization event
    await this.eventBus.emit({
      _type: BackgroundEventType.CONTEXT_CHANGED,
      payload: {
        event: 'ide_monitor_initialized',
        data,
      },
    });
  }

  private async handleIDEContextCaptured(data: IDEContextData): Promise<void> {
    console.log('[BackgroundServiceWorker] IDE context captured:', data.context.metadata.tokenCount, 'tokens');
    
    // Emit context captured event
    await this.eventBus.emit({
      _type: BackgroundEventType.CONTEXT_CAPTURED,
      payload: {
        context: data.context,
        source: ContextSource.IDE,
        automatic: true,
        timestamp: data.timestamp,
      },
    });
  }

  private async handleIDETokenLimitApproaching(data: IDETokenUsageData): Promise<void> {
    console.warn('[BackgroundServiceWorker] IDE token limit approaching:', data.usage);
    
    // Emit token limit event for IDE context
    await this.eventBus.emit({
      _type: BackgroundEventType.SUMMARY_TRIGGER,
      payload: {
        contextId: `ide_${data.usage.platform}_${Date.now()}`,
        reason: 'token_limit',
        source: ContextSource.IDE,
        options: {
          algorithm: 'textrank',
          compressionRatio: 0.4, // Slightly higher compression for code
        },
      },
      priority: 2, // HIGH priority
    });
  }

  private async handleSearchRequest(query: string, sendResponse: (response?: { success: boolean; results?: Array<Record<string, string | number>>; error?: string }) => void): Promise<void> {
    try {
      const results = await this.searchOrchestrator.search({ query, filters: {} });
      sendResponse({
        success: true,
        results: results.map(r => ({
          contextId: r.contextId || '',
          relevance: r.relevance || 0,
          snippet: r.snippet || '',
          source: r.source || 'unknown',
          timestamp: r.timestamp?.getTime() || Date.now()
        })),
      });
    } catch (error) {
      console.error('[BackgroundServiceWorker] Search request failed:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  private async handleRebuildIndex(sendResponse: (response?: { success: boolean; stats?: Record<string, number | Record<string, number>>; error?: string }) => void): Promise<void> {
    try {
      await this.searchOrchestrator.rebuildIndex();
      const stats = await this.searchOrchestrator.getSearchStats();
      sendResponse({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('[BackgroundServiceWorker] Index rebuild failed:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  private async handleTabUpdate(tabId: number, url: string): Promise<void> {
    const supportedChatPlatforms = [
      "chat.openai.com",
      "claude.ai",
      "gemini.google.com",
      "bard.google.com",
    ];

    const supportedIDEPlatforms = [
      "vscode.dev",
      "github.dev",
      "replit.com",
      "codesandbox.io",
      "stackblitz.com",
    ];

    const isChatSupported = supportedChatPlatforms.some((platform) =>
      url.includes(platform),
    );

    const isIDESupported = supportedIDEPlatforms.some((platform) =>
      url.includes(platform),
    );

    if (isChatSupported) {
      console.log(
        `[BackgroundServiceWorker] Detected supported chat platform: ${url}`,
      );

      // Emit platform detection event
      await this.eventBus.emit({
        _type: BackgroundEventType.CONTEXT_CHANGED,
        payload: {
          tabId,
          url,
          platform: supportedChatPlatforms.find((p) => url.includes(p)),
          type: 'chat',
          supported: true,
        },
      });
    }

    if (isIDESupported) {
      console.log(
        `[BackgroundServiceWorker] Detected supported IDE platform: ${url}`,
      );

      // Emit platform detection event
      await this.eventBus.emit({
        _type: BackgroundEventType.CONTEXT_CHANGED,
        payload: {
          tabId,
          url,
          platform: supportedIDEPlatforms.find((p) => url.includes(p)),
          type: 'ide',
          supported: true,
        },
      });
    }
  }

  // Optimized health monitoring with adaptive intervals
  private startHealthMonitoring(): void {
    let healthCheckInterval = 5 * 60 * 1000; // Start with 5 minutes
    
    const performHealthCheck = () => {
      void (async () => {
        try {
          const healthStatus = this.getHealthStatus();
          
          // Emit health check event
          await this.eventBus.emit({
            _type: BackgroundEventType.HEALTH_CHECK,
            payload: { timestamp: Date.now(), status: healthStatus },
          });

          // Adaptive interval based on health status
          if (healthStatus._status === 'healthy') {
            healthCheckInterval = Math.min(healthCheckInterval * 1.1, 10 * 60 * 1000); // Max 10 minutes
          } else {
            healthCheckInterval = Math.max(healthCheckInterval * 0.8, 60 * 1000); // Min 1 minute
          }
        } catch (error) {
          console.error('[BackgroundServiceWorker] Health check failed:', error);
          healthCheckInterval = 60 * 1000; // Reset to 1 minute on error
        }
        
        // Schedule next health check
        this.healthCheckInterval = setTimeout(performHealthCheck, healthCheckInterval);
      })();
    };

    // Start first health check
    this.healthCheckInterval = setTimeout(performHealthCheck, healthCheckInterval);
  }

  private getHealthStatus(): HealthStatus {
    const moduleHealth: Record<string, ModuleHealth> = {};

    this.modules.forEach((module) => {
      moduleHealth[module._name] = {
        status: "healthy", // Simplified for now
        lastActivity: Date.now(),
        errorCount: 0,
      };
    });

    return {
      _status: this.eventBus.isHealthy() ? "healthy" : "degraded",
      timestamp: Date.now(),
      modules: moduleHealth,
      _metrics: {
        uptime: Date.now() - this.startTime,
        memoryUsage: 0, // Would need actual memory monitoring
        eventCount: this.eventBus.getMetrics().eventsProcessed,
        errorRate:
          this.eventBus.getMetrics().errorsOccurred /
          Math.max(this.eventBus.getMetrics().eventsProcessed, 1),
        avgResponseTime: this.eventBus.getMetrics().avgProcessingTime,
      },
    };
  }

  private async getMetrics(): Promise<Record<string, string | number | boolean>> {
    const eventBusMetrics = this.eventBus.getMetrics();
    const contextAggregatorStatus = this.contextAggregator.getStatus();
    const summarizationStatus = this.summarizationOrchestrator.getStatus();
    const searchStats = await this.searchOrchestrator.getSearchStats();
    const privacyDashboard = await this.privacyService.getPrivacyDashboard();
    const health = this.getHealthStatus();

    // Flatten complex objects to simple key-value pairs
    return {
      success: true,
      'eventBus.eventsProcessed': (eventBusMetrics.eventsProcessed as number) || 0,
      'eventBus.errorsOccurred': (eventBusMetrics.errorsOccurred as number) || 0,
      'eventBus.avgProcessingTime': (eventBusMetrics.avgProcessingTime as number) || 0,
      'contextAggregator._pendingBatches': (contextAggregatorStatus._pendingBatches) || 0,
      'contextAggregator._totalPendingContexts': (contextAggregatorStatus._totalPendingContexts) || 0,
      'summarization.totalSummaries': ((summarizationStatus._metrics)?.totalSummarizations as number) || 0,
      'summarization.averageLength': ((summarizationStatus._metrics)?.avgProcessingTime as number) || 0,
      'search.totalQueries': ((searchStats as any)?.orchestratorMetrics?.totalSearches as number) || 0,
      'search.averageResponseTime': ((searchStats as any)?.orchestratorMetrics?.avgSearchTime as number) || 0,
      'privacy.totalDataPoints': (privacyDashboard.auditSummary.totalEvents) || 0,
      'privacy.retentionCompliance': (privacyDashboard.policy.dataRetention) > 0,
      'health._status': (health._status as string) || 'unknown',
      'health.uptime': Date.now() - this.startTime,
    };
  }

  // Privacy-related handlers
  private async handleGetPrivacyDashboard(sendResponse: (response?: { success: boolean; dashboard?: Record<string, string | number | boolean>; error?: string }) => void): Promise<void> {
    try {
      const dashboard = await this.privacyService.getPrivacyDashboard();

      // Flatten the complex dashboard object to simple key-value pairs
      const flattenedDashboard: Record<string, string | number | boolean> = {
        'policy.localOnly': dashboard.policy.localOnly,
        'policy.cloudOptIn': dashboard.policy.cloudOptIn,
        'policy._auditLogging': dashboard.policy._auditLogging,
        'policy.dataRetention': dashboard.policy.dataRetention,
        'consentStatus.totalConsents': dashboard.consentStatus.totalConsents,
        'consentStatus.activeConsents': dashboard.consentStatus.activeConsents,
        'consentStatus.expiredConsents': dashboard.consentStatus.expiredConsents,
        'consentStatus.revokedConsents': dashboard.consentStatus.revokedConsents,
        'auditSummary.totalEvents': dashboard.auditSummary.totalEvents,
        'auditSummary.violationCount': dashboard.auditSummary.violationCount,
        'auditSummary.recentActivity': dashboard.auditSummary.recentActivity,
        'violations.count': dashboard.violations.length,
        'recommendations.count': dashboard.recommendations.length,
      };

      sendResponse({
        success: true,
        dashboard: flattenedDashboard,
      });
    } catch (error) {
      console.error('[BackgroundServiceWorker] Get privacy dashboard failed:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  private async handleGetAuditReport(filter: Record<string, string>, sendResponse: (response?: { success: boolean; report?: Record<string, string | number | boolean>; error?: string }) => void): Promise<void> {
    try {
      const report = await this.privacyService.getAuditReport(filter);

      // Flatten the complex report object to simple key-value pairs
      const flattenedReport: Record<string, string | number | boolean> = {
        'summary.totalEntries': report.summary.totalEntries,
        'summary.timeRange.start': report.summary.timeRange.start,
        'summary.timeRange.end': report.summary.timeRange.end,
        'summary.successRate': report.summary.successRate,
        'entries.count': report.entries.length,
        'violations.count': report.violations.length,
        'recommendations.count': report.recommendations.length,
      };

      sendResponse({
        success: true,
        report: flattenedReport,
      });
    } catch (error) {
      console.error('[BackgroundServiceWorker] Get audit report failed:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  private async handleExportAuditLog(format: 'json' | 'csv', filter: Record<string, string>, sendResponse: (response?: { success: boolean; data?: string; format?: string; error?: string }) => void): Promise<void> {
    try {
      const exportData = await this.privacyService.exportAuditLog(format, filter);
      sendResponse({
        success: true,
        data: exportData,
        format,
      });
    } catch (error) {
      console.error('[BackgroundServiceWorker] Export audit log failed:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  private async handleUpdatePrivacyPolicy(policy: { localOnly: boolean; cloudOptIn: boolean; _auditLogging: boolean; dataRetention: number }, sendResponse: (response?: { success: boolean; policy?: Record<string, string | number | boolean>; error?: string }) => void): Promise<void> {
    try {
      await Promise.resolve(); // Simulate async operation
      this.privacyService.updatePolicy(policy);
      const updatedPolicy = this.privacyService.getPolicy();

      // Flatten the policy object to simple key-value pairs
      const flattenedPolicy: Record<string, string | number | boolean> = {
        localOnly: updatedPolicy.localOnly,
        cloudOptIn: updatedPolicy.cloudOptIn,
        _auditLogging: updatedPolicy._auditLogging,
        dataRetention: updatedPolicy.dataRetention,
        allowedSourcesCount: updatedPolicy.allowedSources.length,
        blockedDomainsCount: updatedPolicy.blockedDomains.length,
      };

      sendResponse({
        success: true,
        policy: flattenedPolicy,
      });
    } catch (error) {
      console.error('[BackgroundServiceWorker] Update privacy policy failed:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  private async handleRequestConsent(consentData: { type: string; title: string; description: string; details: string; dataTypes?: string[]; purposes?: string[] }, sendResponse: (response?: { success: boolean; granted?: boolean; error?: string }) => void): Promise<void> {
    try {
      // Map string type to ConsentType enum
      const consentTypeMap: Record<string, string> = {
        'cloud_processing': 'cloud_processing',
        'data_export': 'data_export',
        'analytics': 'analytics',
        'third_party_integration': 'third_party_integration',
        'cross_device_sync': 'cross_device_sync',
        'performance_monitoring': 'performance_monitoring'
      };

      const mappedType = consentTypeMap[consentData.type] || 'cloud_processing';

      const granted = await this.privacyService.requestConsent(
        mappedType as ConsentType,
        consentData.title,
        consentData.description,
        [consentData.details],
        consentData.dataTypes || [],
        consentData.purposes || []
      );
      sendResponse({
        success: true,
        granted,
      });
    } catch (error) {
      console.error('[BackgroundServiceWorker] Request consent failed:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  private async handleRevokeConsent(consentType: string, sendResponse: (response?: { success: boolean; error?: string }) => void): Promise<void> {
    try {
      // Map string type to ConsentType enum
      const consentTypeMap: Record<string, string> = {
        'cloud_processing': 'cloud_processing',
        'data_export': 'data_export',
        'analytics': 'analytics',
        'third_party_integration': 'third_party_integration',
        'cross_device_sync': 'cross_device_sync',
        'performance_monitoring': 'performance_monitoring'
      };

      const mappedType = consentTypeMap[consentType] || 'cloud_processing';

      await this.privacyService.revokeConsent(mappedType as ConsentType);
      sendResponse({
        success: true,
      });
    } catch (error) {
      console.error('[BackgroundServiceWorker] Revoke consent failed:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  private async handleGetThreatAlerts(sendResponse: (response?: { success: boolean; alerts?: Array<Record<string, string | number | boolean>>; error?: string }) => void): Promise<void> {
    try {
      await Promise.resolve(); // Simulate async operation
      const alerts = this.privacyService.getThreatAlerts();

      // Flatten the complex alert objects to simple key-value pairs
      const flattenedAlerts = alerts.map((alert, index) => ({
        [`alert_${index}_id`]: alert.id,
        [`alert_${index}_timestamp`]: alert.timestamp,
        [`alert_${index}_type`]: alert.type,
        [`alert_${index}_severity`]: alert.severity,
        [`alert_${index}_description`]: alert.description,
        [`alert_${index}_autoMitigated`]: alert.autoMitigated,
        [`alert_${index}_eventsCount`]: alert.events.length,
        [`alert_${index}_recommendationsCount`]: alert.recommendedActions.length,
      }));

      // Flatten into a single object
      const flattenedResponse = flattenedAlerts.reduce((acc, alert) => ({ ...acc, ...alert }), {
        alertsCount: alerts.length
      });

      sendResponse({
        success: true,
        alerts: [flattenedResponse],
      });
    } catch (error) {
      console.error('[BackgroundServiceWorker] Get threat alerts failed:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  private async handleClearPrivacyData(sendResponse: (response?: { success: boolean; error?: string }) => void): Promise<void> {
    try {
      await this.privacyService.resetPrivacyData();
      sendResponse({
        success: true,
      });
    } catch (error) {
      console.error('[BackgroundServiceWorker] Clear privacy data failed:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  private handleShowConsentDialog(data: { request: { type: string; title: string; description: string; details: string } }): void {
    // This would typically create a new tab or popup with the consent dialog
    // For now, we'll log it and handle it through the popup interface
    console.log('[BackgroundServiceWorker] Consent dialog requested:', data);
    
    // Store the consent request for the popup to handle
    void chrome.storage.local.set({
      pending_consent_request: data.request,
    });

    // Notify popup if it's open
    chrome.runtime.sendMessage({
      __type: 'CONSENT_DIALOG_REQUIRED',
      request: data.request,
    }).catch(() => {
      // Popup might not be open, that's okay
    });
  }

  // Cleanup on shutdown
  async shutdown(): Promise<void> {
    console.log("[BackgroundServiceWorker] Shutting down...");

    // Clear health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Emit shutdown event
    await this.eventBus.emit({
      _type: BackgroundEventType.EXTENSION_SHUTDOWN,
      payload: { timestamp: Date.now() },
    });

    // Shutdown all modules
    for (const module of this.modules.reverse()) {
      await module.shutdown();
    }

    // Clear event bus
    this.eventBus.clear();

    console.log("[BackgroundServiceWorker] Shutdown complete");
  }
}

// Initialize background service worker
const backgroundServiceWorker = new BackgroundServiceWorker();

// Handle extension shutdown
chrome.runtime.onSuspend?.addListener(() => {
  void backgroundServiceWorker.shutdown();
});
