import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedSettingsService } from '../advancedSettings';
import { IndexedDBStorageService } from '../../storage';

// Removed unused interface

// Mock the storage service
vi.mock('../../storage', () => ({
  IndexedDBStorageService: vi.fn().mockImplementation(() => ({
    retrieve: vi.fn().mockResolvedValue(null),
    store: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('AdvancedSettingsService', () => {
  let settingsService: AdvancedSettingsService;
  let _mockStorageService: IndexedDBStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    _mockStorageService = new IndexedDBStorageService();
    settingsService = new AdvancedSettingsService(_mockStorageService);
  });

  afterEach(() => {
    settingsService.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      const settings = settingsService.getSettings();
      
      expect(settings).toBeDefined();
      expect(settings.version).toBe('1.0.0');
      expect(settings.migrationVersion).toBe(1);
      expect(settings.privacy).toBeDefined();
      expect(settings.cloud).toBeDefined();
      expect(settings.performance).toBeDefined();
    });

    it('should have proper default values', () => {
      const settings = settingsService.getSettings();
      
      expect(settings.privacy.dataRetentionDays).toBe(90);
      expect(settings.privacy.localProcessingOnly).toBe(true);
      expect(settings.cloud.enabled).toBe(false);
      expect(settings.performance.maxConcurrentRequests).toBe(5);
      expect(settings.security.encryptionAlgorithm).toBe('AES-256-GCM');
    });
  });

  describe('Settings Management', () => {
    it('should get specific setting sections', () => {
      const privacySettings = settingsService.getSection('privacy');
      
      expect(privacySettings).toBeDefined();
      expect(privacySettings.dataRetentionDays).toBe(90);
      expect(privacySettings.localProcessingOnly).toBe(true);
    });

    it('should get specific setting values', () => {
      const retentionDays = settingsService.getSetting('privacy', 'dataRetentionDays');
      const maxRequests = settingsService.getSetting('performance', 'maxConcurrentRequests');
      
      expect(retentionDays).toBe(90);
      expect(maxRequests).toBe(5);
    });

    it('should update individual settings', async () => {
      const eventSpy = vi.fn();
      settingsService.on('settingChanged', eventSpy);

      await settingsService.updateSetting('privacy', 'dataRetentionDays', 120);
      
      const updatedValue = settingsService.getSetting('privacy', 'dataRetentionDays');
      expect(updatedValue).toBe(120);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should update entire sections', async () => {
      const eventSpy = vi.fn();
      settingsService.on('sectionChanged', eventSpy);

      await settingsService.updateSection('performance', {
        maxConcurrentRequests: 10,
        cacheSize: 1000,
      });
      
      const performanceSettings = settingsService.getSection('performance');
      expect(performanceSettings.maxConcurrentRequests).toBe(10);
      expect(performanceSettings.cacheSize).toBe(1000);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should validate settings before updating', async () => {
      // Try to set an invalid value
      await expect(
        settingsService.updateSetting('privacy', 'dataRetentionDays', -1)
      ).rejects.toThrow();
      
      // Original value should remain unchanged
      const retentionDays = settingsService.getSetting('privacy', 'dataRetentionDays');
      expect(retentionDays).toBe(90);
    });
  });

  describe('Settings Reset', () => {
    it('should reset all settings to defaults', async () => {
      // Modify some settings first
      await settingsService.updateSetting('privacy', 'dataRetentionDays', 120);
      await settingsService.updateSetting('performance', 'maxConcurrentRequests', 10);
      
      const eventSpy = vi.fn();
      settingsService.on('settingsReset', eventSpy);

      await settingsService.resetSettings();
      
      const settings = settingsService.getSettings();
      expect(settings.privacy.dataRetentionDays).toBe(90);
      expect(settings.performance.maxConcurrentRequests).toBe(5);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should reset specific sections to defaults', async () => {
      // Modify performance settings
      await settingsService.updateSection('performance', {
        maxConcurrentRequests: 10,
        cacheSize: 1000,
      });
      
      const eventSpy = vi.fn();
      settingsService.on('sectionReset', eventSpy);

      await settingsService.resetSection('performance');
      
      const performanceSettings = settingsService.getSection('performance');
      expect(performanceSettings.maxConcurrentRequests).toBe(5);
      expect(performanceSettings.cacheSize).toBe(500);
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Import/Export', () => {
    it('should export settings with metadata', async () => {
      const exportData = await settingsService.exportSettings();
      
      expect(exportData.settings).toBeDefined();
      expect(exportData.metadata).toBeDefined();
      expect(exportData.metadata.exportedAt).toBeTypeOf('number');
      expect(exportData.metadata.version).toBe('1.0.0');
      expect(exportData.metadata.checksum).toBeTypeOf('string');
    });

    it('should import valid settings', async () => {
      // First export current settings
      const exportData = await settingsService.exportSettings();
      
      // Modify some settings
      await settingsService.updateSetting('privacy', 'dataRetentionDays', 120);
      
      const eventSpy = vi.fn();
      settingsService.on('settingsImported', eventSpy);

      // Import the original settings
      await settingsService.importSettings(exportData);
      
      const retentionDays = settingsService.getSetting('privacy', 'dataRetentionDays');
      expect(retentionDays).toBe(90); // Should be back to original value
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should reject invalid import data', async () => {
      const invalidData = {
        settings: { invalid: 'data' },
        metadata: {
          exportedAt: Date.now(),
          version: '1.0.0',
          checksum: 'invalid-checksum',
        },
      };

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        settingsService.importSettings(invalidData as any)
      ).rejects.toThrow();
    });
  });

  describe('Validation', () => {
    it('should validate privacy settings', async () => {
      // Valid values should work
      await expect(
        settingsService.updateSetting('privacy', 'dataRetentionDays', 30)
      ).resolves.not.toThrow();

      // Invalid values should be rejected
      await expect(
        settingsService.updateSetting('privacy', 'dataRetentionDays', 0)
      ).rejects.toThrow();

      await expect(
        settingsService.updateSetting('privacy', 'dataRetentionDays', 4000)
      ).rejects.toThrow();
    });

    it('should validate cloud settings', async () => {
      // Valid cost limit
      await expect(
        settingsService.updateSetting('cloud', 'costLimits', {
          daily: 50,
          monthly: 500,
          perRequest: 2.0,
        })
      ).resolves.not.toThrow();

      // Invalid cost limit
      await expect(
        settingsService.updateSetting('cloud', 'costLimits', {
          daily: -10,
          monthly: 500,
          perRequest: 2.0,
        })
      ).rejects.toThrow();
    });

    it('should validate performance settings', async () => {
      // Valid concurrent requests
      await expect(
        settingsService.updateSetting('performance', 'maxConcurrentRequests', 10)
      ).resolves.not.toThrow();

      // Invalid concurrent requests
      await expect(
        settingsService.updateSetting('performance', 'maxConcurrentRequests', 0)
      ).rejects.toThrow();

      await expect(
        settingsService.updateSetting('performance', 'maxConcurrentRequests', 25)
      ).rejects.toThrow();
    });
  });

  describe('Statistics', () => {
    it('should provide settings statistics', () => {
      const stats = settingsService.getStatistics();
      
      expect(stats.totalSettings).toBeTypeOf('number');
      expect(stats.totalSettings).toBeGreaterThan(0);
      expect(stats.lastUpdated).toBeInstanceOf(Date);
      expect(stats.version).toBe('1.0.0');
      expect(stats.isDirty).toBe(false);
      expect(stats.cacheSize).toBe(0);
    });

    it('should track dirty state', async () => {
      let stats = settingsService.getStatistics();
      expect(stats.isDirty).toBe(false);

      await settingsService.updateSetting('privacy', 'dataRetentionDays', 120);
      
      stats = settingsService.getStatistics();
      expect(stats.isDirty).toBe(true);
    });
  });

  describe('Event Handling', () => {
    it('should emit events for setting changes', async () => {
      const settingChangedSpy = vi.fn();
      const sectionChangedSpy = vi.fn();
      
      settingsService.on('settingChanged', settingChangedSpy);
      settingsService.on('sectionChanged', sectionChangedSpy);

      await settingsService.updateSetting('privacy', 'dataRetentionDays', 120);
      expect(settingChangedSpy).toHaveBeenCalledWith({
        section: 'privacy',
        key: 'dataRetentionDays',
        value: 120,
        oldValue: 90,
      });

      await settingsService.updateSection('performance', { maxConcurrentRequests: 10 });
      expect(sectionChangedSpy).toHaveBeenCalled();
    });

    it('should emit events for save operations', async () => {
      const savedSpy = vi.fn();
      settingsService.on('settingsSaved', savedSpy);

      await settingsService.forceSave();
      expect(savedSpy).toHaveBeenCalled();
    });

    it('should emit events for reset operations', async () => {
      const resetSpy = vi.fn();
      const sectionResetSpy = vi.fn();
      
      settingsService.on('settingsReset', resetSpy);
      settingsService.on('sectionReset', sectionResetSpy);

      await settingsService.resetSettings();
      expect(resetSpy).toHaveBeenCalled();

      await settingsService.resetSection('privacy');
      expect(sectionResetSpy).toHaveBeenCalled();
    });
  });

  describe('Storage Integration', () => {
    it('should save settings to storage', async () => {
      await settingsService.updateSetting('privacy', 'dataRetentionDays', 120);
      await settingsService.forceSave();
      
      expect(_mockStorageService.store).toHaveBeenCalledWith(
        'advanced_settings',
        expect.objectContaining({
          privacy: expect.objectContaining({
            dataRetentionDays: 120,
          }),
        })
      );
    });

    it('should handle storage errors gracefully', async () => {
      const errorSpy = vi.fn();
      settingsService.on('settingsError', errorSpy);

      // Mock storage error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_mockStorageService as any).store.mockRejectedValueOnce(new Error('Storage error'));

      // Force save to trigger the error
      await settingsService.updateSetting('privacy', 'dataRetentionDays', 120);
      await settingsService.forceSave();
      
      // Should emit error event
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Migration', () => {
    it('should handle settings migration', async () => {
      const oldSettings = {
        privacy: { dataRetentionDays: 60 },
        migrationVersion: 0,
      };

      // Create new service with old settings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_mockStorageService as any).retrieve.mockResolvedValueOnce(oldSettings);
      const newService = new AdvancedSettingsService(_mockStorageService);
      
      // Wait for settings to load
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const settings = newService.getSettings();
      expect(settings.migrationVersion).toBe(1);
      expect(settings.privacy.dataRetentionDays).toBe(60); // Preserved
      expect(settings.cloud).toBeDefined(); // Added with defaults
      
      newService.destroy();
    });
  });

  describe('Memory Management', () => {
    it('should cleanup resources on destroy', () => {
      const removeAllListenersSpy = vi.spyOn(settingsService, 'removeAllListeners');
      
      settingsService.destroy();
      
      expect(removeAllListenersSpy).toHaveBeenCalled();
    });

    it('should handle auto-save timer cleanup', () => {
      // This tests internal timer cleanup
      settingsService.destroy();
      
      // Should not throw errors
      expect(() => settingsService.destroy()).not.toThrow();
    });
  });
});