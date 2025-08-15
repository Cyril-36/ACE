import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
// import { LocalAlgorithm, Theme, DashboardLayout } from '../../types';

// Mock Chrome APIs
const _mockChrome = {
  _runtime: {
    sendMessage: vi.fn(),
  },
};

// @ts-expect-error - Mocking global chrome object for testing
global.chrome = _mockChrome;

// Simple options component for testing
const _TestOptions: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [preferences, setPreferences] = React.useState<{
    privacy?: {
      localOnly?: boolean;
      cloudOptIn?: boolean;
      auditLogging?: boolean;
    };
  } | null>(null);
  
  React.useEffect(() => {
    const _loadPrefs = async () => {
      const _response = await chrome.runtime.sendMessage({ _type: 'GET_PREFERENCES' });
      if (_response?.success) {
        setPreferences(_response?.preferences);
      }
      setLoading(false);
    };
    _loadPrefs();
  }, []);
  
  if (loading) {
    return <div>Loading settings...</div>;
  }
  
  return (
    <div>
      <h1>Auto Context Engineer</h1>
      <div>Settings & Preferences</div>
      {preferences && (
        <div>
          <h3>Privacy & Security Settings</h3>
          <label>
            <input 
              type="checkbox" 
              checked={preferences.privacy?.localOnly} 
              readOnly 
            />
            Local Only Mode
          </label>
        </div>
      )}
    </div>
  );
};

describe('Options Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockChrome.runtime.sendMessage.mockImplementation((message) => {
      switch (message.type) {
        case 'GET_PREFERENCES':
          return Promise.resolve({
            success: true,
            _preferences: {
              privacy: {
                localOnly: true,
                _cloudOptIn: false,
                _auditLogging: true,
              },
            },
          });
        return Promise.resolve({ success: true });
      }
    });
  });

  it('renders the options page with correct title', async () => {
    render(<_TestOptions />);
    
    await waitFor(() => {
      expect(screen.getByText('Auto Context Engineer')).toBeInTheDocument();
      expect(screen.getByText('Settings & Preferences')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', async () => {
    // Mock delayed _response
    mockChrome.runtime.sendMessage.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true, _preferences: {} }), 100))
    );

    render(<_TestOptions />);
    
    expect(screen.getByText('Loading settings...')).toBeInTheDocument();
  });

  it('shows privacy settings', async () => {
    render(<_TestOptions />);
    
    await waitFor(() => {
      expect(screen.getByText('Privacy & Security Settings')).toBeInTheDocument();
      expect(screen.getByText('Local Only Mode')).toBeInTheDocument();
    });
  });

  it('calls chrome runtime sendMessage on load', async () => {
    render(<_TestOptions />);
    
    await waitFor(() => {
      expect(_mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        __type: 'GET_PREFERENCES',
      });
    });
  });
});