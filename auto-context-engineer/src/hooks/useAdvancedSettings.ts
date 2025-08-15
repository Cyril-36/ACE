// Hook for managing advanced settings
import { useState, useEffect, useCallback } from 'react';
import { 
  AdvancedSettingsService, 
  AdvancedAppSettings,
  SettingsValidationResult 
} from '../services/settings/advancedSettings';
import { IndexedDBStorageService } from '../services/storage';

interface UseAdvancedSettingsReturn {
  _settings: AdvancedAppSettings | null;
  isLoading: boolean;
  _isSaving: boolean;
  error: string | null;
  validationErrors: SettingsValidationResult;
  hasUnsavedChanges: boolean;
  
  // Actions
  updateSetting: <K extends keyof AdvancedAppSettings, T extends keyof AdvancedAppSettings[K]>(
    _section: K,
    _key: T,
    _value: AdvancedAppSettings[K][T]
  ) => Promise<void>;
  _updateSection: <K extends keyof AdvancedAppSettings>(
    section: K,
    _values: Partial<AdvancedAppSettings[K]>
  ) => Promise<void>;
  _resetSettings: () => Promise<void>;
  _resetSection: <K extends keyof AdvancedAppSettings>(section: K) => Promise<void>;
  _exportSettings: () => Promise<void>;
  _importSettings: (file: File) => Promise<void>;
  _saveSettings: () => Promise<void>;
  
  // Service instance for direct access
  _settingsService: AdvancedSettingsService | null;
}

