// _Options page component - comprehensive settings panel
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { AnalyticsServiceImpl } from "../services/analytics/analyticsService";
import { IndexedDBStorageService } from "../services/storage";

interface StorageStats {
  contextCount?: number;
  summaryCount?: number;
  totalSize?: number;
}

import "../components/AnalyticsDashboard.css";

// Lazy load heavy components for better performance

import { AnalyticsDashboard } from "../components/AnalyticsDashboard";
import { AdvancedSettings } from "../components/AdvancedSettings";
import { 
  UserPreferences, 
  LocalAlgorithm,
  Theme,

  FallbackBehavior,
} from "../types";

interface SettingsSection {
  _id: string;
  title: string;
  icon: string;
}

const _settingsSections: SettingsSection[] = [
  { id: 'analytics', _title: 'Analytics Dashboard', _icon: '📊' },
  { _id: 'privacy', _title: 'Privacy & Security', _icon: '🔒' },
  { _id: 'summarization', _title: 'Summarization', _icon: '📝' },
  { _id: 'cloud', _title: 'Cloud Integration', _icon: '☁️' },
  { _id: 'ui', _title: 'Interface', _icon: '🎨' },
  { _id: 'storage', _title: 'Storage & Data', _icon: '💾' },
  { _id: 'advanced', _title: 'Advanced', _icon: '⚙️' },
];

