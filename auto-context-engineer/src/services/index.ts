// Service layer exports - Optimized for tree shaking
export { IndexedDBStorageService } from "./storage";
export type { StorageService } from "./storage";

export { TextSummarizationService } from "./summarization";
export type { SummarizationService } from "./summarization";

export type { ContextService } from "./context";

export type { SearchService } from "./search";

export { WebCryptoEncryptionService } from "./encryption";
export type { EncryptionService } from "./encryption";

export type { APIService } from "./api";

// Lazy-loaded services for better performance
export const lazyLoadAnalytics = () => import("./analytics/analyticsService");
export const lazyLoadCloud = () => import("./cloud/cloudService");
export const lazyLoadPrivacy = () => import("./privacy/privacyService");
