// Types for VS Code Extension
import * as vscode from 'vscode';

export interface ExtensionContext {
    vscodeContext: vscode.ExtensionContext;
    services: ExtensionServices;
    state: ExtensionState;
}

export interface ExtensionServices {
    storage: any;
    summarization: any;
    search: any;
    sync: any;
    contextCapture: any;
}

export interface ExtensionState {
    isEnabled: boolean;
    autoCapture: boolean;
    localOnly: boolean;
    syncWithBrowser: boolean;
}

export interface VSCodeContext {
    id: string;
    timestamp: Date;
    type: 'file' | 'selection' | 'workspace' | 'session';
    content: string;
    metadata: VSCodeContextMetadata;
    tokens: number;
}

export interface VSCodeContextMetadata {
    fileName?: string;
    filePath?: string;
    language?: string;
    workspaceName?: string;
    cursorPosition?: vscode.Position;
    selection?: vscode.Selection;
    activeEditor?: string;
    openTabs?: string[];
    gitBranch?: string;
    gitCommit?: string;
    tags: string[];
}

export interface VSCodeSummary {
    id: string;
    contextIds: string[];
    content: string;
    timestamp: Date;
    algorithm: 'textrank' | 'tfidf' | 'cloud';
    quality: {
        coherence: number;
        relevance: number;
        completeness: number;
        overall: number;
    };
    compressionRatio: number;
    metadata: {
        originalTokens: number;
        summaryTokens: number;
        processingTime: number;
        workspaceName?: string;
        language?: string;
    };
}

export interface SearchQuery {
    query: string;
    filters?: {
        type?: string[];
        language?: string[];
        workspace?: string[];
        dateRange?: {
            start: Date;
            end: Date;
        };
    };
    sort?: 'relevance' | 'date' | 'tokens';
    limit?: number;
}

export interface SearchResult {
    id: string;
    type: 'context' | 'summary';
    title: string;
    snippet: string;
    content: string;
    score: number;
    timestamp: Date;
    metadata: VSCodeContextMetadata | any;
    highlightedTerms: string[];
}

export interface SyncData {
    contexts: VSCodeContext[];
    summaries: VSCodeSummary[];
    settings: any;
    lastSync: Date;
}

export interface StorageStats {
    totalContexts: number;
    totalSummaries: number;
    totalSize: number;
    oldestContext: Date;
    newestContext: Date;
    storageQuota: number;
    usedStorage: number;
}

export interface ContextTreeItem extends vscode.TreeItem {
    contextType: 'context' | 'summary' | 'workspace' | 'file';
    data?: VSCodeContext | VSCodeSummary;
    children?: ContextTreeItem[];
}

export interface WebviewMessage {
    command: string;
    data?: any;
}

export interface DashboardData {
    stats: StorageStats;
    recentContexts: VSCodeContext[];
    recentSummaries: VSCodeSummary[];
    searchIndex: any;
}

export interface SettingsData {
    enabled: boolean;
    autoCapture: boolean;
    captureThreshold: number;
    summarizationMethod: 'local' | 'cloud';
    localOnly: boolean;
    syncWithBrowser: boolean;
    apiKeys?: {
        openai?: string;
        claude?: string;
        gemini?: string;
    };
}

// Event types
export interface ContextCaptureEvent {
    type: 'capture' | 'summarize' | 'search' | 'sync';
    data: any;
    timestamp: Date;
}

export interface SyncEvent {
    type: 'sync_start' | 'sync_complete' | 'sync_error';
    direction: 'upload' | 'download' | 'bidirectional';
    data?: SyncData;
    error?: string;
    timestamp: Date;
}

// Configuration interfaces
export interface CaptureConfig {
    autoCapture: boolean;
    threshold: number;
    includeFiles: string[];
    excludeFiles: string[];
    includeLanguages: string[];
    captureSelection: boolean;
    captureWorkspace: boolean;
}

export interface SummarizationConfig {
    method: 'local' | 'cloud';
    algorithm: 'textrank' | 'tfidf';
    quality: 'fast' | 'balanced' | 'high';
    maxTokens: number;
    compressionRatio: number;
}

export interface SyncConfig {
    enabled: boolean;
    endpoint: string;
    syncInterval: number;
    conflictResolution: 'local' | 'remote' | 'merge';
    encryptionKey?: string;
}

// Error types
export class VSCodeExtensionError extends Error {
    constructor(
        message: string,
        public code: string,
        public context?: any
    ) {
        super(message);
        this.name = 'VSCodeExtensionError';
    }
}

export class StorageError extends VSCodeExtensionError {
    constructor(message: string, context?: any) {
        super(message, 'STORAGE_ERROR', context);
    }
}

export class SyncError extends VSCodeExtensionError {
    constructor(message: string, context?: any) {
        super(message, 'SYNC_ERROR', context);
    }
}

export class CaptureError extends VSCodeExtensionError {
    constructor(message: string, context?: any) {
        super(message, 'CAPTURE_ERROR', context);
    }
}