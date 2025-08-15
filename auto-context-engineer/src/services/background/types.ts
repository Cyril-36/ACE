// Background service worker types and interfaces
import { ContextSource, Context, Summary, LocalAlgorithm } from '../../types';

// Core event system
export interface BackgroundEvent {
  _type: string;
  payload: Record<string, unknown>;
  sender?: string;
  requestId?: string;
  timestamp?: number;
  priority?: EventPriority;
}

export enum EventPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export type EventHandler = (_event: BackgroundEvent) => Promise<void>;

// Context aggregation
export interface ContextAggregate {
  id: string;
  sources: ContextSource[];
  content: string;
  timestamp: number;
  metadata: ContextAggregateMetadata;
  tokenCount: number;
}

export interface ContextAggregateMetadata {
  platform?: string;
  language?: string;
  fileType?: string;
  sessionId?: string;
  userId?: string;
  tags: string[];
  [key: string]: unknown;
}

// Event types
export enum BackgroundEventType {
  // Context events
  CONTEXT_CAPTURED = 'CONTEXT_CAPTURED',
  CONTEXT_CHANGED = 'CONTEXT_CHANGED',
  CONTEXT_AGGREGATED = 'CONTEXT_AGGREGATED',
  
  // Summarization events
  SUMMARY_TRIGGER = 'SUMMARY_TRIGGER',
  SUMMARY_STARTED = 'SUMMARY_STARTED',
  SUMMARY_COMPLETED = 'SUMMARY_COMPLETED',
  SUMMARY_FAILED = 'SUMMARY_FAILED',
  
  // Storage events
  STORAGE_WRITE = 'STORAGE_WRITE',
  STORAGE_READ = 'STORAGE_READ',
  STORAGE_DELETE = 'STORAGE_DELETE',
  STORAGE_CLEANUP = 'STORAGE_CLEANUP',
  
  // Privacy events
  PRIVACY_AUDIT = 'PRIVACY_AUDIT',
  PRIVACY_VIOLATION = 'PRIVACY_VIOLATION',
  CONSENT_REQUIRED = 'CONSENT_REQUIRED',
  
  // Cloud events
  CLOUD_SERVICE_READY = 'CLOUD_SERVICE_READY',
  CLOUD_REQUEST_START = 'CLOUD_REQUEST_START',
  CLOUD_REQUEST_COMPLETE = 'CLOUD_REQUEST_COMPLETE',
  CLOUD_SUMMARIZATION_START = 'CLOUD_SUMMARIZATION_START',
  CLOUD_SUMMARIZATION_COMPLETE = 'CLOUD_SUMMARIZATION_COMPLETE',
  CLOUD_SUMMARIZATION_ERROR = 'CLOUD_SUMMARIZATION_ERROR',
  
  // Communication events
  MESSAGE_FROM_CONTENT = 'MESSAGE_FROM_CONTENT',
  MESSAGE_FROM_POPUP = 'MESSAGE_FROM_POPUP',
  MESSAGE_FROM_OPTIONS = 'MESSAGE_FROM_OPTIONS',
  
  // System events
  EXTENSION_STARTUP = 'EXTENSION_STARTUP',
  EXTENSION_SHUTDOWN = 'EXTENSION_SHUTDOWN',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  HEALTH_CHECK = 'HEALTH_CHECK',
}

// Specific event payloads
export interface ContextCapturedPayload {
  context: Context;
  source: ContextSource;
  automatic: boolean;
}

export interface SummaryTriggerPayload {
  contextId: string;
  reason: 'token_limit' | 'manual' | 'scheduled' | 'context_change';
  options?: {
    algorithm?: string;
    compressionRatio?: number;
    targetLength?: number;
  };
}

export interface SummaryCompletedPayload {
  contextId: string;
  summary: Summary;
  processingTime: number;
  algorithm: string;
}

export interface StorageWritePayload {
  key: string;
  data: unknown;
  encrypted: boolean;
  type: 'context' | 'summary' | 'preferences' | 'general';
}

export interface PrivacyAuditPayload {
  action: string;
  dataType: string;
  _success: boolean;
  details?: Record<string, unknown>;
}

export interface MessagePayload {
  _type: string;
  data: unknown;
  tabId?: number;
  frameId?: number;
}

// Privacy and audit
export interface PrivacyPolicy {
  localOnly: boolean;
  cloudOptIn: boolean;
  _auditLogging: boolean;
  dataRetention: number; // days
  allowedSources: ContextSource[];
  blockedDomains: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  event: string;
  action: string;
  dataType: string;
  _success: boolean;
  details?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
}

// Module interfaces
export interface BackgroundModule {
  _name: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  handleEvent?(_event: BackgroundEvent): Promise<void>;
}

export interface ContextAggregatorConfig {
  _batchSize: number;
  batchTimeout: number; // ms
  tokenThreshold: number;
  sources: ContextSource[];
}

export interface SummarizationOrchestratorConfig {
  autoTrigger: boolean;
  tokenThreshold: number;
  debounceTime: number; // ms
  defaultAlgorithm: LocalAlgorithm;
  qualityThreshold: number;
}

export interface MessageBrokerConfig {
  responseTimeout: number; // ms
  maxRetries: number;
  enableLogging: boolean;
}

// Error handling
export interface BackgroundError {
  id: string;
  timestamp: number;
  type: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  recoverable: boolean;
}

export enum ErrorType {
  STORAGE_ERROR = 'STORAGE_ERROR',
  SUMMARIZATION_ERROR = 'SUMMARIZATION_ERROR',
  PRIVACY_ERROR = 'PRIVACY_ERROR',
  COMMUNICATION_ERROR = 'COMMUNICATION_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
}

// Health monitoring
export interface HealthStatus {
  _status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  modules: Record<string, ModuleHealth>;
  _metrics: HealthMetrics;
}

export interface ModuleHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastActivity: number;
  errorCount: number;
  details?: Record<string, unknown>;
}

export interface HealthMetrics {
  uptime: number;
  memoryUsage: number;
  eventCount: number;
  errorRate: number;
  avgResponseTime: number;
}