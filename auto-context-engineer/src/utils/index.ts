// Utility functions exports - Optimized for tree shaking
export { 
  generateHash, 
  generateId, 
  secureRandomBytes 
} from "./crypto";

export { 
  validateEmail, 
  validateUrl, 
  sanitizeInput,
  validateContext,
  validateSummary 
} from "./validation";

export { 
  formatBytes, 
  formatDuration, 
  formatDate,
  truncateText,
  highlightText 
} from "./formatting";

export { 
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  API_ENDPOINTS,
  SUPPORTED_LANGUAGES,
  MAX_CONTEXT_SIZE,
  MAX_SUMMARY_SIZE 
} from "./constants";

export { 
  createStorageKey, 
  parseStorageKey,
  compressData,
  decompressData 
} from "./storage";

// Lazy-loaded utilities
export const lazyLoadTokenCounter = () => import("./tokenCounter");
export const lazyLoadBrowserDetection = () => import("./browserDetection");
