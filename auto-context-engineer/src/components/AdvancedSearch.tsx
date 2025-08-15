import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SearchQuery,
  SearchResult,
  SortOption,
  ContextSource,
} from '../types';

interface AdvancedSearchProps {
  onSearch: (query: SearchQuery) => Promise<SearchResult[]>;
  onResultSelect: (result: SearchResult) => void;
  className?: string;
}

interface SearchState {
  query: string;
  filters: {
    source?: ContextSource[];
    dateRange?: {
      start: Date;
      end: Date;
    };
    tags?: string[];
    minQuality?: number;
  };
  sortBy: SortOption;
  results: SearchResult[];
  isSearching: boolean;
  showFilters: boolean;
  selectedResult: SearchResult | null;
  previewMode: boolean;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  onResultSelect,
  className = '',
}) => {
  const [state, setState] = useState<SearchState>({
    query: '',
    filters: {},
    sortBy: SortOption.RELEVANCE,
    results: [],
    isSearching: false,
    showFilters: false,
    selectedResult: null,
    previewMode: false,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (state.selectedResult) {
          setState(prev => ({ ...prev, selectedResult: null, previewMode: false }));
        } else if (state.showFilters) {
          setState(prev => ({ ...prev, showFilters: false }));
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedResult, state.showFilters]);

  const handleSearch = useCallback(async () => {
    if (!state.query.trim()) {
      setState(prev => ({ ...prev, results: [] }));
      return;
    }

    setState(prev => ({ ...prev, isSearching: true }));

    try {
      const searchQuery: SearchQuery = {
        query: state.query,
        filters: state.filters,
        sort: state.sortBy,
        limit: 50,
      };

      const results = await onSearch(searchQuery);
      setState(prev => ({ ...prev, results, isSearching: false }));
    } catch (error) {
      console.error('Search failed:', error);
      setState(prev => ({ ...prev, results: [], isSearching: false }));
    }
  }, [state.query, state.filters, state.sortBy, onSearch]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (state.query.trim()) {
        void handleSearch();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [state.query, handleSearch]);

  const updateFilters = (newFilters: Partial<SearchState['filters']>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters },
    }));
  };

  const clearFilters = () => {
    setState(prev => ({
      ...prev,
      filters: {},
    }));
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

  const highlightText = (text: string, terms: string[]) => {
    if (!terms.length) return text;

    let highlightedText = text;
    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(
        regex,
        '<mark class="search-highlight">$1</mark>'
      );
    });

    return highlightedText;
  };

  const getSourceIcon = (source: ContextSource) => {
    switch (source) {
      case ContextSource.IDE: return '💻';
      case ContextSource.CHAT: return '💬';
      case ContextSource.WEB: return '🌐';
      case ContextSource.MANUAL: return '📝';
      default: return '📄';
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 0.8) return '#22c55e'; // green
    if (score >= 0.6) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div className={`advanced-search ${className}`} role="search" aria-label="Advanced search interface">
      {/* Search Header */}
      <div className="search-header">
        <div className="search-input-container">
          <input
            ref={searchInputRef}
            type="text"
            value={state.query}
            onChange={(e) => setState(prev => ({ ...prev, query: e.target.value }))}
            placeholder="Search your contexts..."
            className="search-input"
            aria-label="Search query"
            aria-describedby="search-help"
          />
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={state.isSearching || !state.query.trim()}
            className="search-button"
            aria-label="Execute search"
          >
            {state.isSearching ? (
              <span className="loading-spinner" aria-hidden="true">⏳</span>
            ) : (
              <span aria-hidden="true">🔍</span>
            )}
          </button>
        </div>

        <div className="search-controls">
          <button
            type="button"
            onClick={() => setState(prev => ({ ...prev, showFilters: !prev.showFilters }))}
            className={`filter-toggle ${state.showFilters ? 'active' : ''}`}
            aria-expanded={state.showFilters}
            aria-controls="search-filters"
          >
            <span aria-hidden="true">🎛️</span> Filters
            {Object.keys(state.filters).length > 0 && (
              <span className="filter-count" aria-label={`${Object.keys(state.filters).length} filters active`}>
                {Object.keys(state.filters).length}
              </span>
            )}
          </button>

          <select
            value={state.sortBy}
            onChange={(e) => setState(prev => ({ ...prev, sortBy: e.target.value as SortOption }))}
            className="sort-select"
            aria-label="Sort results by"
          >
            <option value={SortOption.RELEVANCE}>Relevance</option>
            <option value={SortOption.DATE_DESC}>Newest First</option>
            <option value={SortOption.DATE_ASC}>Oldest First</option>
            <option value={SortOption.QUALITY}>Quality</option>
          </select>
        </div>
      </div>

      {/* Search Help */}
      <div id="search-help" className="search-help" aria-live="polite">
        {state.query && (
          <span>
            {state.isSearching ? 'Searching...' : `${state.results.length} result${state.results.length !== 1 ? 's' : ''} found`}
          </span>
        )}
      </div>

      {/* Advanced Filters */}
      {state.showFilters && (
        <div id="search-filters" className="search-filters" role="region" aria-label="Search filters">
          <div className="filter-section">
            <label className="filter-label">Sources</label>
            <div className="filter-checkboxes" role="group" aria-label="Filter by source">
              {Object.values(ContextSource).map(source => (
                <label key={source} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={state.filters.source?.includes(source) || false}
                    onChange={(e) => {
                      const sources = state.filters.source || [];
                      if (e.target.checked) {
                        updateFilters({ source: [...sources, source] });
                      } else {
                        updateFilters({ source: sources.filter((s: ContextSource) => s !== source) });
                      }
                    }}
                  />
                  <span>{getSourceIcon(source)} {source}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <label className="filter-label">Date Range</label>
            <div className="date-range-inputs">
              <input
                type="date"
                value={state.filters.dateRange?.start ? state.filters.dateRange.start.toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const start = new Date(e.target.value);
                    const end = state.filters.dateRange?.end || new Date();
                    updateFilters({ dateRange: { start, end } });
                  }
                }}
                className="date-input"
                aria-label="Start date"
              />
              <span>to</span>
              <input
                type="date"
                value={state.filters.dateRange?.end ? state.filters.dateRange.end.toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const end = new Date(e.target.value);
                    const start = state.filters.dateRange?.start || new Date(0);
                    updateFilters({ dateRange: { start, end } });
                  }
                }}
                className="date-input"
                aria-label="End date"
              />
            </div>
          </div>

          <div className="filter-section">
            <label className="filter-label">Minimum Quality</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={state.filters.minQuality || 0}
              onChange={(e) => updateFilters({ minQuality: parseFloat(e.target.value) })}
              className="quality-slider"
              aria-label="Minimum quality threshold"
            />
            <span className="quality-value">
              {((state.filters.minQuality || 0) * 100).toFixed(0)}%
            </span>
          </div>

          <div className="filter-actions">
            <button type="button" onClick={clearFilters} className="clear-filters-button">
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Search Results */}
      <div
        ref={resultsContainerRef}
        className="search-results"
        role="region"
        aria-label="Search results"
        aria-live="polite"
      >
        {state.results.length > 0 ? (
          <div className="results-list">
            {state.results.map((result, index) => (
              <div
                key={result.contextId}
                className={`result-item ${state.selectedResult?.contextId === result.contextId ? 'selected' : ''}`}
                onClick={() => {
                  setState(prev => ({ ...prev, selectedResult: result, previewMode: true }));
                  onResultSelect(result);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setState(prev => ({ ...prev, selectedResult: result, previewMode: true }));
                    onResultSelect(result);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Search result ${index + 1}: ${result.source || 'unknown'} from ${result.timestamp ? formatTimeAgo(result.timestamp.getTime()) : 'unknown time'}`}
              >
                <div className="result-header">
                  <div className="result-meta">
                    <span className="result-source">
                      {getSourceIcon(result.source || ContextSource.MANUAL)} {result.source || 'unknown'}
                    </span>
                    <span className="result-time">{result.timestamp ? formatTimeAgo(result.timestamp.getTime()) : 'unknown time'}</span>
                    <div
                      className="result-quality"
                      style={{ '--quality-color': getQualityColor(result.relevance) } as React.CSSProperties}
                      title={`Relevance: ${(result.relevance * 100).toFixed(1)}%`}
                    >
                      ●
                    </div>
                  </div>
                </div>

                <div className="result-content">
                  <div
                    className="result-snippet"
                    dangerouslySetInnerHTML={{
                      __html: highlightText(result.snippet, result.highlights.map(h => h.text))
                    }}
                  />
                  {result.highlights.length > 0 && (
                    <div className="result-terms">
                      {result.highlights.map(highlight => (
                        <span key={highlight.text} className="highlighted-term">
                          {highlight.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : state.query && !state.isSearching ? (
          <div className="no-results" role="status">
            <div className="no-results-icon">🔍</div>
            <div className="no-results-text">
              No results found for &quot;{state.query}&quot;
            </div>
            <div className="no-results-suggestions">
              Try adjusting your search terms or filters
            </div>
          </div>
        ) : !state.query ? (
          <div className="search-placeholder" role="status">
            <div className="placeholder-icon">💡</div>
            <div className="placeholder-text">
              Enter a search query to find your contexts
            </div>
            <div className="placeholder-tips">
              <strong>Tips:</strong>
              <ul>
                <li>Use specific keywords for better results</li>
                <li>Try filtering by source or date range</li>
                <li>Use quotes for exact phrases</li>
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      {/* Context Preview Modal */}
      {state.previewMode && state.selectedResult && (
        <div className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title">
          <div className="preview-backdrop" onClick={() => setState(prev => ({ ...prev, previewMode: false, selectedResult: null }))} />
          <div className="preview-content">
            <div className="preview-header">
              <h3 id="preview-title" className="preview-title">
                {getSourceIcon(state.selectedResult.source || ContextSource.MANUAL)} Context Preview
              </h3>
              <button
                type="button"
                onClick={() => setState(prev => ({ ...prev, previewMode: false, selectedResult: null }))}
                className="preview-close"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>

            <div className="preview-meta">
              <div className="preview-meta-item">
                <strong>Source:</strong> {state.selectedResult.source || 'unknown'}
              </div>
              <div className="preview-meta-item">
                <strong>Created:</strong> {state.selectedResult.timestamp ? new Date(state.selectedResult.timestamp).toLocaleString() : 'unknown'}
              </div>
              <div className="preview-meta-item">
                <strong>Relevance:</strong> {(state.selectedResult.relevance * 100).toFixed(1)}%
              </div>
              {state.selectedResult.tags && state.selectedResult.tags.length > 0 && (
                <div className="preview-meta-item">
                  <strong>Tags:</strong>
                  <div className="preview-tags">
                    {state.selectedResult.tags.map(tag => (
                      <span key={tag} className="preview-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="preview-body">
              <div
                className="preview-text"
                dangerouslySetInnerHTML={{
                  __html: highlightText(state.selectedResult.content || state.selectedResult.snippet, state.selectedResult.highlights.map(h => h.text))
                }}
              />
            </div>

            <div className="preview-actions">
              <button
                type="button"
                onClick={() => {
                  onResultSelect(state.selectedResult!);
                  setState(prev => ({ ...prev, previewMode: false, selectedResult: null }));
                }}
                className="preview-action-primary"
              >
                Open Full Context
              </button>
              <button
                type="button"
                onClick={() => setState(prev => ({ ...prev, previewMode: false, selectedResult: null }))}
                className="preview-action-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .advanced-search {
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .search-header {
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .search-input-container {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .search-input {
          flex: 1;
          padding: 12px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .search-button {
          padding: 12px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          transition: background-color 0.2s;
        }

        .search-button:hover:not(:disabled) {
          background: #2563eb;
        }

        .search-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .search-controls {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .filter-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .filter-toggle:hover {
          background: #f3f4f6;
        }

        .filter-toggle.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .filter-count {
          background: #ef4444;
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }

        .sort-select {
          padding: 8px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: white;
          font-size: 14px;
        }

        .search-help {
          padding: 8px 16px;
          font-size: 14px;
          color: #6b7280;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .search-filters {
          padding: 16px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .filter-section {
          margin-bottom: 16px;
        }

        .filter-label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .filter-checkboxes {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .date-range-inputs {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .date-input {
          padding: 6px 8px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          font-size: 14px;
        }

        .quality-slider {
          width: 200px;
          margin-right: 12px;
        }

        .quality-value {
          font-weight: 600;
          color: #374151;
        }

        .filter-actions {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }

        .clear-filters-button {
          padding: 8px 16px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .search-results {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .results-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .result-item {
          padding: 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .result-item:hover {
          border-color: #3b82f6;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .result-item.selected {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .result-item:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .result-header {
          margin-bottom: 8px;
        }

        .result-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          color: #6b7280;
        }

        .result-source {
          font-weight: 600;
        }

        .result-quality {
          font-size: 16px;
          color: var(--quality-color, #3B82F6);
        }

        .result-content {
          line-height: 1.5;
        }

        .result-snippet {
          margin-bottom: 8px;
          color: #374151;
        }

        .result-terms {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .highlighted-term {
          background: #fef3c7;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        :global(.search-highlight) {
          background: #fbbf24;
          padding: 1px 2px;
          border-radius: 2px;
          font-weight: 600;
        }

        .no-results, .search-placeholder {
          text-align: center;
          padding: 48px 24px;
          color: #6b7280;
        }

        .no-results-icon, .placeholder-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .no-results-text, .placeholder-text {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .no-results-suggestions {
          font-size: 14px;
        }

        .placeholder-tips {
          text-align: left;
          max-width: 300px;
          margin: 16px auto 0;
        }

        .placeholder-tips ul {
          margin: 8px 0 0 16px;
          padding: 0;
        }

        .placeholder-tips li {
          margin-bottom: 4px;
        }

        .preview-modal {
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

        .preview-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
        }

        .preview-content {
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

        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .preview-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .preview-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          color: #6b7280;
        }

        .preview-close:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .preview-meta {
          padding: 16px 20px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .preview-meta-item {
          font-size: 14px;
        }

        .preview-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 4px;
        }

        .preview-tag {
          background: #e5e7eb;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
        }

        .preview-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .preview-text {
          line-height: 1.6;
          color: #374151;
          white-space: pre-wrap;
        }

        .preview-actions {
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .preview-action-primary {
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        }

        .preview-action-primary:hover {
          background: #2563eb;
        }

        .preview-action-secondary {
          padding: 10px 20px;
          background: white;
          color: #374151;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          cursor: pointer;
        }

        .preview-action-secondary:hover {
          background: #f3f4f6;
        }

        .loading-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .search-controls {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
          }

          .filter-checkboxes {
            flex-direction: column;
          }

          .date-range-inputs {
            flex-direction: column;
            align-items: stretch;
          }

          .preview-content {
            width: 95vw;
            max-height: 90vh;
          }

          .preview-meta {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default AdvancedSearch;