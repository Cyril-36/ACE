import React, { useState, useEffect, useCallback } from 'react';
import { AdvancedSearch } from './AdvancedSearch';
import {
  SearchQuery,
  SearchResult,
  Context,
} from '../types';

interface SearchInterfaceProps {
  className?: string;
  onClose?: () => void;
}

interface SearchStats {
  totalDocuments: number;
  totalTerms: number;
  searchCount: number;
  avgSearchTime: number;
  lastIndexUpdate: number;
}

interface RecentSearch {
  query: string;
  timestamp: number;
  resultCount: number;
}

// Type helpers for Chrome extension message responses
type ChromeResponse = {
  success: boolean;
  stats?: SearchStats;
  searches?: RecentSearch[];
  results?: SearchResult[];
  error?: string;
};

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  className = '',
  onClose,
}) => {
  const [searchStats, setSearchStats] = useState<SearchStats | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [selectedContext, setSelectedContext] = useState<Context | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);

  useEffect(() => {
    void loadSearchStats();
    void loadRecentSearches();
  }, []);

  const loadSearchStats = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ _type: 'GET_SEARCH_STATS' });
      if (response.success) {
        setSearchStats(response.stats || null);
      }
    } catch (error) {
      console.error('Failed to load search stats:', error);
    }
  };

  const loadRecentSearches = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ _type: 'GET_RECENT_SEARCHES' });
      if (response.success) {
        setRecentSearches(response.searches || []);
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  };

  const handleSearch = useCallback(async (query: SearchQuery): Promise<SearchResult[]> => {
    try {
      // Save to recent searches
      const recentSearch: RecentSearch = {
        query: query.query,
        timestamp: Date.now(),
        resultCount: 0,
      };

      const response = await chrome.runtime.sendMessage({
        __type: 'SEARCH_CONTEXTS',
        query,
      });

      if (response.success) {
        // Update recent search with result count
        const results = response.results || [];
        recentSearch.resultCount = results.length;
        
        // Save recent search
        void chrome.runtime.sendMessage({
          __type: 'SAVE_RECENT_SEARCH',
          search: recentSearch,
        });

        setRecentSearches(prev => [recentSearch, ...prev.slice(0, 9)]); // Keep last 10
        
        return results;
      } else {
        console.error('Search failed:', response.error);
        return [];
      }
    } catch (error) {
      console.error('Search error: ', error);
      return [];
    }
  }, []);

  const handleResultSelect = useCallback((result: SearchResult) => {
    // For now, we'll need to fetch the full context using the contextId
    // setSelectedContext(result.context);
    
    // Track result selection
    void chrome.runtime.sendMessage({
      __type: 'TRACK_SEARCH_RESULT_CLICK',
      contextId: result.contextId,
      relevanceScore: result.relevance,
    });
  }, []);

  const handleContextOpen = (context: Context) => {
    // Open context in a new tab or detailed view
    void chrome.tabs.create({
      url: chrome.runtime.getURL(`options.html#context/${context.id}`)
    });
  };

  const rebuildSearchIndex = async () => {
    try {
      setIsIndexing(true);
      const response = await chrome.runtime.sendMessage({ _type: 'REBUILD_SEARCH_INDEX' });
      if (response.success) {
        await loadSearchStats();
      }
    } catch (error) {
      console.error('Failed to rebuild search index:', error);
    } finally {
      setIsIndexing(false);
    }
  };

  const clearRecentSearches = async () => {
    try {
      await chrome.runtime.sendMessage({ _type: 'CLEAR_RECENT_SEARCHES' });
      setRecentSearches([]);
    } catch (error) {
      console.error('Failed to clear recent searches:', error);
    }
  };



  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className={`search-interface ${className}`}>
      {/* Header */}
      <div className="search-header">
        <div className="header-content">
          <h1 className="search-title">
            <span className="search-icon" aria-hidden="true">🔍</span>
            Advanced Search
          </h1>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="close-button"
              aria-label="Close search interface"
            >
              ✕
            </button>
          )}
        </div>

        {/* Search Stats */}
        {searchStats && (
          <div className="search-stats">
            <div className="stat-item">
              <span className="stat-value">{searchStats.totalDocuments.toLocaleString()}</span>
              <span className="stat-label">Documents</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{searchStats.totalTerms.toLocaleString()}</span>
              <span className="stat-label">Terms</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{searchStats.searchCount.toLocaleString()}</span>
              <span className="stat-label">Searches</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{searchStats.avgSearchTime.toFixed(0)}ms</span>
              <span className="stat-label">Avg Time</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="search-content">
        {/* Search Interface */}
        <div className="search-main">
          <AdvancedSearch
            onSearch={handleSearch}
            onResultSelect={handleResultSelect}
            className="advanced-search-component"
          />
        </div>

        {/* Sidebar */}
        <div className="search-sidebar">
          {/* Recent Searches */}
          <div className="sidebar-section">
            <div className="section-header">
              <h3 className="section-title">Recent Searches</h3>
              {recentSearches.length > 0 && (
                <button
                  type="button"
                  onClick={() => void clearRecentSearches()}
                  className="clear-button"
                  aria-label="Clear recent searches"
                >
                  Clear
                </button>
              )}
            </div>
            
            {recentSearches.length > 0 ? (
              <div className="recent-searches">
                {recentSearches.map((search, index) => (
                  <div
                    key={index}
                    className="recent-search-item"
                    onClick={() => {
                      // Re-run the search
                      const searchInput = document.querySelector('._search-input') as HTMLInputElement;
                      if (searchInput) {
                        searchInput.value = search.query;
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const searchInput = document.querySelector('._search-input') as HTMLInputElement;
                        if (searchInput) {
                          searchInput.value = search.query;
                          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                      }
                    }}
                    aria-label={`Repeat search for "${search.query}"`}
                  >
                    <div className="recent-search-query">{search.query}</div>
                    <div className="recent-search-meta">
                      <span className="result-count">{search.resultCount} results</span>
                      <span className="search-time">{formatTimeAgo(search.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon" aria-hidden="true">📝</div>
                <div className="empty-text">No recent searches</div>
              </div>
            )}
          </div>

          {/* Search Tips */}
          <div className="sidebar-section">
            <h3 className="section-title">Search Tips</h3>
            <div className="search-tips">
              <div className="tip-item">
                <div className="tip-title">Use quotes for exact phrases</div>
                <div className="tip-example">&quot;React component&quot;</div>
              </div>
              <div className="tip-item">
                <div className="tip-title">Filter by source type</div>
                <div className="tip-example">Use the filters panel</div>
              </div>
              <div className="tip-item">
                <div className="tip-title">Search by date range</div>
                <div className="tip-example">Set start and end dates</div>
              </div>
              <div className="tip-item">
                <div className="tip-title">Use quality threshold</div>
                <div className="tip-example">Filter low-quality results</div>
              </div>
            </div>
          </div>

          {/* Index Management */}
          <div className="sidebar-section">
            <h3 className="section-title">Index Management</h3>
            <div className="index-management">
              {searchStats && (
                <div className="index-info">
                  <div className="index-stat">
                    <span className="index-label">Last Updated:</span>
                    <span className="index-value">
                      {formatTimeAgo(searchStats.lastIndexUpdate)}
                    </span>
                  </div>
                </div>
              )}
              
              <button
                type="button"
                onClick={() => void rebuildSearchIndex()}
                disabled={isIndexing}
                className="rebuild-button"
                aria-label="Rebuild search index"
              >
                {isIndexing ? (
                  <>
                    <span className="loading-spinner" aria-hidden="true">⏳</span>
                    Rebuilding...
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">🔄</span>
                    Rebuild Index
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Context Detail Modal */}
      {selectedContext && (
        <div className="context-modal" role="dialog" aria-modal="true" aria-labelledby="context-title">
          <div className="modal-backdrop" onClick={() => setSelectedContext(null)} />
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="context-title" className="modal-title">
                Context Details
              </h2>
              <button
                type="button"
                onClick={() => setSelectedContext(null)}
                className="modal-close"
                aria-label="Close context details"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="context-meta">
                <div className="meta-item">
                  <strong>Source:</strong> {selectedContext.source}
                </div>
                <div className="meta-item">
                  <strong>Created:</strong> {new Date(selectedContext.timestamp).toLocaleString()}
                </div>
                <div className="meta-item">
                  <strong>Token Count:</strong> {selectedContext.metadata.tokenCount}
                </div>
                {selectedContext.metadata.tags && selectedContext.metadata.tags.length > 0 && (
                  <div className="meta-item">
                    <strong>Tags:</strong>
                    <div className="context-tags">
                      {selectedContext.metadata.tags.map(tag => (
                        <span key={tag} className="context-tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="context-content">
                <h4>Content</h4>
                <div className="content-text">
                  {selectedContext.content}
                </div>
              </div>

              {selectedContext.summary && (
                <div className="context-summary">
                  <h4>Summary</h4>
                  <div className="summary-text">
                    {selectedContext.summary}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => handleContextOpen(selectedContext)}
                className="action-primary"
              >
                Open Full View
              </button>
              <button
                type="button"
                onClick={() => setSelectedContext(null)}
                className="action-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        ._search-interface {
          display: flex;
          flex-direction: column;
          height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f9fafb;
        }

        ._search-header {
          background: white;
          border-bottom: 1px solid #e5e7eb;
          padding: 20px;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        ._search-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: #111827;
        }

        ._search-icon {
          font-size: 28px;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 8px;
          border-radius: 6px;
          color: #6b7280;
          transition: all 0.2s;
        }

        .close-button:hover {
          background: #f3f4f6;
          color: #374151;
        }

        ._search-stats {
          display: flex;
          gap: 24px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          color: #3b82f6;
        }

        .stat-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        ._search-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        ._search-main {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .advanced-search-component {
          flex: 1;
        }

        ._search-sidebar {
          width: 300px;
          background: white;
          border-left: 1px solid #e5e7eb;
          overflow-y: auto;
        }

        .sidebar-section {
          padding: 20px;
          border-bottom: 1px solid #f3f4f6;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .section-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        .clear-button {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .clear-button:hover {
          background: #fef2f2;
        }

        .recent-searches {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .recent-search-item {
          padding: 12px;
          background: #f9fafb;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .recent-search-item:hover {
          background: #f3f4f6;
        }

        .recent-search-item:focus {
          outline: none;
          background: #eff6ff;
          border: 2px solid #3b82f6;
        }

        .recent-search-query {
          font-weight: 500;
          color: #111827;
          margin-bottom: 4px;
        }

        .recent-search-meta {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #6b7280;
        }

        .empty-state {
          text-align: center;
          padding: 24px 12px;
          color: #6b7280;
        }

        .empty-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .empty-text {
          font-size: 14px;
        }

        ._search-tips {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .tip-item {
          padding: 12px;
          background: #f0f9ff;
          border-radius: 6px;
          border-left: 3px solid #3b82f6;
        }

        .tip-title {
          font-weight: 500;
          color: #111827;
          margin-bottom: 4px;
        }

        .tip-example {
          font-size: 12px;
          color: #6b7280;
          font-family: 'SF Mono', Monaco, monospace;
          background: #e5e7eb;
          padding: 2px 6px;
          border-radius: 3px;
          display: inline-block;
        }

        .index-management {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .index-info {
          padding: 12px;
          background: #f9fafb;
          border-radius: 6px;
        }

        .index-stat {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }

        .index-label {
          color: #6b7280;
        }

        .index-value {
          font-weight: 500;
          color: #111827;
        }

        .rebuild-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .rebuild-button:hover:not(:disabled) {
          background: #2563eb;
        }

        .rebuild-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .loading-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .context-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
        }

        .modal-content {
          position: relative;
          background: white;
          border-radius: 12px;
          max-width: 800px;
          max-height: 80vh;
          width: 90vw;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          color: #6b7280;
        }

        .modal-close:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .context-meta {
          margin-bottom: 20px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .meta-item {
          margin-bottom: 8px;
          font-size: 14px;
        }

        .context-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 4px;
        }

        .context-tag {
          background: #e5e7eb;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
        }

        .context-content, .context-summary {
          margin-bottom: 20px;
        }

        .context-content h4, .context-summary h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        .content-text, .summary-text {
          line-height: 1.6;
          color: #374151;
          white-space: pre-wrap;
          background: #f9fafb;
          padding: 16px;
          border-radius: 8px;
          border-left: 3px solid #3b82f6;
        }

        .summary-meta {
          display: flex;
          gap: 16px;
          margin-top: 8px;
          font-size: 12px;
          color: #6b7280;
        }

        .modal-actions {
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .action-primary {
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        }

        .action-primary:hover {
          background: #2563eb;
        }

        .action-secondary {
          padding: 10px 20px;
          background: white;
          color: #374151;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          cursor: pointer;
        }

        .action-secondary:hover {
          background: #f3f4f6;
        }

        @media (max-width: 1024px) {
          ._search-content {
            flex-direction: column;
          }

          ._search-sidebar {
            width: 100%;
            border-left: none;
            border-top: 1px solid #e5e7eb;
            max-height: 300px;
          }

          ._search-stats {
            flex-wrap: wrap;
            gap: 16px;
          }
        }

        @media (max-width: 768px) {
          ._search-header {
            padding: 16px;
          }

          ._search-title {
            font-size: 20px;
          }

          ._search-stats {
            justify-content: center;
          }

          .modal-content {
            width: 95vw;
            max-height: 90vh;
          }
        }
      `}</style>
    </div>
  );
};

export default SearchInterface;