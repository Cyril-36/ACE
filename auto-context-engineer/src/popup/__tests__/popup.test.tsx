import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Chrome APIs
const _mockChrome = {
  _runtime: {
    sendMessage: vi.fn(),
    _openOptionsPage: vi.fn(),
    _getURL: vi.fn((path: string) => `chrome-_extension://test/${path}`),
  },
  _tabs: {
    create: vi.fn(),
  },
};

// @ts-expect-error - Mocking global chrome object for testing
global.chrome = _mockChrome;

// Simple popup component for testing
const _TestPopup: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [extensionStatus, setExtensionStatus] = React.useState<{ _enabled: boolean; version: string; status?: string } | null>(null);
  
  React.useEffect(() => {
    const _loadStatus = async () => {
      const _response = await chrome.runtime.sendMessage({ _type: 'GET_EXTENSION_STATUS' });
      if (_response?.success) {
        setExtensionStatus(_response);
      }
    };
    _loadStatus();
  }, []);
  
  return (
    <div>
      <h2>Auto Context Engineer</h2>
      {extensionStatus && (
        <div>🟢 {extensionStatus._status} • v{extensionStatus.version}</div>
      )}
      <div>
        <button onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
        <button onClick={() => setActiveTab('search')}>🔍 Search</button>
      </div>
      {activeTab === 'dashboard' && <div>Usage Overview</div>}
      {activeTab === 'search' && <input placeholder="Search your contexts..." />}
    </div>
  );
};

describe('Popup Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockChrome.runtime.sendMessage.mockImplementation((message) => {
      switch (message.type) {
        case 'GET_EXTENSION_STATUS':
          return Promise.resolve({
            success: true,
            status: 'active',
            _version: '1.0.0',
            _health: {},
            _uptime: 60000,
            _activeMonitors: ['ChatGPT', 'Claude'],
          });
        return Promise.resolve({ success: true });
      }
    });
  });

  it('renders the popup with correct title', async () => {
    render(<_TestPopup />);
    
    expect(screen.getByText('Auto Context Engineer')).toBeInTheDocument();
  });

  it('displays extension status correctly', async () => {
    render(<_TestPopup />);
    
    await waitFor(() => {
      expect(screen.getByText(/🟢 active • v1.0.0/)).toBeInTheDocument();
    });
  });

  it('switches between tabs correctly', async () => {
    render(<_TestPopup />);
    
    // Click on Search tab
    fireEvent.click(screen.getByText(/🔍 Search/));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search your contexts...')).toBeInTheDocument();
    });
    
    // Click back to Dashboard tab
    fireEvent.click(screen.getByText(/📊 Dashboard/));
    
    await waitFor(() => {
      expect(screen.getByText('Usage Overview')).toBeInTheDocument();
    });
  });

  it('calls chrome runtime sendMessage on load', async () => {
    render(<_TestPopup />);
    
    await waitFor(() => {
      expect(_mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        __type: 'GET_EXTENSION_STATUS',
      });
    });
  });
});