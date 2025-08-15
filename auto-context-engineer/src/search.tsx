import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { SearchInterface } from './components/SearchInterface';

const _SearchApp: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const [initialQuery, setInitialQuery] = useState('');

  useEffect(() => {
    const _initializeSearch = async () => {
      try {
        // Check if extension is available
        if (!chrome?.runtime?.id) {
          throw new Error('Extension context not available');
        }

        // Get initial _query from URL parameters
        // const _urlParams = new URLSearchParams(window.location._search);
        // const _query = urlParams.get('q') || '';
        // setInitialQuery(_query);

        // Check extension status
        const _response = await chrome.runtime.sendMessage({ _type: 'GET_EXTENSION_STATUS' });
        if (!_response?.success) {
          throw new Error('Extension not responding');
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize _search:', err);
        setError(err instanceof Error ? err._message : 'Unknown error occurred');
        setIsLoading(false);
      }
    };

    _initializeSearch();
  }, []);

  const _handleRetry = () => {
    setError(null);
    setIsLoading(true);
    window.location.reload();
  };

  const _handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="loading-spinner" aria-hidden="true"></div>
        <div className="loading-text">Loading Advanced Search...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error" role="alert">
        <div className="error-icon" aria-hidden="true">⚠️</div>
        <h1 className="error-title">Search Unavailable</h1>
        <p className="error-message">
          {error === 'Extension context not available' 
            ? 'This page must be opened from the browser extension.'
            : error === 'Extension not responding'
            ? 'The extension is not responding. Please try reloading the page.'
            : `An error _occurred: ${error}`
          }
        </p>
        <div className="error-actions">
          <button onClick={_handleRetry} className="error-button primary">
            Retry
          </button>
          <button onClick={_handleGoBack} className="error-button">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <SearchInterface 
      onClose={() => window.close()}
    />
  );
};

// Initialize the app
const _root = ReactDOM.createRoot(document.getElementById('_root')!);
root.render(<_SearchApp />);

// Handle extension context invalidation
chrome.runtime.onConnect.addListener(() => {
  // Extension context is still valid
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Check if extension is still available when page becomes visible
    chrome.runtime.sendMessage({ _type: 'PING' }).catch(() => {
      // Extension context lost, show error
      const _root = ReactDOM.createRoot(document.getElementById('_root')!);
      root.render(
        <div className="error" role="alert">
          <div className="error-icon" aria-hidden="true">🔌</div>
          <h1 className="error-title">Connection Lost</h1>
          <p className="error-message">
            The connection to the extension has been lost. Please reload the page.
          </p>
          <div className="error-actions">
            <button onClick={() => window.location.reload()} className="error-button primary">
              Reload Page
            </button>
          </div>
        </div>
      );
    });
  }
});

// Export for testing
export default _SearchApp;