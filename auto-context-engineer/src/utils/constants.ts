// Application constants
export const APP_CONSTANTS = {
  // Storage keys
  STORAGE_KEYS: {
    CONTEXTS: "ace_contexts",
    SUMMARIES: "ace_summaries",
    PREFERENCES: "ace_preferences",
    ENCRYPTION_KEY: "ace_encryption_key",
    SEARCH_INDEX: "ace_search_index",
  },

  // Token limits for different platforms
  TOKEN_LIMITS: {
    CHATGPT: 4096,
    CLAUDE: 8192,
    GEMINI: 8192,
    DEFAULT: 4096,
  },

  // Summarization settings
  SUMMARIZATION: {
    DEFAULT_COMPRESSION_RATIO: 0.3,
    MIN_CONTENT_LENGTH: 100,
    MAX_CONTENT_LENGTH: 100000,
    QUALITY_THRESHOLD: 0.7,
  },

  // Storage limits
  STORAGE: {
    MAX_CONTEXTS: 10000,
    MAX_STORAGE_SIZE: 100 * 1024 * 1024, // 100MB
    CLEANUP_THRESHOLD: 0.9,
  },

  // API settings
  API: {
    REQUEST_TIMEOUT: 30000,
    MAX_RETRIES: 3,
    RATE_LIMIT_DELAY: 1000,
  },

  // UI settings
  UI: {
    SEARCH_DEBOUNCE: 300,
    NOTIFICATION_DURATION: 5000,
    MAX_PREVIEW_LENGTH: 200,
  },
};

export const SUPPORTED_PLATFORMS = [
  "chat.openai.com",
  "claude.ai",
  "gemini.google.com",
  "bard.google.com",
];

export const SUPPORTED_FILE_TYPES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "cpp",
  "c",
  "html",
  "css",
  "json",
  "markdown",
  "text",
];

// Export individual constants for convenience
export const DEFAULT_SETTINGS = {
  privacy: {
    localOnly: true,
    _auditLogging: true,
    dataRetention: 30,
  },
  summarization: {
    preferredMethod: 'local' as const,
    _maxTokens: 4000,
    quality: 'balanced' as const,
    localAlgorithm: 'hybrid' as const,
    compressionTarget: 0.3,
    qualityThreshold: 0.7,
    autoSummarize: true,
  },
  ui: {
    theme: 'auto' as const,
    notifications: true,
    compactMode: false,
    dashboardLayout: 'grid' as const,
  },
  cloud: {
    costLimit: 10,
  },
};

export const STORAGE_KEYS = APP_CONSTANTS.STORAGE_KEYS;
export const API_ENDPOINTS = APP_CONSTANTS.API;
export const SUPPORTED_LANGUAGES = SUPPORTED_FILE_TYPES;
export const MAX_CONTEXT_SIZE = APP_CONSTANTS.SUMMARIZATION.MAX_CONTENT_LENGTH;
export const MAX_SUMMARY_SIZE = APP_CONSTANTS.SUMMARIZATION.MAX_CONTENT_LENGTH;
