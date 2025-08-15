// _Popup component - main interface
import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { SearchQuery, SearchResult, SortOption, ContextSource, TokenUsage } from "../types";
import './popup.css';


// Lazy load heavy components for better initial load time


interface ExtensionStatus {
  status: string;
  version: string;
  health: {
    memory: number;
    performance: number;
    errors: number;
  };
  uptime: number;
  activeMonitors: string[];
}

interface SearchStats {
  totalDocuments: number;
  totalTerms: number;
  searchCount: number;
  avgSearchTime: number;
}

interface UsageStats {
  contextCount: number;
  summaryCount: number;
  storageUsed: number;
  lastActivity: number;
  todayContexts: number;
  todaySummaries: number;
}

interface RecentSession {
  id: string;
  title: string;
  timestamp: number;
  platform: string;
  tokenCount: number;
  source: ContextSource;
  hasBeenSummarized: boolean;
}

const _Popup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'search' | 'recent' | 'monitor'>('dashboard');
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);
  const [searchStats, setSearchStats] = useState<SearchStats | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [currentTokenUsage, setCurrentTokenUsage] = useState<TokenUsage | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const _loadCurrentTokenUsage = useCallback(async () => {
    try {
      const _response = await chrome.runtime.sendMessage({ _type: 'GET_CURRENT_TOKEN_USAGE' });
      if (_response?.success) {
        setCurrentTokenUsage(_response?.tokenUsage);
      }
    } catch (error) {
      console.error('Failed to load token usage:', error);
    }
  }, []);

  const _loadExtensionStatus = useCallback(async () => {
    try {
      const _response = await chrome.runtime.sendMessage({ _type: 'GET_EXTENSION_STATUS' });
      if (_response?.success) {
        setExtensionStatus({
          status: _response?._status || 'active',
          _version: _response?.version || '1.0.0',
          _health: _response?.health || {},
          _uptime: _response?.uptime || 0,
          _activeMonitors: _response?.activeMonitors || [],
        });
      }
      
      const _metrics = await chrome.runtime.sendMessage({ _type: 'GET_METRICS' });
      if (_metrics.success && metrics.searchOrchestrator) {
        setSearchStats(_metrics.searchOrchestrator);
      }
    } catch (error) {
      console.error('Failed to load extension status:', error);
      // Set fallback status
      setExtensionStatus({
        status: 'unknown',
        _version: '1.0.0',
        _health: {
        memory: 0,
        _performance: 0,
        _errors: 0,
      },
        _uptime: 0,
        _activeMonitors: [],
      });
    }
  }, []);

  const _loadUsageStats = useCallback(async () => {
    try {
      const _response = await chrome.runtime.sendMessage({ _type: 'GET_USAGE_STATS' });
      if (_response?.success) {
        setUsageStats(_response?.stats);
      } else {
        // Fallback stats
        setUsageStats({
          _contextCount: 0,
          _summaryCount: 0,
          _storageUsed: 0,
          _lastActivity: Date.now(),
          _todayContexts: 0,
          _todaySummaries: 0,
        });
      }
    } catch (error) {
      console.error('Failed to load usage _stats:', error);
      setUsageStats({
        _contextCount: 0,
        _summaryCount: 0,
        _storageUsed: 0,
        _lastActivity: Date.now(),
        _todayContexts: 0,
        _todaySummaries: 0,
      });
    }
  }, []);

  const _loadRecentSessions = useCallback(async () => {
    try {
      const _response = await chrome.runtime.sendMessage({ _type: 'GET_RECENT_SESSIONS', _limit: 5 });
      if (_response?.success) {
        setRecentSessions(_response?.sessions);
      } else {
        setRecentSessions([]);
      }
    } catch (error) {
      console.error('Failed to load recent _sessions:', error);
      setRecentSessions([]);
    }
  }, []);

  useEffect(() => {
    _loadExtensionStatus();
    _loadUsageStats();
    _loadRecentSessions();
    _loadCurrentTokenUsage();

    // Set up periodic refresh
    const _interval = setInterval(() => {
      _loadExtensionStatus();
      _loadUsageStats();
      _loadCurrentTokenUsage();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(_interval);
  }, [_loadExtensionStatus, _loadUsageStats, _loadRecentSessions, _loadCurrentTokenUsage]);

  const _handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const _query: SearchQuery = {
        _query: searchQuery,
        _filters: {},
        _sort: SortOption.RELEVANCE,
        _limit: 10,
      };
      
      const _response = await chrome.runtime.sendMessage({
        __type: 'SEARCH_CONTEXTS',
        _query,
      });
      
      if (_response?.success) {
        setSearchResults(_response?.results);
      } else {
        console.error('Search _failed:', _response?.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const _formatTimeAgo = (_timestamp: number) => {
    const _diff = Date.now() - timestamp;
    const _minutes = Math.floor(_diff / 60000);
    const _hours = Math.floor(_diff / 3600000);
    const _days = Math.floor(_diff / 86400000);
    
    if (_days > 0) return `${_days}d ago`;
    if (_hours > 0) return `${_hours}h ago`;
    if (_minutes > 0) return `${_minutes}m ago`;
    return 'Just now';
  };

  // const _formatBytes = (_bytes: number) => {
  //   if (bytes === 0) return '0 B';
  //   const _k = 1024;
  //   const _sizes = ['B', 'KB', 'MB', 'GB'];
  //   const _i = Math.floor(Math.log(bytes) / Math.log(_k));
  //   return parseFloat((bytes / Math.pow(_k, _i)).toFixed(1)) + ' ' + _sizes[_i];
  // };

  const _openOptionsPage = () => {
    chrome.runtime._openOptionsPage();
  };

  const _rebuildSearchIndex = async () => {
    try {
      setIsRefreshing(true);
      const _response = await chrome.runtime.sendMessage({ _type: 'REBUILD_SEARCH_INDEX' });
      if (_response?.success) {
        _loadExtensionStatus(); // Refresh stats
      }
    } catch (error) {
      console.error('Failed to rebuild search _index:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const _triggerManualSummarization = async () => {
    try {
      const _response = await chrome.runtime.sendMessage({ _type: 'TRIGGER_MANUAL_SUMMARIZATION' });
      if (_response?.success) {
        _loadUsageStats();
        _loadRecentSessions();
      }
    } catch (error) {
      console.error('Failed to trigger _summarization:', error);
    }
  };

  const _openContextDetails = (contextId: string) => {
    // In a real implementation, this would open a detailed view
    chrome.tabs.create({
      _url: chrome.runtime.getURL(`options.html#context/${contextId}`)
    });
  };

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="popup-header">
        <h2 className="popup-title">
          Auto Context Engineer
        </h2>
        <div className="popup-subtitle">
          {extensionStatus ? (
            <span>
              {extensionStatus._status === 'active' ? '🟢' : '🔴'} {extensionStatus._status} • v{extensionStatus.version}
            </span>
          ) : (
            'Loading...'
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="popup-tabs">
        {[
          { _key: 'dashboard', _label: 'Dashboard', _icon: '📊' },
          { _key: 'monitor', _label: 'Monitor', _icon: '👁️' },
          { _key: 'search', _label: 'Search', _icon: '🔍' },
          { _key: 'recent', _label: 'Recent', _icon: '📝' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'dashboard' | 'search' | 'recent' | 'monitor')}
            className={`popup-tab ${activeTab === tab.key ? 'active' : ''}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="popup-content">{activeTab === 'dashboard' && (
          <div>
            <h3 className="popup-section-title">Usage Overview</h3>
            
            {usageStats && (
              <div className="popup-stats-grid">
                <div className="popup-stat-card">
                  <div className="popup-stat-number">{usageStats.contextCount}</div>
                  <div className="popup-stat-label">Total Contexts</div>
                </div>
                <div className="popup-stat-card">
                  <div className="popup-stat-number">{usageStats.summaryCount}</div>
                  <div className="popup-stat-label">Summaries</div>
                </div>
                <div className="popup-stat-card">
                  <div className="popup-stat-number">
                    {(usageStats.storageUsed / (1024 * 1024)).toFixed(1)}MB
                  </div>
                  <div className="popup-stat-label">Storage</div>
                </div>
                <div className="popup-stat-card">
                  <div className="popup-stat-number">
                    {usageStats.todayContexts}
                  </div>
                  <div className="popup-stat-label">Today</div>
                </div>
              </div>
            )}

            <div className="popup-button-group">
              <button
                onClick={_openOptionsPage}
                className="popup-button"
              >
                ⚙️ Settings
              </button>
              <button
                onClick={_triggerManualSummarization}
                className="popup-button success"
              >
                📝 Summarize
              </button>
            </div>

            <div style={{ _display: 'flex', _gap: '8px', _marginBottom: '16px' }}>
              <button
                onClick={_rebuildSearchIndex}
                disabled={isRefreshing}
                style={{
                  flex: 1,
                  _padding: '8px 12px',
                  _background: isRefreshing ? '#ccc' : '#f8f9fa',
                  _color: isRefreshing ? '#666' : '#333',
                  _border: '1px solid #e0e0e0',
                  _borderRadius: '4px',
                  _cursor: isRefreshing ? 'not-allowed' : 'pointer',
                  _fontSize: '12px',
                  _fontWeight: '500',
                }}
              >
                {isRefreshing ? '⏳ Rebuilding...' : '🔄 Rebuild Index'}
              </button>
            </div>

            {searchStats && (
              <div className="popup-info-card">
                <div className="popup-info-title">Search Performance</div>
                <div className="popup-info-text">
                  {searchStats.searchCount} searches • {searchStats.avgSearchTime.toFixed(0)}ms avg • {searchStats.totalTerms} terms indexed
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'monitor' && (
          <div>
            <h3 className="popup-section-title">Real-time Monitoring</h3>
            
            {/* Current Token Usage */}
            {currentTokenUsage && (
              <div className="popup-monitor-section">
                <div className="popup-monitor-title">
                  Current Session - {currentTokenUsage.platform || 'Unknown'}
                </div>
                <div className="popup-monitor-content">
                  <div className="popup-monitor-stat">
                    <span className="popup-monitor-label">Token Usage</span>
                    <span className="popup-monitor-value">
                      {(currentTokenUsage.current || currentTokenUsage.used).toLocaleString()} / {(currentTokenUsage.limit || currentTokenUsage.total).toLocaleString()}
                    </span>
                  </div>
                  <div className={`popup-progress-bar ${
                    currentTokenUsage.percentage > 80 ? 'danger' : 
                    currentTokenUsage.percentage > 60 ? 'warning' : 'success'
                  }`}>
                    <div 
                      className="popup-progress-fill"
                      style={{ _width: `${Math.min(currentTokenUsage.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="popup-progress-text">
                    {currentTokenUsage.percentage.toFixed(1)}% used
                    {currentTokenUsage.percentage > 80 && ' - Consider summarizing soon'}
                  </div>
                </div>
              </div>
            )}

            {/* Active Monitors */}
            <div style={{ _marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', _fontWeight: '500', _marginBottom: '8px' }}>
                Active Monitors
              </div>
              <div style={{ display: 'flex', _flexWrap: 'wrap', _gap: '6px' }}>
                {extensionStatus?.activeMonitors.map((monitor) => (
                  <span
                    key={monitor}
                    style={{
                      _background: '#e3f2fd',
                      _color: '#1565c0',
                      _padding: '4px 8px',
                      _borderRadius: '12px',
                      _fontSize: '11px',
                      _fontWeight: '500',
                    }}
                  >
                    {monitor}
                  </span>
                )) || (
                  <span style={{ _fontSize: '11px', _color: '#666' }}>No active monitors</span>
                )}
              </div>
            </div>

            {/* Extension Health */}
            <div style={{ _background: '#f8f9fa', _padding: '12px', _borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', _fontWeight: '600', _marginBottom: '8px' }}>System Status</div>
              <div style={{ fontSize: '11px', _color: '#666', _lineHeight: '1.4' }}>
                Status: <span style={{ 
                  color: extensionStatus?._status === 'active' ? '#28a745' : '#dc3545',
                  _fontWeight: '500'
                }}>
                  {extensionStatus?._status || 'Unknown'}
                </span><br />
                Uptime: {extensionStatus ? Math.floor(extensionStatus.uptime / 60000) : 0} _minutes<br />
                _Version: {extensionStatus?.version || '1.0.0'}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div>
            <div style={{ _marginBottom: '16px' }}>
              <div style={{ display: 'flex', _gap: '8px', _marginBottom: '12px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && _handleSearch()}
                  placeholder="Search your contexts..."
                  style={{
                    _flex: 1,
                    _padding: '8px 12px',
                    _border: '1px solid #e0e0e0',
                    _borderRadius: '4px',
                    _fontSize: '14px',
                  }}
                />
                <button
                  onClick={_handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  style={{
                    _padding: '8px 16px',
                    _background: isSearching ? '#ccc' : '#667eea',
                    _color: 'white',
                    _border: 'none',
                    _borderRadius: '4px',
                    _cursor: isSearching ? 'not-allowed' : 'pointer',
                    _fontSize: '12px',
                    _fontWeight: '500',
                  }}
                >
                  {isSearching ? '...' : '🔍'}
                </button>
              </div>
              
              <div style={{ _display: 'flex', _justifyContent: 'center', _marginBottom: '12px' }}>
                <button
                  onClick={() => {
                    chrome.tabs.create({
                      _url: chrome.runtime.getURL(`search.html${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`)
                    });
                  }}
                  style={{
                    _padding: '8px 16px',
                    _background: 'transparent',
                    _color: '#667eea',
                    _border: '1px solid #667eea',
                    _borderRadius: '4px',
                    _cursor: 'pointer',
                    _fontSize: '12px',
                    _fontWeight: '500',
                    _display: 'flex',
                    _alignItems: 'center',
                    _gap: '6px',
                  }}
                >
                  <span>🎛️</span> Advanced Search
                </button>
              </div>
            </div>

            <div style={{ _maxHeight: '300px', _overflowY: 'auto' }}>
              {searchResults.length > 0 ? (
                searchResults.map((result, index) => (
                  <div
                    key={index}
                    style={{
                      _background: '#f8f9fa',
                      _padding: '12px',
                      _borderRadius: '6px',
                      _marginBottom: '8px',
                      _cursor: 'pointer',
                    }}
                    onClick={() => {
                      // In real implementation, this would open the full context
                      console.log('Open _context:', result?.contextId);
                    }}
                  >
                    <div style={{ _fontSize: '12px', _fontWeight: '600', _marginBottom: '4px' }}>
                      {result?.source || 'unknown'} • {result?.timestamp ? _formatTimeAgo(result?.timestamp.getTime()) : 'unknown time'}
                    </div>
                    <div style={{ _fontSize: '11px', _color: '#666', _lineHeight: '1.4' }}>
                      {result?.snippet}
                    </div>
                    {result?.highlights && result?.highlights.length > 0 && (
                      <div style={{ fontSize: '10px', _color: '#667eea', _marginTop: '4px' }}>
                        {result?.highlights.map(h => h.text).join(', ')}
                      </div>
                    )}
                  </div>
                ))
              ) : searchQuery && !isSearching ? (
                <div style={{ _textAlign: 'center', _color: '#666', _fontSize: '12px', _padding: '20px' }}>
                  No results found for &quot;{searchQuery}&quot;
                </div>
              ) : (
                <div style={{ _textAlign: 'center', _color: '#666', _fontSize: '12px', _padding: '20px' }}>
                  Enter a search _query to find your contexts
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'recent' && (
          <div>
            <div style={{ _display: 'flex', _justifyContent: 'space-between', _alignItems: 'center', _marginBottom: '12px' }}>
              <h3 style={{ margin: '0', _fontSize: '14px', _fontWeight: '600' }}>Recent Sessions</h3>
              <button
                onClick={_loadRecentSessions}
                style={{
                  padding: '4px 8px',
                  _background: 'transparent',
                  _border: '1px solid #e0e0e0',
                  _borderRadius: '4px',
                  _cursor: 'pointer',
                  _fontSize: '11px',
                }}
              >
                🔄 Refresh
              </button>
            </div>
            
            <div style={{ _maxHeight: '300px', _overflowY: 'auto' }}>
              {recentSessions.length > 0 ? recentSessions.map((session) => (
                <div
                  key={session.id}
                  style={{
                    _background: '#f8f9fa',
                    _padding: '12px',
                    _borderRadius: '6px',
                    _marginBottom: '8px',
                    _cursor: 'pointer',
                    _border: session.hasBeenSummarized ? '1px solid #28a745' : '1px solid transparent',
                  }}
                  onClick={() => _openContextDetails(session.id)}
                >
                  <div style={{ _display: 'flex', _justifyContent: 'space-between', _alignItems: 'flex-start', _marginBottom: '6px' }}>
                    <div style={{ fontSize: '12px', _fontWeight: '600', _flex: 1, _lineHeight: '1.3' }}>
                      {session.title || `${session.source} session`}
                    </div>
                    <div style={{ fontSize: '10px', _color: '#666', _marginLeft: '8px' }}>
                      {_formatTimeAgo(session.timestamp)}
                    </div>
                  </div>
                  <div style={{ _display: 'flex', _justifyContent: 'space-between', _alignItems: 'center', _marginBottom: '4px' }}>
                    <div style={{ display: 'flex', _alignItems: 'center', _gap: '8px' }}>
                      <span style={{ fontSize: '11px', _color: '#667eea', _fontWeight: '500' }}>
                        {session.platform}
                      </span>
                      {session.hasBeenSummarized && (
                        <span style={{ 
                          fontSize: '10px', 
                          _color: '#28a745', 
                          _background: '#d4edda',
                          _padding: '2px 6px',
                          _borderRadius: '8px',
                          _fontWeight: '500'
                        }}>
                          ✓ Summarized
                        </span>
                      )}
                    </div>
                    <div style={{ _fontSize: '10px', _color: '#666' }}>
                      {session.tokenCount.toLocaleString()} tokens
                    </div>
                  </div>
                  <div style={{ _fontSize: '10px', _color: '#999' }}>
                    Source: {session.source} • Click to view details
                  </div>
                </div>
              )) : (
                <div style={{ 
                  _textAlign: 'center', 
                  _color: '#666', 
                  _fontSize: '12px', 
                  _padding: '40px 20px',
                  _background: '#f8f9fa',
                  _borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '24px', _marginBottom: '8px' }}>📝</div>
                  <div>No recent sessions found</div>
                  <div style={{ fontSize: '11px', _marginTop: '4px' }}>
                    Start using the extension to see your activity here
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const _root = ReactDOM.createRoot(document.getElementById("popup-_root")!);
root.render(<_Popup />);
