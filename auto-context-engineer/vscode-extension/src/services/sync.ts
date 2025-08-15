// Sync Service for VS Code Extension - Browser Integration
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { VSCodeContext, VSCodeSummary, SyncData, SyncEvent, SyncError } from '../types';
import { StorageService } from './storage';

export class SyncService {
    // private readonly _SYNC_PORT = 'auto-context-engineer-sync';
    private readonly SYNC_INTERVAL = 30000; // 30 seconds
    // private readonly _MAX_RETRY_ATTEMPTS = 3;
    
    private isInitialized = false;
    private syncInterval?: NodeJS.Timeout;
    private lastSyncTime: Date | null = null;
    private syncInProgress = false;
    private eventEmitter = new vscode.EventEmitter<SyncEvent>();
    
    public readonly onSyncEvent = this.eventEmitter.event;

    constructor(private storageService: StorageService) {}

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Check if sync is enabled in configuration
            const config = vscode.workspace.getConfiguration('autoContextEngineer');
            const syncEnabled = config.get('syncWithBrowser', false);
            
            if (!syncEnabled) {
                console.log('Browser sync is disabled');
                return;
            }

            // Start periodic sync
            this.startPeriodicSync();
            
            this.isInitialized = true;
            console.log('Sync service initialized');
        } catch (error) {
            console.error('Failed to initialize sync service:', error);
            throw new SyncError('Failed to initialize sync service', { error });
        }
    }

    async syncWithBrowser(): Promise<void> {
        if (this.syncInProgress) {
            console.log('Sync already in progress, skipping');
            return;
        }

        this.syncInProgress = true;
        this.emitSyncEvent('sync_start', 'bidirectional');

        try {
            // Try to establish connection with browser extension
            const browserData = await this.getBrowserData();
            
            if (browserData) {
                // Perform bidirectional sync
                await this.performBidirectionalSync(browserData);
                this.lastSyncTime = new Date();
                this.emitSyncEvent('sync_complete', 'bidirectional', browserData);
                console.log('Sync with browser completed successfully');
            } else {
                console.log('Browser extension not found or not responding');
            }
        } catch (error) {
            console.error('Sync failed:', error);
            this.emitSyncEvent('sync_error', 'bidirectional', undefined, error instanceof Error ? error.message : String(error));
            throw new SyncError('Sync with browser failed', { error });
        } finally {
            this.syncInProgress = false;
        }
    }

    async uploadToBrowser(): Promise<void> {
        this.emitSyncEvent('sync_start', 'upload');

        try {
            const vsCodeData = await this.getVSCodeData();
            await this.sendDataToBrowser(vsCodeData);
            
            this.emitSyncEvent('sync_complete', 'upload', vsCodeData);
            console.log('Data uploaded to browser successfully');
        } catch (error) {
            console.error('Upload to browser failed:', error);
            this.emitSyncEvent('sync_error', 'upload', undefined, error instanceof Error ? error.message : String(error));
            throw new SyncError('Upload to browser failed', { error });
        }
    }

    async downloadFromBrowser(): Promise<void> {
        this.emitSyncEvent('sync_start', 'download');

        try {
            const browserData = await this.getBrowserData();
            
            if (browserData) {
                await this.importBrowserData(browserData);
                this.emitSyncEvent('sync_complete', 'download', browserData);
                console.log('Data downloaded from browser successfully');
            } else {
                throw new Error('No data received from browser');
            }
        } catch (error) {
            console.error('Download from browser failed:', error);
            this.emitSyncEvent('sync_error', 'download', undefined, error instanceof Error ? error.message : String(error));
            throw new SyncError('Download from browser failed', { error });
        }
    }

    async getLastSyncTime(): Promise<Date | null> {
        return this.lastSyncTime;
    }

    async getSyncStatus(): Promise<{
        isEnabled: boolean;
        lastSync: Date | null;
        syncInProgress: boolean;
        browserConnected: boolean;
    }> {
        const config = vscode.workspace.getConfiguration('autoContextEngineer');
        const browserConnected = await this.checkBrowserConnection();
        
        return {
            isEnabled: config.get('syncWithBrowser', false),
            lastSync: this.lastSyncTime,
            syncInProgress: this.syncInProgress,
            browserConnected
        };
    }

    private async getBrowserData(): Promise<SyncData | null> {
        try {
            // Attempt to communicate with browser extension via native messaging
            // This is a simplified implementation - in practice, you'd need to set up
            // native messaging host or use a local server/file-based approach
            
            const response = await this.sendMessageToBrowser({
                type: 'GET_SYNC_DATA',
                timestamp: new Date().toISOString()
            });
            
            if (response && response.success) {
                return this.validateAndDecryptSyncData(response.data);
            }
            
            return null;
        } catch (error) {
            console.error('Failed to get browser data:', error);
            return null;
        }
    }

    private async getVSCodeData(): Promise<SyncData> {
        const contexts = await this.storageService.getContexts();
        const summaries = await this.storageService.getSummaries();
        
        // Convert VS Code specific data to browser-compatible format
        const browserCompatibleContexts = contexts.map(this.convertContextToBrowserFormat);
        const browserCompatibleSummaries = summaries.map(this.convertSummaryToBrowserFormat);
        
        return {
            contexts: browserCompatibleContexts,
            summaries: browserCompatibleSummaries,
            settings: await this.getVSCodeSettings(),
            lastSync: new Date()
        };
    }

    private async performBidirectionalSync(browserData: SyncData): Promise<void> {
        const vsCodeData = await this.getVSCodeData();
        
        // Merge data from both sources
        const mergedData = await this.mergeData(vsCodeData, browserData);
        
        // Update VS Code storage
        await this.importBrowserData(mergedData);
        
        // Send merged data back to browser
        await this.sendDataToBrowser(mergedData);
    }

    private async mergeData(vsCodeData: SyncData, browserData: SyncData): Promise<SyncData> {
        // Simple merge strategy - can be improved with conflict resolution
        const allContexts = [...vsCodeData.contexts, ...browserData.contexts];
        const allSummaries = [...vsCodeData.summaries, ...browserData.summaries];
        
        // Remove duplicates based on ID
        const uniqueContexts = allContexts.filter((context, index, array) => 
            array.findIndex(c => c.id === context.id) === index
        );
        
        const uniqueSummaries = allSummaries.filter((summary, index, array) => 
            array.findIndex(s => s.id === summary.id) === index
        );
        
        return {
            contexts: uniqueContexts,
            summaries: uniqueSummaries,
            settings: { ...browserData.settings, ...vsCodeData.settings },
            lastSync: new Date()
        };
    }

    private async importBrowserData(data: SyncData): Promise<void> {
        // Convert browser data to VS Code format and import
        const vsCodeContexts = data.contexts.map(this.convertContextFromBrowserFormat);
        const vsCodeSummaries = data.summaries.map(this.convertSummaryFromBrowserFormat);
        
        // Import data (this will merge with existing data)
        await this.storageService.importData({
            contexts: vsCodeContexts,
            summaries: vsCodeSummaries
        });
    }

    private async sendDataToBrowser(data: SyncData): Promise<void> {
        const encryptedData = this.encryptSyncData(data);
        
        await this.sendMessageToBrowser({
            type: 'SYNC_DATA',
            data: encryptedData,
            timestamp: new Date().toISOString()
        });
    }

    private async sendMessageToBrowser(message: any): Promise<any> {
        // This is a placeholder for actual browser communication
        // In a real implementation, you would use:
        // 1. Native messaging (requires native host setup)
        // 2. Local HTTP server
        // 3. File-based communication
        // 4. WebSocket connection
        
        return new Promise((resolve, _reject) => {
            // Simulate browser communication
            setTimeout(() => {
                // Mock response for development
                if (message.type === 'GET_SYNC_DATA') {
                    resolve({
                        success: true,
                        data: {
                            contexts: [],
                            summaries: [],
                            settings: {},
                            lastSync: new Date()
                        }
                    });
                } else {
                    resolve({ success: true });
                }
            }, 1000);
        });
    }

    private async checkBrowserConnection(): Promise<boolean> {
        try {
            const response = await this.sendMessageToBrowser({
                type: 'PING',
                timestamp: new Date().toISOString()
            });
            
            return response && response.success;
        } catch (error) {
            return false;
        }
    }

    private convertContextToBrowserFormat(context: VSCodeContext): any {
        // Convert VS Code context to browser extension format
        return {
            id: context.id,
            timestamp: context.timestamp,
            source: 'vscode',
            content: context.content,
            metadata: {
                ...context.metadata,
                source: 'vscode',
                tokens: context.tokens
            }
        };
    }

    private convertSummaryToBrowserFormat(summary: VSCodeSummary): any {
        // Convert VS Code summary to browser extension format
        return {
            id: summary.id,
            contextIds: summary.contextIds,
            content: summary.content,
            timestamp: summary.timestamp,
            algorithm: summary.algorithm,
            quality: summary.quality,
            compressionRatio: summary.compressionRatio,
            metadata: summary.metadata
        };
    }

    private convertContextFromBrowserFormat(browserContext: any): VSCodeContext {
        // Convert browser context to VS Code format
        return {
            id: browserContext.id,
            timestamp: new Date(browserContext.timestamp),
            type: 'file', // Default type for browser contexts
            content: browserContext.content,
            metadata: {
                fileName: browserContext.metadata.fileName,
                filePath: browserContext.metadata.filePath,
                language: browserContext.metadata.language,
                tags: browserContext.metadata.tags || []
            },
            tokens: browserContext.metadata.tokens || this.estimateTokenCount(browserContext.content)
        };
    }

    private convertSummaryFromBrowserFormat(browserSummary: any): VSCodeSummary {
        // Convert browser summary to VS Code format
        return {
            id: browserSummary.id,
            contextIds: browserSummary.contextIds,
            content: browserSummary.content,
            timestamp: new Date(browserSummary.timestamp),
            algorithm: browserSummary.algorithm,
            quality: browserSummary.quality,
            compressionRatio: browserSummary.compressionRatio,
            metadata: browserSummary.metadata
        };
    }

    private async getVSCodeSettings(): Promise<any> {
        const config = vscode.workspace.getConfiguration('autoContextEngineer');
        
        return {
            enabled: config.get('enabled'),
            autoCapture: config.get('autoCapture'),
            captureThreshold: config.get('captureThreshold'),
            summarizationMethod: config.get('summarizationMethod'),
            localOnly: config.get('localOnly')
        };
    }

    private encryptSyncData(data: SyncData): string {
        // Simple encryption for sync data
        const jsonData = JSON.stringify(data);
        const key = crypto.randomBytes(32);
        // const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipher('aes-256-cbc', key);
        let encrypted = cipher.update(jsonData, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return encrypted;
    }

    private validateAndDecryptSyncData(encryptedData: string): SyncData {
        // Placeholder for data validation and decryption
        // In practice, you'd decrypt and validate the data structure
        try {
            return JSON.parse(encryptedData);
        } catch (error) {
            throw new SyncError('Invalid sync data format', { error });
        }
    }

    private startPeriodicSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        this.syncInterval = setInterval(async () => {
            try {
                await this.syncWithBrowser();
            } catch (error) {
                console.error('Periodic sync failed:', error);
            }
        }, this.SYNC_INTERVAL);
    }

    private stopPeriodicSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = undefined;
        }
    }

    private emitSyncEvent(
        type: SyncEvent['type'],
        direction: SyncEvent['direction'],
        data?: SyncData,
        error?: string
    ): void {
        this.eventEmitter.fire({
            type,
            direction,
            data,
            error,
            timestamp: new Date()
        });
    }

    private estimateTokenCount(text: string): number {
        return Math.ceil(text.length / 4);
    }

    dispose(): void {
        this.stopPeriodicSync();
        this.eventEmitter.dispose();
        this.isInitialized = false;
    }
}