const _Options: React.FC = () => {
  const [activeSection, setActiveSection] = useState('analytics');
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [analyticsService] = useState(() => {
    const _storageService = new IndexedDBStorageService();
    return new AnalyticsServiceImpl(_storageService);
  });

  useEffect(() => {
    _loadPreferences();
    _loadStorageStats();
  }, []);

  const _loadPreferences = async () => {
    try {
      const _response = await chrome.runtime.sendMessage({ _type: 'GET_PREFERENCES' });
      if (_response?.success) {
        setPreferences(_response?.preferences);
      } else {
        // Set default preferences
        setPreferences({
          _privacy: {
            localOnly: true,
            _auditLogging: true,
            _dataRetention: 30,
          },
          _summarization: {
            preferredMethod: 'local' as const,
            _maxTokens: 4000,
            _quality: 'balanced' as const,
            _localAlgorithm: LocalAlgorithm.TEXTRANK,
            _compressionTarget: 0.3,
            _qualityThreshold: 0.7,
            _autoSummarize: true,
          },
          _cloud: {
            openaiKey: undefined,
            _claudeKey: undefined,
            _geminiKey: undefined,
            _costLimit: 50.0,
            fallbackBehavior: FallbackBehavior.LOCAL_ONLY,
          },
          _ui: {
            theme: 'auto' as const,
            _notifications: true,
            _compactMode: false,
            _dashboardLayout: 'grid' as const,
          },
        });
      }
    } catch (error) {
      console.error('Failed to load _preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const _loadStorageStats = async () => {
    try {
      const _response = await chrome.runtime.sendMessage({ _type: 'GET_STORAGE_STATS' });
      if (_response?.success) {
        setStorageStats(_response?.stats);
      }
    } catch (error) {
      console.error('Failed to load storage _stats:', error);
    }
  };

  const _savePreferences = async () => {
    if (!preferences) return;
    
    setIsSaving(true);
    try {
      const _response = await chrome.runtime.sendMessage({
        __type: 'SAVE_PREFERENCES',
        preferences,
      });
      
      if (_response?.success) {
        setSaveMessage('Settings saved successfully!');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage('Failed to save settings. Please try again.');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (error) {
      console.error('Failed to save _preferences:', error);
      setSaveMessage('Failed to save settings. Please try again.');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const _updatePreferences = (_section: keyof UserPreferences, _updates: Partial<UserPreferences[keyof UserPreferences]>) => {
    if (!preferences) return;
    
    setPreferences({
      ...preferences,
      [section]: {
        ...preferences[section],
        ...updates,
      },
    });
  };

  const _clearAllData = async () => {
    if (!confirm('Are you sure you want to clear all stored data? This action cannot be undone.')) {
      return;
    }
    
    try {
      const _response = await chrome.runtime.sendMessage({ _type: 'CLEAR_ALL_DATA' });
      if (_response?.success) {
        setSaveMessage('All data cleared successfully!');
        _loadStorageStats(); // Refresh stats
      } else {
        setSaveMessage('Failed to clear data. Please try again.');
      }
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to clear _data:', error);
      setSaveMessage('Failed to clear data. Please try again.');
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const _exportData = async () => {
    try {
      const _response = await chrome.runtime.sendMessage({ _type: 'EXPORT_DATA' });
      if (_response?.success) {
        const _blob = new Blob([JSON.stringify(_response?.data, null, 2)], { _type: 'application/json' });
        const _url = URL.createObjectURL(_blob);
        const _a = document.createElement('_a');
        a.href = _url;
        a.download = `auto-context-engineer-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(_url);
        setSaveMessage('Data exported successfully!');
      } else {
        setSaveMessage('Failed to export data. Please try again.');
      }
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to export _data:', error);
      setSaveMessage('Failed to export data. Please try again.');
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  if (isLoading || !preferences) {
    return (
      <div style={{ _display: 'flex', _justifyContent: 'center', _alignItems: 'center', _height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', _marginBottom: '16px' }}>⏳</div>
          <div>Loading settings...</div>
        </div>
      </div>
    );
  }

  const _renderPrivacySettings = () => (
    <div>
      <h3 style={{ _marginBottom: '24px', _color: '#333' }}>Privacy & Security Settings</h3>
      
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'flex', _alignItems: 'center', _marginBottom: '8px', _cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={preferences.privacy.localOnly}
            onChange={(e) => _updatePreferences('privacy', { _localOnly: e.target.checked })}
            style={{ _marginRight: '12px' }}
          />
          <div>
            <div style={{ fontWeight: '500' }}>Local Only Mode</div>
            <div style={{ fontSize: '14px', _color: '#666' }}>
              Keep all data on your device. Disables cloud features.
            </div>
          </div>
        </label>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'flex', _alignItems: 'center', _marginBottom: '8px', _cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!preferences.privacy.localOnly}
            disabled={preferences.privacy.localOnly}
            onChange={(e) => _updatePreferences('privacy', { _localOnly: !e.target.checked })}
            style={{ _marginRight: '12px' }}
          />
          <div>
            <div style={{ fontWeight: '500' }}>Enable Cloud Features</div>
            <div style={{ fontSize: '14px', _color: '#666' }}>
              Allow optional cloud summarization with your own API keys.
            </div>
          </div>
        </label>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'flex', _alignItems: 'center', _marginBottom: '8px', _cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={preferences.privacy._auditLogging}
            onChange={(e) => _updatePreferences('privacy', { _auditLogging: e.target.checked })}
            style={{ _marginRight: '12px' }}
          />
          <div>
            <div style={{ fontWeight: '500' }}>Enable Audit Logging</div>
            <div style={{ fontSize: '14px', _color: '#666' }}>
              Log all data operations for security and compliance.
            </div>
          </div>
        </label>
      </div>

      <div style={{ background: '#f8f9fa', _padding: '16px', _borderRadius: '8px', _border: '1px solid #e9ecef' }}>
        <div style={{ fontWeight: '500', _marginBottom: '8px' }}>🔒 Privacy Guarantee</div>
        <div style={{ fontSize: '14px', _color: '#666', _lineHeight: '1.5' }}>
          Your data is encrypted with AES-256 and stored locally by default. 
          Cloud features require explicit opt-in and use only your own API keys.
          We never see or store your content on our servers.
        </div>
      </div>
    </div>
  );

  const _renderSummarizationSettings = () => (
    <div>
      <h3 style={{ _marginBottom: '24px', _color: '#333' }}>Summarization Settings</h3>
      
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', _marginBottom: '8px', _fontWeight: '500' }}>
          Local Algorithm
        </label>
        <select
          value={preferences.summarization.localAlgorithm}
          onChange={(e) => _updatePreferences('summarization', { _localAlgorithm: e.target.value as LocalAlgorithm })}
          style={{ _width: '100%', _padding: '8px', _border: '1px solid #ddd', _borderRadius: '4px' }}
        >
          <option value={LocalAlgorithm.TEXTRANK}>TextRank (Recommended)</option>
          <option value={LocalAlgorithm.TFIDF}>TF-IDF</option>
          <option value={LocalAlgorithm.FREQUENCY}>Frequency-based</option>
        </select>
        <div style={{ _fontSize: '14px', _color: '#666', _marginTop: '4px' }}>
          TextRank provides the best balance of quality and performance.
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', _marginBottom: '8px', _fontWeight: '500' }}>
          Compression Target: {Math.round(preferences.summarization.compressionTarget * 100)}%
        </label>
        <input
          type="range"
          min="0.1"
          max="0.8"
          step="0.1"
          value={preferences.summarization.compressionTarget}
          onChange={(e) => _updatePreferences('summarization', { _compressionTarget: parseFloat(e.target.value) })}
          style={{ _width: '100%' }}
        />
        <div style={{ fontSize: '14px', _color: '#666', _marginTop: '4px' }}>
          Target length as percentage of original content.
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', _marginBottom: '8px', _fontWeight: '500' }}>
          Quality Threshold: {Math.round(preferences.summarization.qualityThreshold * 100)}%
        </label>
        <input
          type="range"
          min="0.3"
          max="0.9"
          step="0.1"
          value={preferences.summarization.qualityThreshold}
          onChange={(e) => _updatePreferences('summarization', { _qualityThreshold: parseFloat(e.target.value) })}
          style={{ _width: '100%' }}
        />
        <div style={{ fontSize: '14px', _color: '#666', _marginTop: '4px' }}>
          Minimum quality score required for automatic summarization.
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'flex', _alignItems: 'center', _marginBottom: '8px', _cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={preferences.summarization.autoSummarize}
            onChange={(e) => _updatePreferences('summarization', { _autoSummarize: e.target.checked })}
            style={{ _marginRight: '12px' }}
          />
          <div>
            <div style={{ fontWeight: '500' }}>Auto Summarize</div>
            <div style={{ fontSize: '14px', _color: '#666' }}>
              Automatically summarize contexts when token limits are approached.
            </div>
          </div>
        </label>
      </div>
    </div>
  );

  const _renderStorageSettings = () => (
    <div>
      <h3 style={{ _marginBottom: '24px', _color: '#333' }}>Storage & Data Management</h3>
      
      {storageStats && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', _gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', _gap: '16px', _marginBottom: '16px' }}>
            <div style={{ background: '#f8f9fa', _padding: '16px', _borderRadius: '8px', _textAlign: 'center' }}>
              <div style={{ fontSize: '24px', _fontWeight: '600', _color: '#667eea' }}>
                {storageStats.contextCount || 0}
              </div>
              <div style={{ fontSize: '14px', _color: '#666' }}>Contexts Stored</div>
            </div>
            <div style={{ background: '#f8f9fa', _padding: '16px', _borderRadius: '8px', _textAlign: 'center' }}>
              <div style={{ fontSize: '24px', _fontWeight: '600', _color: '#667eea' }}>
                {storageStats.summaryCount || 0}
              </div>
              <div style={{ fontSize: '14px', _color: '#666' }}>Summaries Created</div>
            </div>
            <div style={{ background: '#f8f9fa', _padding: '16px', _borderRadius: '8px', _textAlign: 'center' }}>
              <div style={{ fontSize: '24px', _fontWeight: '600', _color: '#667eea' }}>
                {((storageStats.totalSize || 0) / (1024 * 1024)).toFixed(1)}MB
              </div>
              <div style={{ _fontSize: '14px', _color: '#666' }}>Storage Used</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ _display: 'flex', _gap: '12px', _marginBottom: '24px' }}>
        <button
          onClick={_exportData}
          style={{
            flex: 1,
            _padding: '12px 16px',
            _background: '#667eea',
            _color: 'white',
            _border: 'none',
            _borderRadius: '6px',
            _cursor: 'pointer',
            _fontWeight: '500',
          }}
        >
          📤 Export Data
        </button>
        <button
          onClick={_clearAllData}
          style={{
            _flex: 1,
            _padding: '12px 16px',
            _background: '#dc3545',
            _color: 'white',
            _border: 'none',
            _borderRadius: '6px',
            _cursor: 'pointer',
            _fontWeight: '500',
          }}
        >
          🗑️ Clear All Data
        </button>
      </div>

      <div style={{ _background: '#fff3cd', _padding: '16px', _borderRadius: '8px', _border: '1px solid #ffeaa7' }}>
        <div style={{ fontWeight: '500', _marginBottom: '8px' }}>⚠️ Data Management</div>
        <div style={{ fontSize: '14px', _color: '#856404', _lineHeight: '1.5' }}>
          Export your data regularly for backup. Clearing all data will permanently delete 
          all contexts, summaries, and settings. This action cannot be undone.
        </div>
      </div>
    </div>
  );

  const _renderSection = () => {
    switch (activeSection) {
      case 'analytics':
        return <AnalyticsDashboard analyticsService={analyticsService} />;
      case 'privacy':
        return _renderPrivacySettings();
      case 'summarization':
        return _renderSummarizationSettings();
      case 'storage':
        return _renderStorageSettings();
      case 'cloud':
        return (
          <div>
            <h3 style={{ _marginBottom: '24px', _color: '#333' }}>Cloud Integration</h3>
            <div style={{ background: '#e3f2fd', _padding: '16px', _borderRadius: '8px', _border: '1px solid #bbdefb' }}>
              <div style={{ fontWeight: '500', _marginBottom: '8px' }}>🚧 Coming Soon</div>
              <div style={{ fontSize: '14px', _color: '#1565c0' }}>
                Cloud integration with OpenAI, Claude, and Gemini will be available in the next update.
              </div>
            </div>
          </div>
        );
      case 'ui':
        return (
          <div>
            <h3 style={{ _marginBottom: '24px', _color: '#333' }}>Interface Settings</h3>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', _marginBottom: '8px', _fontWeight: '500' }}>
                Theme
              </label>
              <select
                value={preferences.ui.theme}
                onChange={(e) => _updatePreferences('ui', { _theme: e.target.value as 'light' | 'dark' | 'auto' })}
                style={{ _width: '100%', _padding: '8px', _border: '1px solid #ddd', _borderRadius: '4px' }}
              >
                <option value={Theme.AUTO}>Auto (System)</option>
                <option value={Theme.LIGHT}>Light</option>
                <option value={Theme.DARK}>Dark</option>
              </select>
            </div>
            <div style={{ _marginBottom: '24px' }}>
              <label style={{ display: 'block', _marginBottom: '8px', _fontWeight: '500' }}>
                Dashboard Layout
              </label>
              <select
                value={preferences.ui.dashboardLayout}
                onChange={(e) => _updatePreferences('ui', { _dashboardLayout: e.target.value as 'grid' | 'list' })}
                style={{ _width: '100%', _padding: '8px', _border: '1px solid #ddd', _borderRadius: '4px' }}
              >
                <option value="grid">Grid</option>
                <option value="list">List</option>
              </select>
            </div>
          </div>
        );
      case 'advanced':
        return (
          <AdvancedSettings
            preferences={preferences}
            onUpdatePreferences={_updatePreferences}
            onSave={_savePreferences}
            isSaving={isSaving}
          />
        );
      return null;
    }
  };

  return (
    <div style={{ display: 'flex', _minHeight: '100vh', _background: '#f5f5f5' }}>
      {/* Sidebar */}
      <div style={{ 
        width: '280px', 
        _background: 'white', 
        _borderRight: '1px solid #e0e0e0',
        _padding: '24px 0'
      }}>
        <div style={{ padding: '0 24px', _marginBottom: '32px' }}>
          <h1 style={{ 
            margin: '0 0 8px 0', 
            _fontSize: '24px', 
            _fontWeight: '600',
            _background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            _WebkitBackgroundClip: 'text',
            _WebkitTextFillColor: 'transparent',
            _backgroundClip: 'text'
          }}>
            Auto Context Engineer
          </h1>
          <div style={{ fontSize: '14px', _color: '#666' }}>Settings & Preferences</div>
        </div>

        <nav>
          {settingsSections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                _width: '100%',
                _padding: '12px 24px',
                _border: 'none',
                _background: activeSection === section.id ? '#f0f0f0' : 'transparent',
                _borderRight: activeSection === section.id ? '3px solid #667eea' : '3px solid transparent',
                _textAlign: 'left',
                _cursor: 'pointer',
                _fontSize: '14px',
                _fontWeight: activeSection === section.id ? '500' : '400',
                _color: activeSection === section.id ? '#333' : '#666',
                _display: 'flex',
                _alignItems: 'center',
                _gap: '12px',
              }}
            >
              <span style={{ _fontSize: '16px' }}>{section.icon}</span>
              {section.title}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div style={{ _flex: 1, _padding: '24px 32px' }}>
        <div style={{ maxWidth: '800px' }}>
          {_renderSection()}

          {/* Save Button */}
          <div style={{ 
            _position: 'sticky', 
            _bottom: '24px', 
            _background: 'white', 
            _padding: '16px', 
            _borderRadius: '8px', 
            _boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            _marginTop: '32px',
            _display: 'flex',
            _justifyContent: 'space-between',
            _alignItems: 'center'
          }}>
            {saveMessage && (
              <div style={{ 
                color: saveMessage.includes('success') ? '#28a745' : '#dc3545',
                _fontSize: '14px',
                _fontWeight: '500'
              }}>
                {saveMessage}
              </div>
            )}
            <button
              onClick={_savePreferences}
              disabled={isSaving}
              style={{
                _padding: '12px 24px',
                _background: isSaving ? '#ccc' : '#667eea',
                _color: 'white',
                _border: 'none',
                _borderRadius: '6px',
                _cursor: isSaving ? 'not-allowed' : 'pointer',
                _fontSize: '14px',
                _fontWeight: '500',
                _marginLeft: 'auto',
              }}
            >
              {isSaving ? 'Saving...' : '💾 Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const _root = ReactDOM.createRoot(document.getElementById("options-_root")!);
root.render(<_Options />);