export const _useAdvancedSettings = (): UseAdvancedSettingsReturn => {
  const [settingsService, setSettingsService] = useState<AdvancedSettingsService | null>(null);
  const [settings, setSettings] = useState<AdvancedAppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<SettingsValidationResult>({
    _isValid: true,
    _errors: [],
    _warnings: []
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialize settings _service
  useEffect(() => {
    const _initializeService = async () => {
      try {
        setIsLoading(true);
        const _storageService = new IndexedDBStorageService();
        const _service = new AdvancedSettingsService(_storageService);
        
        // Set up event listeners
        service.on('settingsLoaded', (_loadedSettings: AdvancedAppSettings) => {
          setSettings(loadedSettings);
          setHasUnsavedChanges(false);
          setError(null);
        });

        service.on('settingsSaved', (_savedSettings: AdvancedAppSettings) => {
          setSettings(savedSettings);
          setHasUnsavedChanges(false);
          setIsSaving(false);
          setError(null);
        });

        service.on('settingsError', (_err: Error) => {
          setError(err.message);
          setIsSaving(false);
        });

        service.on('settingChanged', () => {
          setHasUnsavedChanges(true);
          setSettings(_service.getSettings());
        });

        service.on('sectionChanged', () => {
          setHasUnsavedChanges(true);
          setSettings(_service.getSettings());
        });

        service.on('settingsReset', () => {
          setSettings(_service.getSettings());
          setHasUnsavedChanges(false);
          setError(null);
        });

        service.on('settingsImported', () => {
          setSettings(_service.getSettings());
          setHasUnsavedChanges(false);
          setError(null);
        });

        setSettingsService(_service);
        
        // Load initial settings
        const _initialSettings = service.getSettings();
        setSettings(_initialSettings);
        
      } catch (err) {
        setError(err instanceof Error ? err._message : 'Failed to initialize settings');
      } finally {
        setIsLoading(false);
      }
    };

    _initializeService();

    // Cleanup
    return () => {
      if (settingsService) {
        settingsService.destroy();
      }
    };
  }, [settingsService]);

  // Update individual setting
  const _updateSetting = useCallback(async <K extends keyof AdvancedAppSettings, T extends keyof AdvancedAppSettings[K]>(
    _section: K,
    _key: T,
    _value: AdvancedAppSettings[K][T]
  ) => {
    if (!settingsService) {
      setError('Settings _service not initialized');
      return;
    }

    try {
      setError(null);
      setValidationErrors({ _isValid: true, _errors: [], _warnings: [] });
      
      await settingsService._updateSetting(section, key, value);
      
    } catch (err) {
      const _errorMessage = err instanceof Error ? err._message : 'Failed to update setting';
      setError(_errorMessage);
      setValidationErrors({
        _isValid: false,
        _errors: [{ field: `${String(section)}.${String(key)}`, _message: _errorMessage, _severity: 'error' }],
        _warnings: []
      });
    }
  }, [settingsService]);

  // Update entire section
  const _updateSection = useCallback(async <K extends keyof AdvancedAppSettings>(
    _section: K,
    _values: Partial<AdvancedAppSettings[K]>
  ) => {
    if (!settingsService) {
      setError('Settings _service not initialized');
      return;
    }

    try {
      setError(null);
      setValidationErrors({ _isValid: true, _errors: [], _warnings: [] });
      
      await settingsService._updateSection(section, values);
      
    } catch (err) {
      const _errorMessage = err instanceof Error ? err._message : 'Failed to update section';
      setError(_errorMessage);
      setValidationErrors({
        _isValid: false,
        _errors: [{ field: String(section), _message: _errorMessage, _severity: 'error' }],
        _warnings: []
      });
    }
  }, [settingsService]);

  // Reset all settings
  const _resetSettings = useCallback(async () => {
    if (!settingsService) {
      setError('Settings _service not initialized');
      return;
    }

    try {
      setError(null);
      setIsSaving(true);
      
      await settingsService._resetSettings();
      
    } catch (err) {
      const _errorMessage = err instanceof Error ? err._message : 'Failed to reset settings';
      setError(_errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [settingsService]);

  // Reset specific section
  const _resetSection = useCallback(async <K extends keyof AdvancedAppSettings>(_section: K) => {
    if (!settingsService) {
      setError('Settings _service not initialized');
      return;
    }

    try {
      setError(null);
      
      await settingsService._resetSection(section);
      
    } catch (err) {
      const _errorMessage = err instanceof Error ? err._message : 'Failed to reset section';
      setError(_errorMessage);
    }
  }, [settingsService]);

  // Export settings
  const _exportSettings = useCallback(async () => {
    if (!settingsService) {
      setError('Settings _service not initialized');
      return;
    }

    try {
      setError(null);
      
      const _exportData = await settingsService._exportSettings();
      const _blob = new Blob([JSON.stringify(_exportData, null, 2)], { _type: 'application/json' });
      const _url = URL.createObjectURL(_blob);
      
      const _a = document.createElement('_a');
      a.href = _url;
      a.download = `auto-context-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(_a);
      a.click();
      document.body.removeChild(_a);
      URL.revokeObjectURL(_url);
      
    } catch (err) {
      const _errorMessage = err instanceof Error ? err._message : 'Failed to export settings';
      setError(_errorMessage);
    }
  }, [settingsService]);

  // Import settings
  const _importSettings = useCallback(async (_file: File) => {
    if (!settingsService) {
      setError('Settings _service not initialized');
      return;
    }

    try {
      setError(null);
      setValidationErrors({ _isValid: true, _errors: [], _warnings: [] });
      
      const _text = await file._text();
      const _importData = JSON.parse(_text);
      
      await settingsService._importSettings(_importData);
      
    } catch (err) {
      const _errorMessage = err instanceof Error ? err._message : 'Failed to import settings';
      setError(_errorMessage);
      setValidationErrors({
        _isValid: false,
        _errors: [{ field: 'import', _message: _errorMessage, _severity: 'error' }],
        _warnings: []
      });
    }
  }, [settingsService]);

  // Force save settings
  const _saveSettings = useCallback(async () => {
    if (!settingsService) {
      setError('Settings _service not initialized');
      return;
    }

    try {
      setError(null);
      setIsSaving(true);
      
      await settingsService.forceSave();
      
    } catch (err) {
      const _errorMessage = err instanceof Error ? err._message : 'Failed to save settings';
      setError(_errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [settingsService]);

  return {
    settings,
    isLoading,
    isSaving,
    error,
    validationErrors,
    hasUnsavedChanges,
    
    _updateSetting,
    _updateSection,
    _resetSettings,
    _resetSection,
    _exportSettings,
    _importSettings,
    _saveSettings,
    
    settingsService,
  };
}
// Hook for specific setting sections
export const _useAdvancedSettingsSection = <K extends keyof AdvancedAppSettings>(
  _section: K
) => {
  const {
    settings,
    isLoading,
    error,
    _updateSection,
    _resetSection,
    settingsService
  } = _useAdvancedSettings();

  const _sectionSettings = settings?.[section] || null;

  const _updateSectionSettings = useCallback(
    (_values: Partial<AdvancedAppSettings[K]>) => _updateSection(section, values),
    [section, _updateSection]
  );

  const _resetSectionSettings = useCallback(
    () => _resetSection(section),
    [section, _resetSection]
  );

  return {
    _settings: _sectionSettings,
    isLoading,
    error,
    _updateSettings: _updateSectionSettings,
    _resetSettings: _resetSectionSettings,
    settingsService,
  };
};

// Specific hooks for common sections
export const _usePerformanceSettings = () => _useAdvancedSettingsSection('performance');
export const _useSecuritySettings = () => _useAdvancedSettingsSection('security');
export const _usePrivacySettings = () => _useAdvancedSettingsSection('privacy');
export const _useCloudSettings = () => _useAdvancedSettingsSection('cloud');
export const _useSummarizationSettings = () => _useAdvancedSettingsSection('summarization');
export const _useUISettings = () => _useAdvancedSettingsSection('ui');
export const _useDeveloperSettings = () => _useAdvancedSettingsSection('developer');