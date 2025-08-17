// Advanced Settings Component - Comprehensive configuration panel
import React, { useState, useEffect } from 'react';
import {
  UserPreferences,
  LocalAlgorithm,
  FallbackBehavior,
} from '../types';
import { 
  AdvancedSettingsService, 
  AdvancedAppSettings,
  SettingsValidationResult,
  SettingsExportData
} from '../services/settings/advancedSettings';

interface AdvancedSettingsProps {
  preferences: UserPreferences;
  onUpdatePreferences: (section: keyof UserPreferences, updates: Partial<UserPreferences[keyof UserPreferences]>) => void;
  onSave: () => void;
  _isSaving: boolean;
  settingsService?: AdvancedSettingsService;
}

// Legacy interface - kept for backward compatibility
// interface PerformanceSettings {
//   maxConcurrentSummarizations: number;
//   debounceDelay: number;
//   cacheSize: number;
//   backgroundProcessing: boolean;
//   memoryOptimization: boolean;
//   indexingBatchSize: number;
// }

interface SecuritySettings {
  encryptionStrength: 'AES-128' | 'AES-256';
  keyRotationInterval: number; // days
  sessionTimeout: number; // minutes
  requireReauth: boolean;
  auditRetention: number; // days
  threatDetection: boolean;
}

interface ExperimentalSettings {
  enableBetaFeatures: boolean;
  advancedNLP: boolean;
  contextPrediction: boolean;
  smartSuggestions: boolean;
  multiLanguageSupport: boolean;
  voiceCommands: boolean;
}

