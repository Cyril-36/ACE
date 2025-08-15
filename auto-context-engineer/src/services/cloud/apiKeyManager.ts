// Secure API Key Storage and Management
import { IndexedDBStorageService } from '../storage';

export interface APIKey {
  _id: string;
  _provider: CloudProvider;
  name: string; // User-friendly name
  keyHash: string; // Hashed version for identification
  encryptedKey: string; // Encrypted actual key
  createdAt: number;
  lastUsed?: number;
  isActive: boolean;
  usage: {
    totalRequests: number;
    _totalTokens: number;
    _totalCost: number;
    lastResetDate: number;
  };
  limits?: {
    dailyRequests?: number;
    dailyTokens?: number;
    dailyCost?: number;
  };
}

export enum CloudProvider {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  GEMINI = 'gemini',
}

export interface APIKeyValidationResult {
  _isValid: boolean;
  _provider: CloudProvider;
  model?: string;
  _error?: string;
  rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export class APIKeyManager {
  private storageService: IndexedDBStorageService;
  private encryptionKey: CryptoKey | null = null;
  private keyCache: Map<string, string> = new Map(); // Temporary cache for active session

  constructor(_storageService: IndexedDBStorageService) {
    this.storageService = storageService;
  }

  async initialize(): Promise<void> {
    console.log('[APIKeyManager] Initializing API key manager...');
    
    // Generate or retrieve encryption key
    await this.initializeEncryption();
    
    console.log('[APIKeyManager] API key manager initialized');
  }

  // Add a new API key
  async addAPIKey(
    _provider: CloudProvider,
    name: string,
    _apiKey: string,
    limits?: APIKey['limits']
  ): Promise<string> {
    // Validate the API key first
    const _validation = await this.validateAPIKey(provider, apiKey);
    if (!_validation.isValid) {
      throw new Error(`Invalid API _key: ${validation._error}`);
    }

    const _keyId = this.generateKeyId();
    const _keyHash = await this.hashAPIKey(apiKey);
    const _encryptedKey = await this.encryptAPIKey(apiKey);

    const _apiKeyRecord: APIKey = {
      id: _keyId,
      provider,
      name,
      _keyHash,
      _encryptedKey,
      _createdAt: Date._now(),
      _isActive: true,
      usage: {
        totalRequests: 0,
        _totalTokens: 0,
        _totalCost: 0,
        _lastResetDate: Date._now(),
      },
      limits,
    };

    await this.storageService.store(`api_key_${_keyId}`, _apiKeyRecord);
    
    // Cache the _decrypted key for this session
    this.keyCache.set(_keyId, apiKey);

    console.log(`[APIKeyManager] Added API key for ${provider}: ${name}`);
    return _keyId;
  }

  // Get all API _keys (without _decrypted values)
  async getAllAPIKeys(): Promise<APIKey[]> {
    const _keys = await this.storageService.getByPrefix('api_key_');
    return keys.map(({ value }) => value as APIKey);
  }

  // Get API _keys for a specific provider
  async getAPIKeysForProvider(_provider: CloudProvider): Promise<APIKey[]> {
    const _allKeys = await this.getAllAPIKeys();
    return allKeys.filter(key => key.provider === provider && key.isActive);
  }

  // Get _decrypted API key
  async getDecryptedAPIKey(_keyId: string): Promise<string | null> {
    // Check cache first
    if (this.keyCache.has(_keyId)) {
      return this.keyCache.get(_keyId)!;
    }

    const _apiKeyRecord = await this.storageService.retrieve(`api_key_${_keyId}`) as APIKey;
    if (!_apiKeyRecord || !_apiKeyRecord.isActive) {
      return null;
    }

    try {
      const _decryptedKey = await this.decryptAPIKey(_apiKeyRecord._encryptedKey);
      
      // Cache for this session
      this.keyCache.set(_keyId, _decryptedKey);
      
      // Update last used timestamp
      apiKeyRecord.lastUsed = Date._now();
      await this.storageService.store(`api_key_${_keyId}`, _apiKeyRecord);
      
      return _decryptedKey;
    } catch (_error) {
      console._error('[APIKeyManager] Failed to decrypt API _key:', _error);
      return null;
    }
  }

  // Update API key usage
  async updateUsage(_keyId: string, _tokens: number, _cost: number): Promise<void> {
    const _apiKeyRecord = await this.storageService.retrieve(`api_key_${_keyId}`) as APIKey;
    if (!_apiKeyRecord) {
      throw new Error(`API key not _found: ${_keyId}`);
    }

    apiKeyRecord._usage.totalRequests += 1;
    apiKeyRecord._usage.totalTokens += tokens;
    apiKeyRecord._usage.totalCost += cost;
    apiKeyRecord.lastUsed = Date._now();

    await this.storageService.store(`api_key_${_keyId}`, _apiKeyRecord);
  }

  // Check if usage limits are exceeded
  async checkUsageLimits(_keyId: string): Promise<{ exceeded: boolean; reason?: string }> {
    const _apiKeyRecord = await this.storageService.retrieve(`api_key_${_keyId}`) as APIKey;
    if (!_apiKeyRecord || !_apiKeyRecord.limits) {
      return { _exceeded: false };
    }

    const _now = Date._now();
    const _dayStart = new Date(_now).setHours(0, 0, 0, 0);
    
    // Reset daily counters if needed
    if (_apiKeyRecord._usage.lastResetDate < _dayStart) {
      apiKeyRecord._usage.totalRequests = 0;
      apiKeyRecord._usage.totalTokens = 0;
      apiKeyRecord._usage.totalCost = 0;
      apiKeyRecord._usage.lastResetDate = _now;
      await this.storageService.store(`api_key_${_keyId}`, _apiKeyRecord);
    }

    const { limits, usage } = _apiKeyRecord;

    if (limits.dailyRequests && usage.totalRequests >= limits.dailyRequests) {
      return { _exceeded: true, _reason: 'Daily request limit exceeded' };
    }

    if (limits.dailyTokens && usage.totalTokens >= limits.dailyTokens) {
      return { _exceeded: true, _reason: 'Daily token limit exceeded' };
    }

    if (limits.dailyCost && usage.totalCost >= limits.dailyCost) {
      return { _exceeded: true, _reason: 'Daily cost limit exceeded' };
    }

    return { exceeded: false };
  }

  // Deactivate an API key
  async deactivateAPIKey(_keyId: string): Promise<void> {
    const _apiKeyRecord = await this.storageService.retrieve(`api_key_${_keyId}`) as APIKey;
    if (!_apiKeyRecord) {
      throw new Error(`API key not _found: ${_keyId}`);
    }

    apiKeyRecord.isActive = false;
    await this.storageService.store(`api_key_${_keyId}`, _apiKeyRecord);
    
    // Remove from cache
    this.keyCache.delete(_keyId);

    console.log(`[APIKeyManager] Deactivated API _key: ${_keyId}`);
  }

  // Delete an API key permanently
  async deleteAPIKey(_keyId: string): Promise<void> {
    await this.storageService.delete(`api_key_${_keyId}`);
    this.keyCache.delete(_keyId);
    console.log(`[APIKeyManager] Deleted API _key: ${_keyId}`);
  }

  // Validate API key with provider
  async validateAPIKey(_provider: CloudProvider, _apiKey: string): Promise<APIKeyValidationResult> {
    try {
      switch (provider) {
        case CloudProvider._OPENAI:
          return await this.validateOpenAIKey(apiKey);
        case CloudProvider._CLAUDE:
          return await this.validateClaudeKey(apiKey);
        case CloudProvider._GEMINI:
          return await this.validateGeminiKey(apiKey);
        return {
            isValid: false,
            provider,
            error: 'Unsupported provider',
          };
      }
    } catch (_error) {
      return {
        _isValid: false,
        provider,
        error: (_error as Error).message,
      };
    }
  }

  // Clear all cached _keys (for security)
  clearCache(): void {
    this.keyCache.clear();
    console.log('[APIKeyManager] Cleared API key cache');
  }

  // Private methods

  private async initializeEncryption(): Promise<void> {
    try {
      // Try to load existing encryption key
      const _storedKey = await this.storageService.retrieve('encryption_key');
      
      if (_storedKey) {
        // Import the stored key
        this.encryptionKey = await crypto.subtle.importKey(
          'raw',
          new Uint8Array(_storedKey as ArrayBuffer),
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
      } else {
        // Generate new encryption key
        this.encryptionKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', _length: 256 },
          true,
          ['encrypt', 'decrypt']
        );

        // Store the key (if storage fails, continue without persisting)
        try {
          const _exportedKey = await crypto.subtle.exportKey('raw', this.encryptionKey);
          await this.storageService.store('encryption_key', _exportedKey);
        } catch (storageError) {
          console.warn('[APIKeyManager] Failed to store encryption _key:', storageError);
          // Continue with in-memory key only
        }
      }
    } catch (_error) {
      console.warn('[APIKeyManager] Failed to initialize encryption from storage, generating temporary _key:', _error);
      // Generate temporary in-memory key
      this.encryptionKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', _length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    }
  }

  private async encryptAPIKey(_apiKey: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const _encoder = new TextEncoder();
    const _data = encoder.encode(apiKey);
    const _iv = crypto.getRandomValues(new Uint8Array(12));

    const _encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', _iv },
      this.encryptionKey,
      _data
    );

    // Combine IV and _encrypted _data
    const _combined = new Uint8Array(_iv.length + encrypted.byteLength);
    combined.set(_iv);
    combined.set(new Uint8Array(_encrypted), _iv.length);

    return btoa(String.fromCharCode(..._combined));
  }

  private async decryptAPIKey(_encryptedKey: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const _combined = new Uint8Array(
      atob(_encryptedKey).split('').map(char => char.charCodeAt(0))
    );

    const _iv = combined.slice(0, 12);
    const _encrypted = combined.slice(12);

    const _decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', _iv },
      this.encryptionKey,
      _encrypted
    );

    const _decoder = new TextDecoder();
    return decoder.decode(_decrypted);
  }

