// Test setup file
import { vi } from "vitest";
import '@testing-library/jest-dom';

// Mock Chrome APIs
const mockChrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getURL: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
  scripting: {
    executeScript: vi.fn(),
  },
};

// @ts-expect-error - Mocking global chrome object for testing environment
global.chrome = mockChrome;

// Mock Web Crypto API
const mockCryptoKey = {
  algorithm: { name: 'AES-GCM', length: 256 },
  usages: ['encrypt', 'decrypt'],
};

Object.defineProperty(global, "crypto", {
  value: {
    getRandomValues: vi.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      encrypt: vi.fn().mockImplementation(async (_algorithm, _key, data) => {
        // Return the original data as encrypted (for testing purposes)
        return data;
      }),
      decrypt: vi.fn().mockImplementation(async (_algorithm, _key, data) => {
        // Return the data as decrypted (for testing purposes)
        return data;
      }),
      generateKey: vi.fn().mockResolvedValue(mockCryptoKey),
      deriveKey: vi.fn().mockResolvedValue(mockCryptoKey),
      exportKey: vi.fn().mockImplementation(async (_format, _key) => {
        // Return a consistent key export for testing
        const keyData = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          keyData[i] = i; // Predictable pattern for testing
        }
        return keyData.buffer;
      }),
      importKey: vi.fn().mockResolvedValue(mockCryptoKey),
    },
  },
});

// Mock TextEncoder/TextDecoder
Object.defineProperty(global, 'TextEncoder', {
  value: class TextEncoder {
    encode(input: string) {
      return new Uint8Array(Buffer.from(input, 'utf8'));
    }
  },
});

Object.defineProperty(global, 'TextDecoder', {
  value: class TextDecoder {
    decode(input: Uint8Array) {
      return Buffer.from(input).toString('utf8');
    }
  },
});

// Mock btoa/atob
Object.defineProperty(global, 'btoa', {
  value: (str: string) => Buffer.from(str, 'binary').toString('base64'),
});

Object.defineProperty(global, 'atob', {
  value: (str: string) => Buffer.from(str, 'base64').toString('binary'),
});

// Mock DOM APIs for React components
Object.defineProperty(window, 'matchMedia', {
  _writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock URL APIs
global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
global.URL.revokeObjectURL = vi.fn();

// Mock window.confirm
global.confirm = vi.fn(() => true);
