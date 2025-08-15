// Core data models for Auto Context Engineer

export interface Context {
  id: string;
  source: ContextSource;
  timestamp: number;
  content: string;
  summary?: Summary;
  metadata: ContextMetadata;
  encryption: EncryptionInfo;
}

export interface ContextMetadata {
  tokenCount: number;
  language?: string;
  fileType?: string;
  chatPlatform?: string;
  tags: string[];
}

export interface EncryptionInfo {
  algorithm: string;
  keyId: string;
  iv: string;
}

export interface Summary {
  id: string;
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
  content: string;
  keywords: string[];
  algorithm: string;
  timestamp: number;
  quality: QualityScore;
}

export interface QualityScore {
  coherence: number;
  relevance: number;
  completeness: number;
  overall: number;
}

export interface UserPreferences {
  privacy: PrivacySettings;
  summarization: SummarizationSettings;
  cloud: CloudSettings;
  ui: UISettings;
}

export interface PrivacySettings {
  localOnly: boolean;
  cloudOptIn: boolean;
  _auditLogging: boolean;
}

export interface SummarizationSettings {
  localAlgorithm: LocalAlgorithm;
  compressionTarget: number;
  qualityThreshold: number;
  autoSummarize: boolean;
}

export interface CloudSettings {
  providers: CloudProviderConfig[];
  costLimits: CostLimits;
  fallbackBehavior: FallbackBehavior;
}

export interface UISettings {
  theme: Theme;
  dashboardLayout: DashboardLayout;
  notifications: NotificationSettings;
}

// Enums and supporting types
export enum ContextSource {
  IDE = "ide",
  CHAT = "chat",
  WEB = "web",
  MANUAL = "manual",
  CLIPBOARD = "clipboard",
  FILE = "file",
}

export enum LocalAlgorithm {
  TEXTRANK = "textrank",
  TFIDF = "tfidf",
  FREQUENCY = "frequency",
}

export enum CloudProvider {
  OPENAI = "openai",
  CLAUDE = "claude",
  GEMINI = "gemini",
}

export enum Theme {
  LIGHT = "light",
  DARK = "dark",
  AUTO = "auto",
}

export enum DashboardLayout {
  COMPACT = "compact",
  DETAILED = "detailed",
  CUSTOM = "custom",
}

export enum FallbackBehavior {
  LOCAL_ONLY = "local_only",
  PROMPT_USER = "prompt_user",
  DISABLE_FEATURE = "disable_feature",
}

export interface CloudProviderConfig {
  _provider: CloudProvider;
  apiKey: string;
  enabled: boolean;
  priority: number;
}

export interface CostLimits {
  dailyLimit: number;
  monthlyLimit: number;
  perRequestLimit: number;
}

export interface NotificationSettings {
  showSummaryComplete: boolean;
  showTokenLimitWarning: boolean;
  showStorageWarning: boolean;
  showErrorNotifications: boolean;
}

// Search and retrieval types
export interface SearchQuery {
  text: string;
  filters: SearchFilters;
  sortBy: SortOption;
  limit: number;
}

export interface SearchFilters {
  sources?: ContextSource[];
  dateRange?: DateRange;
  tags?: string[];
  minQuality?: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export enum SortOption {
  RELEVANCE = "relevance",
  DATE_DESC = "date_desc",
  DATE_ASC = "date_asc",
  QUALITY = "quality",
}

export interface SearchResult {
  context: Context;
  relevanceScore: number;
  snippet: string;
  highlightedTerms: string[];
}

// Storage and encryption types
export interface EncryptedData {
  data: string;
  iv: string;
  algorithm: string;
  key: string;
}

export interface StorageStats {
  totalSize: number;
  contextCount: number;
  summaryCount: number;
  lastCleanup: Date;
  quotaUsed: number;
  quotaAvailable: number;
}

// API and processing types
export interface SummarizationOptions {
  algorithm: LocalAlgorithm | CloudProvider;
  targetLength?: number;
  preserveKeywords?: string[];
  quality: "fast" | "balanced" | "high";
}

export interface TokenUsage {
  current: number;
  limit: number;
  percentage: number;
  platform: string;
}

export interface ContextSnapshot {
  id: string;
  timestamp: number;
  source: ContextSource;
  data: Record<string, unknown>;
  tokenCount: number;
}

// Error handling types
export interface ExtensionError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: Date;
  recoverable: boolean;
}

export enum ErrorCode {
  STORAGE_ERROR = "STORAGE_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  PROCESSING_ERROR = "PROCESSING_ERROR",
  PERMISSION_ERROR = "PERMISSION_ERROR",
  PRIVACY_ERROR = "PRIVACY_ERROR",
}
