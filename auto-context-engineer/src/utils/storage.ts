// Storage quota management utilities
import { StorageStats } from '../types';

export interface QuotaInfo {
  quota: number;
  usage: number;
  available: number;
  percentage: number;
}

export class StorageQuotaManager {
  private readonly WARNING_THRESHOLD = 0.8; // 80%
  private readonly CRITICAL_THRESHOLD = 0.9; // 90%

  async getQuotaInfo(): Promise<QuotaInfo> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      const available = quota - usage;
      const percentage = quota > 0 ? usage / quota : 0;

      return {
        quota,
        usage,
        available,
        percentage,
      };
    } else {
      // Fallback for browsers that don't support Storage API
      return {
        quota: 100 * 1024 * 1024, // Assume 100MB
        usage: 0,
        available: 100 * 1024 * 1024,
        percentage: 0,
      };
    }
  }

  async isQuotaExceeded(): Promise<boolean> {
    const quotaInfo = await this.getQuotaInfo();
    return quotaInfo.percentage >= this.CRITICAL_THRESHOLD;
  }

  async shouldShowWarning(): Promise<boolean> {
    const quotaInfo = await this.getQuotaInfo();
    return quotaInfo.percentage >= this.WARNING_THRESHOLD;
  }

  async getCleanupRecommendations(stats: StorageStats): Promise<CleanupRecommendation[]> {
    const recommendations: CleanupRecommendation[] = [];
    const quotaInfo = await this.getQuotaInfo();

    if (quotaInfo.percentage > this.WARNING_THRESHOLD) {
      // Recommend cleaning up old contexts
      if (stats.itemCount > 1000) {
        recommendations.push({
          type: 'cleanup_old_contexts',
          description: 'Remove contexts older than 30 days',
          estimatedSavings: Math.floor(stats.itemCount * 0.3 * 1024), // Rough estimate
          priority: 'high',
        });
      }

      // Recommend cleaning up old summaries
      if (stats.itemCount > 500) {
        recommendations.push({
          type: 'cleanup_old_summaries',
          description: 'Remove summaries older than 60 days',
          estimatedSavings: Math.floor(stats.itemCount * 0.2 * 512), // Rough estimate
          priority: 'medium',
        });
      }

      // Recommend compacting storage
      recommendations.push({
        type: 'compact_storage',
        description: 'Compact IndexedDB storage',
        estimatedSavings: Math.floor(stats.totalSize * 0.1),
        priority: 'low',
      });
    }

    return recommendations;
  }

  formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export interface CleanupRecommendation {
  type: 'cleanup_old_contexts' | 'cleanup_old_summaries' | 'compact_storage';
  description: string;
  estimatedSavings: number;
  priority: 'low' | 'medium' | 'high';
}

export class StorageCleanupService {
  private quotaManager: StorageQuotaManager;

  constructor() {
    this.quotaManager = new StorageQuotaManager();
  }

  async performCleanup(type: CleanupRecommendation['type']): Promise<number> {
    switch (type) {
      case 'cleanup_old_contexts':
        return this.cleanupOldContexts();
      case 'cleanup_old_summaries':
        return this.cleanupOldSummaries();
      case 'compact_storage':
        return this.compactStorage();
      default:
        return 0;
    }
  }

  private async cleanupOldContexts(): Promise<number> {
    // This would integrate with the storage service
    // For now, return estimated savings
    return 50 * 1024; // 50KB estimated
  }

  private async cleanupOldSummaries(): Promise<number> {
    // This would integrate with the storage service
    // For now, return estimated savings
    return 25 * 1024; // 25KB estimated
  }

  private async compactStorage(): Promise<number> {
    // IndexedDB doesn't have a direct compact operation
    // This could involve recreating the database
    return 10 * 1024; // 10KB estimated
  }

  async getRecommendations(stats: StorageStats): Promise<CleanupRecommendation[]> {
    return this.quotaManager.getCleanupRecommendations(stats);
  }
}

// Export individual functions for convenience
export const createStorageKey = (prefix: string, id: string): string => {
  return `${prefix}_${id}`;
};

export const parseStorageKey = (key: string): { prefix: string; id: string } => {
  const parts = key.split('_');
  return {
    prefix: parts[0],
    id: parts.slice(1).join('_'),
  };
};

export const compressData = async (data: string): Promise<string> => {
  // Simple compression using JSON.stringify optimization
  // In a real implementation, you might use a compression library
  return JSON.stringify(JSON.parse(data));
};

export const decompressData = async (compressedData: string): Promise<string> => {
  // Simple decompression - just return the data as is
  return compressedData;
};