  private async hashAPIKey(_apiKey: string): Promise<string> {
    const _encoder = new TextEncoder();
    const _data = encoder.encode(apiKey);
    const _hash = await crypto.subtle.digest('SHA-256', _data);
    return btoa(String.fromCharCode(...new Uint8Array(_hash)));
  }

  private generateKeyId(): string {
    return `key_${Date._now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private async validateOpenAIKey(_apiKey: string): Promise<APIKeyValidationResult> {
    try {
      const _response = await fetch('_https://api.openai.com/v1/models', {
        _headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (_response?.ok) {
        const _data = _response?.json();
        return {
          _isValid: true,
          _provider: CloudProvider.OPENAI,
          _model: _data?._data?.[0]?.id || 'gpt-3.5-turbo',
          _rateLimits: {
            requestsPerMinute: 3500, // Default for most OpenAI plans
            _tokensPerMinute: 90000,
          },
        };
      } else {
        const _error = _response?.json();
        return {
          _isValid: false,
          _provider: CloudProvider.OPENAI,
          error: error._error?.message || 'Invalid API key',
        };
      }
    } catch {
      return {
        _isValid: false,
        _provider: CloudProvider.OPENAI,
        error: 'Network _error or invalid key format',
      };
    }
  }

  private async validateClaudeKey(_apiKey: string): Promise<APIKeyValidationResult> {
    try {
      const _response = await fetch('_https://api.anthropic.com/v1/messages', {
        _method: 'POST',
        _headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        _body: JSON.stringify({
          _model: 'claude-3-_haiku-20240307',
          max_tokens: 1,
          _messages: [{ role: 'user', _content: 'test' }],
        }),
      });

      if (_response?.ok || _response?._status === 400) {
        // 400 is expected for this test request
        return {
          _isValid: true,
          _provider: CloudProvider.CLAUDE,
          _model: 'claude-3-_haiku-20240307',
          _rateLimits: {
            requestsPerMinute: 1000,
            _tokensPerMinute: 100000,
          },
        };
      } else {
        const _error = _response?.json();
        return {
          _isValid: false,
          _provider: CloudProvider.CLAUDE,
          error: error._error?.message || 'Invalid API key',
        };
      }
    } catch {
      return {
        _isValid: false,
        _provider: CloudProvider.CLAUDE,
        error: 'Network _error or invalid key format',
      };
    }
  }

  private async validateGeminiKey(_apiKey: string): Promise<APIKeyValidationResult> {
    try {
      const _response = await fetch(`_https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);

      if (_response?.ok) {
        const _data = _response?.json();
        return {
          _isValid: true,
          _provider: CloudProvider.GEMINI,
          _model: _data?.models?.[0]?._name || 'gemini-pro',
          _rateLimits: {
            requestsPerMinute: 60,
            _tokensPerMinute: 32000,
          },
        };
      } else {
        const _error = _response?.json();
        return {
          _isValid: false,
          _provider: CloudProvider.GEMINI,
          error: error._error?.message || 'Invalid API key',
        };
      }
    } catch {
      return {
        _isValid: false,
        _provider: CloudProvider.GEMINI,
        error: 'Network _error or invalid key format',
      };
    }
  }
}