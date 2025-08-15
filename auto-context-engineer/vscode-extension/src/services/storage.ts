// Storage Service for VS Code Extension
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { VSCodeContext, VSCodeSummary, StorageStats, StorageError } from '../types';

export class StorageService {
    private readonly CONTEXTS_KEY = 'autoContextEngineer.contexts';
    private readonly SUMMARIES_KEY = 'autoContextEngineer.summaries';
    // private readonly _SETTINGS_KEY = 'autoContextEngineer.settings';
    private readonly ENCRYPTION_KEY = 'autoContextEngineer.encryptionKey';
    
    private encryptionKey: string | null = null;
    private isInitialized = false;

    constructor(private context: vscode.ExtensionContext) {}

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Initialize or retrieve encryption key
            await this.initializeEncryption();
            
            // Migrate old data if necessary
            await this.migrateData();
            
            this.isInitialized = true;
            console.log('Storage service initialized');
        } catch (error) {
            console.error('Failed to initialize storage service:', error);
            throw new StorageError('Failed to initialize storage service', { error });
        }
    }

    async saveContext(context: VSCodeContext): Promise<void> {
        try {
            const contexts = await this.getContexts();
            contexts.push(context);
            
            // Keep only the most recent 1000 contexts to manage storage
            if (contexts.length > 1000) {
                contexts.splice(0, contexts.length - 1000);
            }
            
            await this.saveContexts(contexts);
            console.log('Context saved:', context.id);
        } catch (error) {
            console.error('Failed to save context:', error);
            throw new StorageError('Failed to save context', { contextId: context.id, error });
        }
    }

    async getContext(id: string): Promise<VSCodeContext | null> {
        try {
            const contexts = await this.getContexts();
            return contexts.find(c => c.id === id) || null;
        } catch (error) {
            console.error('Failed to get context:', error);
            throw new StorageError('Failed to get context', { contextId: id, error });
        }
    }

    async getContexts(): Promise<VSCodeContext[]> {
        try {
            const encrypted = this.context.globalState.get<string>(this.CONTEXTS_KEY);
            if (!encrypted) {
                return [];
            }
            
            const decrypted = this.decrypt(encrypted);
            return JSON.parse(decrypted).map((c: any) => ({
                ...c,
                timestamp: new Date(c.timestamp)
            }));
        } catch (error) {
            console.error('Failed to get contexts:', error);
            return [];
        }
    }

    async getRecentContexts(limit: number = 10): Promise<VSCodeContext[]> {
        try {
            const contexts = await this.getContexts();
            return contexts
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, limit);
        } catch (error) {
            console.error('Failed to get recent contexts:', error);
            return [];
        }
    }

    async searchContexts(query: string): Promise<VSCodeContext[]> {
        try {
            const contexts = await this.getContexts();
            const lowerQuery = query.toLowerCase();
            
            return contexts.filter(context => 
                context.content.toLowerCase().includes(lowerQuery) ||
                context.metadata.fileName?.toLowerCase().includes(lowerQuery) ||
                context.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
            );
        } catch (error) {
            console.error('Failed to search contexts:', error);
            return [];
        }
    }

    async deleteContext(id: string): Promise<boolean> {
        try {
            const contexts = await this.getContexts();
            const index = contexts.findIndex(c => c.id === id);
            
            if (index === -1) {
                return false;
            }
            
            contexts.splice(index, 1);
            await this.saveContexts(contexts);
            return true;
        } catch (error) {
            console.error('Failed to delete context:', error);
            throw new StorageError('Failed to delete context', { contextId: id, error });
        }
    }

    async saveSummary(summary: VSCodeSummary): Promise<void> {
        try {
            const summaries = await this.getSummaries();
            summaries.push(summary);
            
            // Keep only the most recent 500 summaries
            if (summaries.length > 500) {
                summaries.splice(0, summaries.length - 500);
            }
            
            await this.saveSummaries(summaries);
            console.log('Summary saved:', summary.id);
        } catch (error) {
            console.error('Failed to save summary:', error);
            throw new StorageError('Failed to save summary', { summaryId: summary.id, error });
        }
    }

    async getSummary(id: string): Promise<VSCodeSummary | null> {
        try {
            const summaries = await this.getSummaries();
            return summaries.find(s => s.id === id) || null;
        } catch (error) {
            console.error('Failed to get summary:', error);
            throw new StorageError('Failed to get summary', { summaryId: id, error });
        }
    }

    async getSummaries(): Promise<VSCodeSummary[]> {
        try {
            const encrypted = this.context.globalState.get<string>(this.SUMMARIES_KEY);
            if (!encrypted) {
                return [];
            }
            
            const decrypted = this.decrypt(encrypted);
            return JSON.parse(decrypted).map((s: any) => ({
                ...s,
                timestamp: new Date(s.timestamp)
            }));
        } catch (error) {
            console.error('Failed to get summaries:', error);
            return [];
        }
    }

    async getRecentSummaries(limit: number = 10): Promise<VSCodeSummary[]> {
        try {
            const summaries = await this.getSummaries();
            return summaries
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, limit);
        } catch (error) {
            console.error('Failed to get recent summaries:', error);
            return [];
        }
    }

    async deleteSummary(id: string): Promise<boolean> {
        try {
            const summaries = await this.getSummaries();
            const index = summaries.findIndex(s => s.id === id);
            
            if (index === -1) {
                return false;
            }
            
            summaries.splice(index, 1);
            await this.saveSummaries(summaries);
            return true;
        } catch (error) {
            console.error('Failed to delete summary:', error);
            throw new StorageError('Failed to delete summary', { summaryId: id, error });
        }
    }

    async getStorageStats(): Promise<StorageStats> {
        try {
            const contexts = await this.getContexts();
            const summaries = await this.getSummaries();
            
            const totalSize = this.calculateStorageSize(contexts, summaries);
            const timestamps = contexts.map(c => c.timestamp);
            
            return {
                totalContexts: contexts.length,
                totalSummaries: summaries.length,
                totalSize,
                oldestContext: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : new Date(),
                newestContext: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : new Date(),
                storageQuota: 100 * 1024 * 1024, // 100MB estimated quota
                usedStorage: totalSize
            };
        } catch (error) {
            console.error('Failed to get storage stats:', error);
            throw new StorageError('Failed to get storage stats', { error });
        }
    }

    async clearAllData(): Promise<void> {
        try {
            await this.context.globalState.update(this.CONTEXTS_KEY, undefined);
            await this.context.globalState.update(this.SUMMARIES_KEY, undefined);
            console.log('All data cleared');
        } catch (error) {
            console.error('Failed to clear data:', error);
            throw new StorageError('Failed to clear data', { error });
        }
    }

    async exportData(): Promise<{ contexts: VSCodeContext[], summaries: VSCodeSummary[] }> {
        try {
            const contexts = await this.getContexts();
            const summaries = await this.getSummaries();
            return { contexts, summaries };
        } catch (error) {
            console.error('Failed to export data:', error);
            throw new StorageError('Failed to export data', { error });
        }
    }

    async importData(data: { contexts: VSCodeContext[], summaries: VSCodeSummary[] }): Promise<void> {
        try {
            await this.saveContexts(data.contexts);
            await this.saveSummaries(data.summaries);
            console.log('Data imported successfully');
        } catch (error) {
            console.error('Failed to import data:', error);
            throw new StorageError('Failed to import data', { error });
        }
    }

    private async saveContexts(contexts: VSCodeContext[]): Promise<void> {
        const serialized = JSON.stringify(contexts);
        const encrypted = this.encrypt(serialized);
        await this.context.globalState.update(this.CONTEXTS_KEY, encrypted);
    }

    private async saveSummaries(summaries: VSCodeSummary[]): Promise<void> {
        const serialized = JSON.stringify(summaries);
        const encrypted = this.encrypt(serialized);
        await this.context.globalState.update(this.SUMMARIES_KEY, encrypted);
    }

    private async initializeEncryption(): Promise<void> {
        // Try to get existing encryption key
        this.encryptionKey = this.context.globalState.get<string>(this.ENCRYPTION_KEY) || null;
        
        if (!this.encryptionKey) {
            // Generate new encryption key
            this.encryptionKey = crypto.randomBytes(32).toString('hex');
            await this.context.globalState.update(this.ENCRYPTION_KEY, this.encryptionKey);
        }
    }

    private encrypt(text: string): string {
        if (!this.encryptionKey) {
            throw new StorageError('Encryption key not initialized');
        }
        
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return iv.toString('hex') + ':' + encrypted;
    }

    private decrypt(encryptedText: string): string {
        if (!this.encryptionKey) {
            throw new StorageError('Encryption key not initialized');
        }
        
        const parts = encryptedText.split(':');
        if (parts.length !== 2) {
            throw new StorageError('Invalid encrypted data format');
        }
        
        // const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        
        const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    private calculateStorageSize(contexts: VSCodeContext[], summaries: VSCodeSummary[]): number {
        const contextsSize = JSON.stringify(contexts).length;
        const summariesSize = JSON.stringify(summaries).length;
        return contextsSize + summariesSize;
    }

    private async migrateData(): Promise<void> {
        // Placeholder for future data migration logic
        console.log('Data migration check completed');
    }
}