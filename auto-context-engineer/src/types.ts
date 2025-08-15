// Core type definitions for the Auto Context Engineer extension

export enum ErrorCode {
  STORAGE_ERROR = 'STORAGE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  PRIVACY_ERROR = 'PRIVACY_ERROR',
  API_ERROR = 'API_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  INVALID_INPUT = 'INVALID_INPUT',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class ExtensionError extends Error {
  public code: ErrorCode;
  public context?: Record<string, unknown>;
  public timestamp: Date;
  public recoverable: boolean;
  public severity?: 'low' | 'medium' | 'high' | 'critical';
  public component?: string;
  public operation?: string;

  constructor(
    message: string, 
    code: ErrorCode, 
    context?: Record<string, unknown>,
    recoverable: boolean = true,
    severity?: 'low' | 'medium' | 'high' | 'critical',
    component?: string,
    operation?: string
  ) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.recoverable = recoverable;
    this.severity = severity;
    this.component = component;
    this.operation = operation;
  }
}



export enum CloudProvider {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  GEMINI = 'gemini'
}

export interface CloudProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  apiKey?: string;
  costPerToken: number;
  _maxTokens: number;
  features: string[];
}

export interface SearchResult {
  contextId: string;
  relevance: number;
  snippet: string;
  highlights: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  // Additional context information for UI display
  source?: ContextSource;
  timestamp?: Date;
  tags?: string[];
  content?: string;
}

export interface AnalyticsEvent {
  type: string;
  timestamp: Date;
  data: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
}

export interface NotificationConfig {
  enabled: boolean;
  types: {
    errors: boolean;
    warnings: boolean;
    _success: boolean;
    info: boolean;
  };
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  autoHide: boolean;
  duration: number;
}

// Additional missing types
export enum ContextSource {
  CHAT = 'chat',
  IDE = 'ide',
  MANUAL = 'manual',
  CLIPBOARD = 'clipboard',
  FILE = 'file',
  WEB = 'web'
}

export interface ContextMetadata {
  source: string;
  timestamp: Date;
  tokens: number;
  tokenCount: number;
  url?: string;
  title?: string;
  tags?: string[];
  language?: string;
  fileType?: string;
  chatPlatform?: string;
}

export interface ContextSnapshot {
  id: string;
  content: string;
  metadata: ContextMetadata;
  timestamp: Date;
}

export interface TokenUsage {
  total: number;
  used: number;
  remaining: number;
  percentage: number;
  // Legacy properties for backward compatibility
  current?: number;
  limit?: number;
  platform?: string;
}

export interface SearchQuery {
  query: string;
  filters?: {
    source?: ContextSource[];
    dateRange?: {
      start: Date;
      end: Date;
    };
    tags?: string[];
    minQuality?: number;
  };
  sort?: SortOption;
  limit?: number;
}

export enum SortOption {
  RELEVANCE = 'relevance',
  DATE_DESC = 'date_desc',
  DATE_ASC = 'date_asc',
  QUALITY = 'quality'
}

export interface EncryptedData {
  data: string;
  iv: string;
  salt?: string;
  algorithm?: string;
  key?: string;
}

export interface StorageStats {
  totalSize: number;
  usedSize: number;
  availableSize: number;
  itemCount: number;
  lastCleanup: Date;
  quotaUsed?: number;
  quotaAvailable?: number;
}

export interface SummarizationOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  quality?: 'fast' | 'balanced' | 'high';
  algorithm?: LocalAlgorithm;
}

export enum LocalAlgorithm {
  TEXTRANK = 'textrank',
  TFIDF = 'tfidf',
  FREQUENCY = 'frequency',
  HYBRID = 'hybrid'
}

// Enhanced Context interface
export interface Context {
  id: string;
  content: string;
  summary?: string;
  metadata: ContextMetadata;
  encrypted: boolean;
  source: ContextSource;
  timestamp: Date;
  encryption?: {
    algorithm: string;
    keyId: string;
    iv: string;
  };
}

// Enhanced Summary interface
export interface Summary {
  id: string;
  contextId: string;
  content: string;
  method: 'local' | 'openai' | 'claude' | 'gemini';
  metadata: {
    timestamp: Date;
    tokens: number;
    cost?: number;
    quality?: number;
  };
  algorithm: LocalAlgorithm;
  timestamp: Date;
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
  quality: {
    overall: number;
    coherence: number;
    relevance: number;
    completeness: number;
  };
  keywords: string[];
}

// Enhanced UserPreferences interface
export interface UserPreferences {
  privacy: {
    localOnly: boolean;
    _auditLogging: boolean;
    dataRetention: number; // days
  };
  summarization: {
    preferredMethod: 'local' | 'cloud';
    _maxTokens: number;
    quality: 'fast' | 'balanced' | 'quality';
    localAlgorithm: LocalAlgorithm;
    compressionTarget: number;
    qualityThreshold: number;
    autoSummarize: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    compactMode: boolean;
    dashboardLayout: 'grid' | 'list';
  };
  cloud: {
    openaiKey?: string;
    claudeKey?: string;
    geminiKey?: string;
    costLimit: number;
    fallbackBehavior?: FallbackBehavior;
  };
}

// Additional type exports for compatibility
export enum Theme {
  AUTO = "auto",
  LIGHT = "light",
  DARK = "dark",
  HIGH_CONTRAST = "high-contrast"
}

export enum DashboardLayout {
  GRID = "grid",
  LIST = "list",
  COMPACT = "compact",
  DETAILED = "detailed"
}

export enum FallbackBehavior {
  LOCAL_ONLY = "local_only",
  PROMPT_USER = "prompt_user",
  FAIL_GRACEFULLY = "fail_gracefully",
  DISABLE_FEATURE = "disable_feature"
}