interface DiagnosticsSettings {
  enableTelemetry: boolean;
  crashReporting: boolean;
  performanceMetrics: boolean;
  usageAnalytics: boolean;
  debugLogging: boolean;
  verboseLogging: boolean;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  preferences,
  onUpdatePreferences,
  onSave,
  _isSaving,
  settingsService,
}) => {
  const [activeTab, setActiveTab] = useState('performance');
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedAppSettings | null>(null);
  const [validationErrors, setValidationErrors] = useState<SettingsValidationResult>({ 
    isValid: true, 
    errors: [], 
    warnings: [] 
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Legacy performance settings - kept for backward compatibility
  // const [performanceSettings, setPerformanceSettings] = useState<PerformanceSettings>({
  //   maxConcurrentSummarizations: 3,
  //   debounceDelay: 500,
  //   cacheSize: 100,
  //   backgroundProcessing: true,
  //   memoryOptimization: true,
  //   indexingBatchSize: 50,
  // });
  
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    encryptionStrength: 'AES-256',
    keyRotationInterval: 30,
    sessionTimeout: 60,
    requireReauth: false,
    auditRetention: 90,
    threatDetection: true,
  });

  const [experimentalSettings, setExperimentalSettings] = useState<ExperimentalSettings>({
    enableBetaFeatures: false,
    advancedNLP: false,
    contextPrediction: false,
    smartSuggestions: true,
    multiLanguageSupport: false,
    voiceCommands: false,
  });

  const [diagnosticsSettings, setDiagnosticsSettings] = useState<DiagnosticsSettings>({
    enableTelemetry: false,
    crashReporting: true,
    performanceMetrics: false,
    usageAnalytics: false,
    debugLogging: false,
    verboseLogging: false,
  });

  // Load advanced settings on component mount
  useEffect(() => {
    if (settingsService) {
      const settings = settingsService.getSettings();
      setAdvancedSettings(settings);
      
      // Legacy performance settings sync - commented out
      // setPerformanceSettings({
      //   maxConcurrentSummarizations: settings.performance.maxConcurrentRequests,
      //   debounceDelay: settings.performance.debounceDelay,
      //   cacheSize: settings.performance.cacheSize,
      //   backgroundProcessing: settings.performance.backgroundProcessing,
      //   memoryOptimization: settings.performance.memoryLimit > 0,
      //   indexingBatchSize: settings.performance.indexingBatchSize,
      // });

      // Listen for settings changes
      const handleSettingsChange = () => {
        setAdvancedSettings(settingsService.getSettings());
        setHasUnsavedChanges(false);
      };

      settingsService.on('settingsSaved', handleSettingsChange);
      settingsService.on('settingsReset', handleSettingsChange);

      return () => {
        settingsService.off('settingsSaved', handleSettingsChange);
        settingsService.off('settingsReset', handleSettingsChange);
      };
    }
    // Return undefined explicitly when settingsService is not available
    return undefined;
  }, [settingsService]);

  // Handle advanced setting updates
  const handleAdvancedSettingUpdate = async (section: keyof AdvancedAppSettings, updates: Partial<AdvancedAppSettings[keyof AdvancedAppSettings]>) => {
    if (!settingsService) return;

    try {
      await settingsService.updateSection(section, updates);
      setHasUnsavedChanges(true);
      setValidationErrors({ isValid: true, errors: [], warnings: [] });
    } catch (error) {
      console.error('Failed to update advanced setting:', error);
      setValidationErrors({
        isValid: false,
        errors: [{ field: section, message: error instanceof Error ? error.message : 'Update failed', severity: 'error' }],
        warnings: []
      });
    }
  };

  // Non-async wrapper for onChange handlers
  const handleAdvancedSettingUpdateSync = (section: keyof AdvancedAppSettings, updates: Partial<AdvancedAppSettings[keyof AdvancedAppSettings]>) => {
    void handleAdvancedSettingUpdate(section, updates);
  };

  // Handle settings export
  const handleExportSettings = async () => {
    if (!settingsService) return;

    try {
      const exportData = await settingsService.exportSettings();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auto-context-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export settings:', error);
    }
  };

  // Handle settings import
  const handleImportSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !settingsService) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text) as SettingsExportData;
        await settingsService.importSettings(importData);
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Failed to import settings:', error);
        setValidationErrors({
          isValid: false,
          errors: [{ field: 'import', message: 'Invalid settings file', severity: 'error' }],
          warnings: []
        });
      }
    };
    input.click();
  };

  // Handle reset to defaults
  const handleResetToDefaults = async () => {
    if (!settingsService) return;
    
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      try {
        await settingsService.resetSettings();
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Failed to reset settings:', error);
      }
    }
  };

  const tabs = [
    { id: 'performance', title: 'Performance', icon: '⚡' },
    { id: 'security', title: 'Security', icon: '🔐' },
    { id: 'algorithms', title: 'Algorithms', icon: '🧠' },
    { id: 'experimental', title: 'Experimental', icon: '🧪' },
    { id: 'diagnostics', title: 'Diagnostics', icon: '📊' },
    { id: 'import-export', title: 'Import/Export', icon: '📁' },
  ];

  const renderPerformanceSettings = () => (
    <div className="settings-section">
      <h3>Performance Optimization</h3>
      
      <div className="setting-group">
        <label>
          <span>Max Concurrent Requests</span>
          <input
            type="number"
            min="1"
            max="20"
            value={advancedSettings?.performance.maxConcurrentRequests || 5}
            onChange={(e) => handleAdvancedSettingUpdateSync('performance', {
              maxConcurrentRequests: parseInt(e.target.value)
            })}
          />
          <small>Number of requests that can run simultaneously</small>
        </label>
      </div>

      <div className="setting-group">
        <label>
          <span>Debounce Delay (ms)</span>
          <input
            type="number"
            min="100"
            max="2000"
            step="100"
            value={advancedSettings?.performance.debounceDelay || 300}
            onChange={(e) => handleAdvancedSettingUpdateSync('performance', {
              debounceDelay: parseInt(e.target.value)
            })}
          />
          <small>Delay before processing user input changes</small>
        </label>
      </div>

      <div className="setting-group">
        <label>
          <span>Cache Size (MB)</span>
          <input
            type="number"
            min="50"
            max="2000"
            value={advancedSettings?.performance.cacheSize || 500}
            onChange={(e) => handleAdvancedSettingUpdateSync('performance', {
              cacheSize: parseInt(e.target.value)
            })}
          />
          <small>Maximum memory cache size in megabytes</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={advancedSettings?.performance.backgroundProcessing || false}
            onChange={(e) => handleAdvancedSettingUpdateSync('performance', {
              backgroundProcessing: e.target.checked
            })}
          />
          <span>Enable Background Processing</span>
          <small>Process operations in the background for better performance</small>
        </label>
      </div>

      <div className="setting-group">
        <label>
          <span>Memory Limit (MB)</span>
          <input
            type="number"
            min="256"
            max="4096"
            value={advancedSettings?.performance.memoryLimit || 1024}
            onChange={(e) => handleAdvancedSettingUpdateSync('performance', {
              memoryLimit: parseInt(e.target.value)
            })}
          />
          <small>Maximum memory usage limit in megabytes</small>
        </label>
      </div>

      <div className="setting-group">
        <label>
          <span>Indexing Batch Size</span>
          <input
            type="number"
            min="10"
            max="200"
            value={advancedSettings?.performance.indexingBatchSize || 100}
            onChange={(e) => handleAdvancedSettingUpdateSync('performance', {
              indexingBatchSize: parseInt(e.target.value)
            })}
          />
          <small>Number of items to process in each indexing batch</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={advancedSettings?.performance.offlineMode || false}
            onChange={(e) => handleAdvancedSettingUpdateSync('performance', {
              offlineMode: e.target.checked
            })}
          />
          <span>Offline Mode</span>
          <small>Enable offline functionality when network is unavailable</small>
        </label>
      </div>

      <div className="setting-group">
        <label>
          <span>Worker Threads</span>
          <input
            type="number"
            min="1"
            max="8"
            value={advancedSettings?.performance.workerThreads || 2}
            onChange={(e) => handleAdvancedSettingUpdateSync('performance', {
              workerThreads: parseInt(e.target.value)
            })}
          />
          <small>Number of worker threads for parallel processing</small>
        </label>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="settings-section">
      <h3>Security Configuration</h3>
      
      <div className="setting-group">
        <label>
          <span>Encryption Strength</span>
          <select
            value={securitySettings.encryptionStrength}
            onChange={(e) => setSecuritySettings({
              ...securitySettings,
              encryptionStrength: e.target.value as 'AES-128' | 'AES-256'
            })}
          >
            <option value="AES-128">AES-128 (Faster)</option>
            <option value="AES-256">AES-256 (More Secure)</option>
          </select>
          <small>Encryption algorithm for data protection</small>
        </label>
      </div>

      <div className="setting-group">
        <label>
          <span>Key Rotation Interval (days)</span>
          <input
            type="number"
            min="1"
            max="365"
            value={securitySettings.keyRotationInterval}
            onChange={(e) => setSecuritySettings({
              ...securitySettings,
              keyRotationInterval: parseInt(e.target.value)
            })}
          />
          <small>How often to rotate encryption keys</small>
        </label>
      </div>

      <div className="setting-group">
        <label>
          <span>Session Timeout (minutes)</span>
          <input
            type="number"
            min="5"
            max="480"
            value={securitySettings.sessionTimeout}
            onChange={(e) => setSecuritySettings({
              ...securitySettings,
              sessionTimeout: parseInt(e.target.value)
            })}
          />
          <small>Automatically lock after inactivity</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={securitySettings.requireReauth}
            onChange={(e) => setSecuritySettings({
              ...securitySettings,
              requireReauth: e.target.checked
            })}
          />
          <span>Require Re-authentication</span>
          <small>Require password for sensitive operations</small>
        </label>
      </div>

      <div className="setting-group">
        <label>
          <span>Audit Log Retention (days)</span>
          <input
            type="number"
            min="7"
            max="365"
            value={securitySettings.auditRetention}
            onChange={(e) => setSecuritySettings({
              ...securitySettings,
              auditRetention: parseInt(e.target.value)
            })}
          />
          <small>How long to keep audit logs</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={securitySettings.threatDetection}
            onChange={(e) => setSecuritySettings({
              ...securitySettings,
              threatDetection: e.target.checked
            })}
          />
          <span>Enable Threat Detection</span>
          <small>Monitor for suspicious activity and potential threats</small>
        </label>
      </div>
    </div>
  );

  const renderAlgorithmSettings = () => (
    <div className="settings-section">
      <h3>Algorithm Configuration</h3>
      
      <div className="setting-group">
        <label>
          <span>Primary Algorithm</span>
          <select
            value={preferences.summarization.localAlgorithm}
            onChange={(e) => onUpdatePreferences('summarization', { 
              localAlgorithm: e.target.value as LocalAlgorithm 
            })}
          >
            <option value={LocalAlgorithm.TEXTRANK}>TextRank</option>
            <option value={LocalAlgorithm.TFIDF}>TF-IDF</option>
            <option value={LocalAlgorithm.FREQUENCY}>Frequency-based</option>
          </select>
          <small>Primary algorithm for local summarization</small>
        </label>
      </div>

      <div className="setting-group">
        <label>
          <span>Compression Ratio</span>
          <input
            type="range"
            min="0.1"
            max="0.8"
            step="0.05"
            value={preferences.summarization.compressionTarget}
            onChange={(e) => onUpdatePreferences('summarization', { 
              compressionTarget: parseFloat(e.target.value) 
            })}
          />
          <span className="range-value">
            {Math.round(preferences.summarization.compressionTarget * 100)}%
          </span>
          <small>Target compression ratio for summaries</small>
        </label>
      </div>

      <div className="setting-group">
        <label>
          <span>Quality Threshold</span>
          <input
            type="range"
            min="0.3"
            max="0.95"
            step="0.05"
            value={preferences.summarization.qualityThreshold}
            onChange={(e) => onUpdatePreferences('summarization', { 
              qualityThreshold: parseFloat(e.target.value) 
            })}
          />
          <span className="range-value">
            {Math.round(preferences.summarization.qualityThreshold * 100)}%
          </span>
          <small>Minimum quality score for automatic summarization</small>
        </label>
      </div>

      <div className="setting-group">
        <label>
          <span>Fallback Behavior</span>
          <select
            value={preferences.cloud.fallbackBehavior}
            onChange={(e) => onUpdatePreferences('cloud', { 
              fallbackBehavior: e.target.value as FallbackBehavior 
            })}
          >
            <option value={FallbackBehavior.LOCAL_ONLY}>Local Only</option>
            <option value={FallbackBehavior.PROMPT_USER}>Prompt User</option>
            <option value={FallbackBehavior.DISABLE_FEATURE}>Disable Feature</option>
          </select>
          <small>What to do when cloud services fail</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={preferences.summarization.autoSummarize}
            onChange={(e) => onUpdatePreferences('summarization', { 
              autoSummarize: e.target.checked 
            })}
          />
          <span>Auto-Summarize</span>
          <small>Automatically summarize when token limits are approached</small>
        </label>
      </div>
    </div>
  );

  const renderExperimentalSettings = () => (
    <div className="settings-section">
      <h3>Experimental Features</h3>
      
      <div className="warning-box">
        <span className="warning-icon">⚠️</span>
        <div>
          <strong>Warning:</strong> Experimental features may be unstable and could affect performance.
          Use at your own risk.
        </div>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={experimentalSettings.enableBetaFeatures}
            onChange={(e) => setExperimentalSettings({
              ...experimentalSettings,
              enableBetaFeatures: e.target.checked
            })}
          />
          <span>Enable Beta Features</span>
          <small>Access to experimental features in development</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={experimentalSettings.advancedNLP}
            onChange={(e) => setExperimentalSettings({
              ...experimentalSettings,
              advancedNLP: e.target.checked
            })}
          />
          <span>Advanced NLP Processing</span>
          <small>Enhanced natural language processing capabilities</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={experimentalSettings.contextPrediction}
            onChange={(e) => setExperimentalSettings({
              ...experimentalSettings,
              contextPrediction: e.target.checked
            })}
          />
          <span>Context Prediction</span>
          <small>Predict and pre-load relevant contexts</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={experimentalSettings.smartSuggestions}
            onChange={(e) => setExperimentalSettings({
              ...experimentalSettings,
              smartSuggestions: e.target.checked
            })}
          />
          <span>Smart Suggestions</span>
          <small>AI-powered suggestions for better context management</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={experimentalSettings.multiLanguageSupport}
            onChange={(e) => setExperimentalSettings({
              ...experimentalSettings,
              multiLanguageSupport: e.target.checked
            })}
          />
          <span>Multi-Language Support</span>
          <small>Support for non-English content processing</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={experimentalSettings.voiceCommands}
            onChange={(e) => setExperimentalSettings({
              ...experimentalSettings,
              voiceCommands: e.target.checked
            })}
          />
          <span>Voice Commands</span>
          <small>Control the extension using voice commands</small>
        </label>
      </div>
    </div>
  );

  const renderDiagnosticsSettings = () => (
    <div className="settings-section">
      <h3>Diagnostics & Telemetry</h3>
      
      <div className="info-box">
        <span className="info-icon">ℹ️</span>
        <div>
          All diagnostic data is processed locally and only shared if you explicitly enable telemetry.
          No personal data is ever transmitted.
        </div>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={diagnosticsSettings.enableTelemetry}
            onChange={(e) => setDiagnosticsSettings({
              ...diagnosticsSettings,
              enableTelemetry: e.target.checked
            })}
          />
          <span>Enable Telemetry</span>
          <small>Share anonymous usage data to help improve the extension</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={diagnosticsSettings.crashReporting}
            onChange={(e) => setDiagnosticsSettings({
              ...diagnosticsSettings,
              crashReporting: e.target.checked
            })}
          />
          <span>Crash Reporting</span>
          <small>Automatically report crashes to help fix bugs</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={diagnosticsSettings.performanceMetrics}
            onChange={(e) => setDiagnosticsSettings({
              ...diagnosticsSettings,
              performanceMetrics: e.target.checked
            })}
          />
          <span>Performance Metrics</span>
          <small>Collect performance data for optimization</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={diagnosticsSettings.usageAnalytics}
            onChange={(e) => setDiagnosticsSettings({
              ...diagnosticsSettings,
              usageAnalytics: e.target.checked
            })}
          />
          <span>Usage Analytics</span>
          <small>Track feature usage to improve user experience</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={diagnosticsSettings.debugLogging}
            onChange={(e) => setDiagnosticsSettings({
              ...diagnosticsSettings,
              debugLogging: e.target.checked
            })}
          />
          <span>Debug Logging</span>
          <small>Enable detailed logging for troubleshooting</small>
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={diagnosticsSettings.verboseLogging}
            onChange={(e) => setDiagnosticsSettings({
              ...diagnosticsSettings,
              verboseLogging: e.target.checked
            })}
          />
          <span>Verbose Logging</span>
          <small>Maximum detail logging (may impact performance)</small>
        </label>
      </div>
    </div>
  );

  const renderImportExportSettings = () => (
    <div className="settings-section">
      <h3>Import & Export</h3>
      
      {validationErrors.errors.length > 0 && (
        <div className="error-box">
          <span className="error-icon">❌</span>
          <div>
            <strong>Error:</strong>
            <ul>
              {validationErrors.errors.map((error, index) => (
                <li key={index}>{error.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      <div className="setting-group">
        <h4>Configuration Backup</h4>
        <div className="button-group">
          <button type="button" className="secondary-button" onClick={() => void handleExportSettings()}>
            📤 Export Settings
          </button>
          <button type="button" className="secondary-button" onClick={handleImportSettings}>
            📥 Import Settings
          </button>
        </div>
        <small>Backup and restore your configuration settings</small>
      </div>

      <div className="setting-group">
        <h4>Settings Information</h4>
        {advancedSettings && (
          <div className="settings-info">
            <div className="info-item">
              <span>Last Updated:</span>
              <span>{new Date(advancedSettings.lastUpdated).toLocaleString()}</span>
            </div>
            <div className="info-item">
              <span>Version:</span>
              <span>{advancedSettings.version}</span>
            </div>
            <div className="info-item">
              <span>Unsaved Changes:</span>
              <span className={hasUnsavedChanges ? 'warning' : 'success'}>
                {hasUnsavedChanges ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="setting-group">
        <h4>Reset Options</h4>
        <div className="button-group">
          <button type="button" className="danger-button" onClick={() => void handleResetToDefaults()}>
            🔄 Reset to Defaults
          </button>
        </div>
        <small>Reset settings to default values (this cannot be undone)</small>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'performance':
        return renderPerformanceSettings();
      case 'security':
        return renderSecuritySettings();
      case 'algorithms':
        return renderAlgorithmSettings();
      case 'experimental':
        return renderExperimentalSettings();
      case 'diagnostics':
        return renderDiagnosticsSettings();
      case 'import-export':
        return renderImportExportSettings();
      default:
        return null;
    }
  };

  return (
    <div className="advanced-settings">
      <div className="settings-header">
        <h2>Advanced Configuration</h2>
        <p>Fine-tune the extension behavior and performance</p>
      </div>

      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-title">{tab.title}</span>
          </button>
        ))}
      </div>

      <div className="settings-content">
        {renderTabContent()}
      </div>

      <div className="settings-footer">
        <button
          type="button"
          className="save-button"
          onClick={onSave}
          disabled={_isSaving}
        >
          {_isSaving ? 'Saving...' : '💾 Save Advanced Settings'}
        </button>
      </div>

      <style>{`
        .advanced-settings {
          max-width: 1000px;
          margin: 0 auto;
        }

        .settings-header {
          margin-bottom: 32px;
        }

        .settings-header h2 {
          margin: 0 0 8px 0;
          color: #333;
          font-size: 28px;
          font-weight: 600;
        }

        .settings-header p {
          margin: 0;
          color: #666;
          font-size: 16px;
        }

        .settings-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 32px;
          border-bottom: 2px solid #f0f0f0;
          overflow-x: auto;
        }

        .tab-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border: none;
          background: transparent;
          cursor: pointer;
          border-radius: 8px 8px 0 0;
          font-size: 14px;
          font-weight: 500;
          color: #666;
          white-space: nowrap;
          transition: all 0.2s ease;
        }

        .tab-button:hover {
          background: #f8f9fa;
          color: #333;
        }

        .tab-button.active {
          background: #667eea;
          color: white;
          border-bottom: 2px solid #667eea;
        }

        .tab-icon {
          font-size: 16px;
        }

        .settings-content {
          min-height: 400px;
        }

        .settings-section h3 {
          margin: 0 0 24px 0;
          color: #333;
          font-size: 20px;
          font-weight: 600;
        }

        .setting-group {
          margin-bottom: 24px;
          padding: 20px;
          background: white;
          border-radius: 8px;
          border: 1px solid #e9ecef;
        }

        .setting-group h4 {
          margin: 0 0 12px 0;
          color: #333;
          font-size: 16px;
          font-weight: 600;
        }

        .setting-group label {
          display: block;
        }

        .setting-group label > span:first-child {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #333;
        }

        .setting-group input,
        .setting-group select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .setting-group input[type="range"] {
          margin-right: 12px;
          width: calc(100% - 60px);
        }

        .range-value {
          display: inline-block;
          width: 48px;
          text-align: right;
          font-weight: 500;
          color: #667eea;
        }

        .checkbox-label {
          display: flex !important;
          align-items: flex-start;
          gap: 12px;
        }

        .checkbox-label input[type="checkbox"] {
          width: auto !important;
          margin: 0;
          flex-shrink: 0;
        }

        .checkbox-label > div {
          flex: 1;
        }

        .checkbox-label > div > span {
          display: block !important;
          margin-bottom: 4px !important;
        }

        .setting-group small {
          display: block;
          margin-top: 4px;
          font-size: 12px;
          color: #666;
          line-height: 1.4;
        }

        .button-group {
          display: flex;
          gap: 12px;
          margin-bottom: 8px;
        }

        .secondary-button,
        .danger-button {
          padding: 8px 16px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .secondary-button:hover {
          background: #f8f9fa;
          border-color: #667eea;
          color: #667eea;
        }

        .danger-button {
          border-color: #dc3545;
          color: #dc3545;
        }

        .danger-button:hover {
          background: #dc3545;
          color: white;
        }

        .warning-box,
        .info-box {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .warning-box {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          color: #856404;
        }

        .info-box {
          background: #e3f2fd;
          border: 1px solid #bbdefb;
          color: #1565c0;
        }

        .warning-icon,
        .info-icon {
          font-size: 16px;
          flex-shrink: 0;
        }

        .settings-footer {
          margin-top: 32px;
          padding: 20px;
          background: white;
          border-radius: 8px;
          border: 1px solid #e9ecef;
          text-align: right;
        }

        .save-button {
          padding: 12px 24px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.2s ease;
        }

        .save-button:hover:not(:disabled) {
          background: #5a6fd8;
        }

        .save-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .error-box {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 24px;
          background: #ffeaea;
          border: 1px solid #ffcdd2;
          color: #c62828;
        }

        .error-icon {
          font-size: 16px;
          flex-shrink: 0;
        }

        .error-box ul {
          margin: 4px 0 0 0;
          padding-left: 16px;
        }

        .settings-info {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 16px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
        }

        .info-item:last-child {
          border-bottom: none;
        }

        .info-item span:first-child {
          font-weight: 500;
          color: #495057;
        }

        .info-item span.warning {
          color: #f57c00;
          font-weight: 500;
        }

        .info-item span.success {
          color: #2e7d32;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default AdvancedSettings;