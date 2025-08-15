// Unit tests for storage quota management
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageQuotaManager, StorageCleanupService } from '../storage';
import { StorageStats } from '../../types';



// Removed unused interface

describe('StorageQuotaManager', () => {
  let quotaManager: StorageQuotaManager;
  let mockStorageStats: StorageStats;

  beforeEach(() => {
    quotaManager = new StorageQuotaManager();
    
    mockStorageStats = {
      totalSize: 100 * 1024 * 1024, // 100MB
      usedSize: 50 * 1024 * 1024, // 50MB
      availableSize: 50 * 1024 * 1024, // 50MB
      itemCount: 1250,
      lastCleanup: new Date(),
      quotaUsed: 50 * 1024 * 1024,
      quotaAvailable: 50 * 1024 * 1024,
    };

    // Mock navigator.storage.estimate
    Object.defineProperty(navigator, 'storage', {
      value: {
        estimate: vi.fn(),
      },
      configurable: true,
    });
  });

  describe('getQuotaInfo', () => {
    it('should return quota information when Storage API is available', async () => {
      const mockEstimate = {
        quota: 100 * 1024 * 1024, // 100MB
        usage: 80 * 1024 * 1024,  // 80MB
      };

      (navigator.storage as any).estimate.mockResolvedValue(mockEstimate);

      const quotaInfo = await quotaManager.getQuotaInfo();

      expect(quotaInfo.quota).toBe(mockEstimate.quota);
      expect(quotaInfo.usage).toBe(mockEstimate.usage);
      expect(quotaInfo.available).toBe(20 * 1024 * 1024);
      expect(quotaInfo.percentage).toBe(0.8);
    });

    it('should return fallback values when Storage API is not available', async () => {
      // Remove storage API
      delete (navigator as any).storage;

      const quotaInfo = await quotaManager.getQuotaInfo();

      expect(quotaInfo.quota).toBe(100 * 1024 * 1024);
      expect(quotaInfo.usage).toBe(0);
      expect(quotaInfo.available).toBe(100 * 1024 * 1024);
      expect(quotaInfo.percentage).toBe(0);
    });
  });

  describe('isQuotaExceeded', () => {
    it('should return true when quota is exceeded', async () => {
      const mockEstimate = {
        quota: 100 * 1024 * 1024,
        usage: 95 * 1024 * 1024, // 95% usage
      };

      (navigator.storage as any).estimate.mockResolvedValue(mockEstimate);

      const isExceeded = await quotaManager.isQuotaExceeded();
      expect(isExceeded).toBe(true);
    });

    it('should return false when quota is not exceeded', async () => {
      const mockEstimate = {
        quota: 100 * 1024 * 1024,
        usage: 70 * 1024 * 1024, // 70% usage
      };

      (navigator.storage as any).estimate.mockResolvedValue(mockEstimate);

      const isExceeded = await quotaManager.isQuotaExceeded();
      expect(isExceeded).toBe(false);
    });
  });

  describe('shouldShowWarning', () => {
    it('should return true when usage is above warning threshold', async () => {
      const mockEstimate = {
        quota: 100 * 1024 * 1024,
        usage: 85 * 1024 * 1024, // 85% usage
      };

      (navigator.storage as any).estimate.mockResolvedValue(mockEstimate);

      const shouldWarn = await quotaManager.shouldShowWarning();
      expect(shouldWarn).toBe(true);
    });

    it('should return false when usage is below warning threshold', async () => {
      const mockEstimate = {
        quota: 100 * 1024 * 1024,
        usage: 70 * 1024 * 1024, // 70% usage
      };

      (navigator.storage as any).estimate.mockResolvedValue(mockEstimate);

      const shouldWarn = await quotaManager.shouldShowWarning();
      expect(shouldWarn).toBe(false);
    });
  });

  describe('getCleanupRecommendations', () => {
    it('should provide cleanup recommendations when quota is high', async () => {
      const mockEstimate = {
        quota: 100 * 1024 * 1024,
        usage: 85 * 1024 * 1024, // 85% usage
      };

      (navigator.storage as any).estimate.mockResolvedValue(mockEstimate);

      const recommendations = await quotaManager.getCleanupRecommendations(mockStorageStats);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some((r: any) => r._type === 'cleanup_old_contexts')).toBe(true);
      expect(recommendations.some((r: any) => r._type === 'cleanup_old_summaries')).toBe(true);
      expect(recommendations.some((r: any) => r._type === 'compact_storage')).toBe(true);
    });

    it('should provide no recommendations when quota is low', async () => {
      const mockEstimate = {
        quota: 100 * 1024 * 1024,
        usage: 50 * 1024 * 1024, // 50% usage
      };

      const lowUsageStats = {
        ...mockStorageStats,
        contextCount: 100,
        summaryCount: 50,
      };

      (navigator.storage as any).estimate.mockResolvedValue(mockEstimate);

      const recommendations = await quotaManager.getCleanupRecommendations(lowUsageStats);

      expect(recommendations.length).toBe(0);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(quotaManager.formatBytes(0)).toBe('0 Bytes');
      expect(quotaManager.formatBytes(1024)).toBe('1 KB');
      expect(quotaManager.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(quotaManager.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      expect(quotaManager.formatBytes(1536)).toBe('1.5 KB');
    });
  });
});

describe('StorageCleanupService', () => {
  let cleanupService: StorageCleanupService;
  let mockStorageStats: StorageStats;

  beforeEach(() => {
    cleanupService = new StorageCleanupService();
    
    mockStorageStats = {
      totalSize: 100 * 1024 * 1024, // 100MB
      usedSize: 50 * 1024 * 1024, // 50MB
      availableSize: 50 * 1024 * 1024, // 50MB
      itemCount: 1250,
      lastCleanup: new Date(),
      quotaUsed: 50 * 1024 * 1024,
      quotaAvailable: 50 * 1024 * 1024,
    };

    // Mock navigator.storage.estimate
    Object.defineProperty(navigator, 'storage', {
      value: {
        estimate: vi.fn().mockResolvedValue({
          quota: 100 * 1024 * 1024,
          usage: 85 * 1024 * 1024,
        }),
      },
      configurable: true,
    });
  });

  describe('performCleanup', () => {
    it('should perform cleanup for old contexts', async () => {
      const savedBytes = await cleanupService.performCleanup('cleanup_old_contexts');
      expect(savedBytes).toBeGreaterThan(0);
    });

    it('should perform cleanup for old summaries', async () => {
      const savedBytes = await cleanupService.performCleanup('cleanup_old_summaries');
      expect(savedBytes).toBeGreaterThan(0);
    });

    it('should perform storage compaction', async () => {
      const savedBytes = await cleanupService.performCleanup('compact_storage');
      expect(savedBytes).toBeGreaterThan(0);
    });
  });

  describe('getRecommendations', () => {
    it('should get cleanup recommendations', async () => {
      const recommendations = await cleanupService.getRecommendations(mockStorageStats);
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});