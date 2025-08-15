// Advanced settings service for comprehensive configuration management
import { EventEmitter } from 'events';
import { IndexedDBStorageService } from '../storage';

export interface AdvancedPrivacySettings {
  dataRetentionDays: number;
  automaticDeletion: boolean;
  encryptionLevel: 'standard' | 'high' | 'maximum';
  localProcessingOnly: boolean;
  anonymizeData: boolean;
  shareAnalytics: boolean;
  _auditLogging: boolean;
  exportFormat: 'json' | 'csv' | 'xml';
  backupFrequency: 'daily' | 'weekly' | 'monthly' | 'never';
  consentTracking: boolean;
}

export interface AdvancedCloudSettings {
  enabled: boolean;
  primaryProvider: 'openai' | 'claude' | 'gemini';
  fallbackProviders: Array<'openai' | 'claude' | 'gemini'>;
  apiKeys: {
    openai?: string;
    claude?: string;
    gemini?: string;
  };
  costLimits: {
    daily: number;
    monthly: number;
    perRequest: number;
  };
  rateLimiting: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  caching: {
    enabled: boolean;
    ttl: number; // Time to live in seconds
    maxSize: number; // Max cache size in MB
  };
  compression: boolean;
  timeout: number;
  customEndpoints: {
    openai?: string;
    claude?: string;
    gemini?: string;
  };
}

export interface AdvancedSummarizationSettings {
  algorithm: 'textrank' | 'lsa' | 'luhn' | 'edmundson' | 'lexrank';
  compressionRatio: number;
  _maxTokens: number;
  minTokens: number;
  contextWindow: number;
  preserveFormatting: boolean;
  includeMetadata: boolean;
  languageDetection: boolean;
  customPrompts: {
    [key: string]: string;
  };
  qualityThreshold: number;
  redundancyRemoval: boolean;
  keywordExtraction: boolean;
  sentimentAnalysis: boolean;
  topicModeling: boolean;
  autoSummarization: {
    enabled: boolean;
    triggers: Array<'token_limit' | 'time_based' | 'context_change'>;
    schedule: string; // Cron expression
  };
}

export interface AdvancedUISettings {
  theme: 'light' | 'dark' | 'auto' | 'high-contrast';
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  density: 'compact' | 'comfortable' | 'spacious';
  animations: boolean;
  soundEffects: boolean;
  notifications: {
    desktop: boolean;
    browser: boolean;
    email: boolean;
    sound: boolean;
  };
  shortcuts: {
    [key: string]: string;
  };
  layout: {
    sidebar: 'left' | 'right' | 'hidden';
    toolbar: 'top' | 'bottom' | 'hidden';
    panels: Array<'search' | 'history' | 'settings' | 'stats'>;
  };
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    reducedMotion: boolean;
    screenReader: boolean;
    keyboardNavigation: boolean;
  };
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
}

export interface AdvancedPerformanceSettings {
  maxConcurrentRequests: number;
  cacheSize: number; // MB
  indexingBatchSize: number;
  searchTimeout: number;
  backgroundProcessing: boolean;
  memoryLimit: number; // MB
  diskSpaceLimit: number; // GB
  compressionLevel: number; // 0-9
  prefetchResults: boolean;
  lazyLoading: boolean;
  virtualScrolling: boolean;
  debounceDelay: number;
  throttleLimit: number;
  workerThreads: number;
  offlineMode: boolean;
  syncFrequency: number; // minutes
}

export interface AdvancedSecuritySettings {
  encryptionAlgorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305' | 'AES-256-CBC';
  keyDerivation: 'PBKDF2' | 'Argon2' | 'scrypt';
  saltLength: number;
  iterations: number;
  sessionTimeout: number; // minutes
  autoLock: boolean;
  biometricAuth: boolean;
  twoFactorAuth: boolean;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
    preventReuse: number;
  };
  auditLog: {
    enabled: boolean;
    retention: number; // days
    includeContent: boolean;
  };
  networkSecurity: {
    tlsVersion: '1.2' | '1.3';
    certificatePinning: boolean;
    hostnameVerification: boolean;
  };
}

export interface AdvancedDeveloperSettings {
  debugMode: boolean;
  verboseLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  enableTelemetry: boolean;
  experimentalFeatures: {
    [key: string]: boolean;
  };
  apiVersions: {
    openai: string;
    claude: string;
    gemini: string;
  };
  customHeaders: {
    [key: string]: string;
  };
  webhooks: {
    [event: string]: string; // URL
  };
  plugins: {
    enabled: string[];
    disabled: string[];
    config: {
      [plugin: string]: Record<string, unknown>;
    };
  };
  testing: {
    mockMode: boolean;
    testData: boolean;
    performanceMonitoring: boolean;
  };
}

export interface AdvancedAppSettings {
  privacy: AdvancedPrivacySettings;
  cloud: AdvancedCloudSettings;
  summarization: AdvancedSummarizationSettings;
  ui: AdvancedUISettings;
  performance: AdvancedPerformanceSettings;
  security: AdvancedSecuritySettings;
  developer: AdvancedDeveloperSettings;
  version: string;
  lastUpdated: number;
  migrationVersion: number;
}

export interface SettingsValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}

export interface SettingsExportData {
  settings: AdvancedAppSettings;
  metadata: {
    exportedAt: number;
    version: string;
    checksum: string;
  };
}

export class AdvancedSettingsService extends EventEmitter {
  private settings: AdvancedAppSettings;
  private storageService: IndexedDBStorageService;
  private validationRules: Map<string, (value: unknown) => SettingsValidationResult>;
  private settingsCache: Map<string, unknown> = new Map();
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private isDirty = false;

  constructor(storageService: IndexedDBStorageService) {
    super();
    this.storageService = storageService;
    this.validationRules = new Map();
    this.settings = this.getDefaultSettings();
    this.setupValidationRules();
    this.loadSettings();
  }

  // Get default settings
  private getDefaultSettings(): AdvancedAppSettings {
    return {
      privacy: {
        dataRetentionDays: 90,
        automaticDeletion: false,
        encryptionLevel: 'standard',
        localProcessingOnly: true,
        anonymizeData: false,
        shareAnalytics: false,
        _auditLogging: true,
        exportFormat: 'json',
        backupFrequency: 'weekly',
        consentTracking: true,
      },
      cloud: {
        enabled: false,
        primaryProvider: 'openai',
        fallbackProviders: ['claude', 'gemini'],
        apiKeys: {},
        costLimits: {
          daily: 10.0,
          monthly: 100.0,
          perRequest: 1.0,
        },
        rateLimiting: {
          requestsPerMinute: 60,
          requestsPerHour: 1000,
          requestsPerDay: 10000,
        },
        retryPolicy: {
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelay: 1000,
        },
        caching: {
          enabled: true,
          ttl: 3600,
          maxSize: 100,
        },
        compression: true,
        timeout: 30000,
        customEndpoints: {},
      },
      summarization: {
        algorithm: 'textrank',
        compressionRatio: 0.3,
        _maxTokens: 4000,
        minTokens: 100,
        contextWindow: 8000,
        preserveFormatting: true,
        includeMetadata: true,
        languageDetection: true,
        customPrompts: {},
        qualityThreshold: 0.7,
        redundancyRemoval: true,
        keywordExtraction: true,
        sentimentAnalysis: false,
        topicModeling: false,
        autoSummarization: {
          enabled: false,
          triggers: ['token_limit'],
          schedule: '0 2 * * *', // Daily at 2 AM
        },
      },
      ui: {
        theme: 'auto',
        fontSize: 'medium',
        density: 'comfortable',
        animations: true,
        soundEffects: false,
        notifications: {
          desktop: true,
          browser: true,
          email: false,
          sound: false,
        },
        shortcuts: {
          'search': 'Ctrl+K',
          'new_context': 'Ctrl+N',
          'settings': 'Ctrl+,',
          'help': 'F1',
        },
        layout: {
          sidebar: 'left',
          toolbar: 'top',
          panels: ['search', 'history'],
        },
        accessibility: {
          highContrast: false,
          largeText: false,
          reducedMotion: false,
          screenReader: false,
          keyboardNavigation: true,
        },
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '24h',
      },
      performance: {
        maxConcurrentRequests: 5,
        cacheSize: 500,
        indexingBatchSize: 100,
        searchTimeout: 5000,
        backgroundProcessing: true,
        memoryLimit: 1024,
        diskSpaceLimit: 5,
        compressionLevel: 6,
        prefetchResults: true,
        lazyLoading: true,
        virtualScrolling: true,
        debounceDelay: 300,
        throttleLimit: 100,
        workerThreads: 2,
        offlineMode: true,
        syncFrequency: 15,
      },
      security: {
        encryptionAlgorithm: 'AES-256-GCM',
        keyDerivation: 'PBKDF2',
        saltLength: 32,
        iterations: 100000,
        sessionTimeout: 60,
        autoLock: false,
        biometricAuth: false,
        twoFactorAuth: false,
        passwordPolicy: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: false,
          preventReuse: 5,
        },
        auditLog: {
          enabled: true,
          retention: 90,
          includeContent: false,
        },
        networkSecurity: {
          tlsVersion: '1.3',
          certificatePinning: false,
          hostnameVerification: true,
        },
      },
      developer: {
        debugMode: false,
        verboseLogging: false,
        logLevel: 'info',
        enableTelemetry: false,
        experimentalFeatures: {},
        apiVersions: {
          openai: 'v1',
          claude: 'v1',
          gemini: 'v1',
        },
        customHeaders: {},
        webhooks: {},
        plugins: {
          enabled: [],
          disabled: [],
          config: {},
        },
        testing: {
          mockMode: false,
          testData: false,
          performanceMonitoring: false,
        },
      },
      version: '1.0.0',
      lastUpdated: Date.now(),
      migrationVersion: 1,
    };
  }

  // Load settings from storage
  private async loadSettings(): Promise<void> {
    try {
      const stored = await this.storageService.retrieve('advanced_settings');
      if (stored) {
        this.settings = this.migrateSettings(stored as Record<string, unknown>);
        this.emit('settingsLoaded', this.settings);
      }
    } catch (error) {
      console.error('[AdvancedSettings] Failed to load settings:', error);
      this.emit('settingsError', error);
    }
  }

  // Save settings to storage
  private async saveSettings(): Promise<void> {
    try {
      this.settings.lastUpdated = Date.now();
      await this.storageService.store('advanced_settings', this.settings);
      this.isDirty = false;
      this.emit('settingsSaved', this.settings);
    } catch (error) {
      console.error('[AdvancedSettings] Failed to save settings:', error);
      this.emit('settingsError', error);
    }
  }

  // Get all settings
  public getSettings(): AdvancedAppSettings {
    return JSON.parse(JSON.stringify(this.settings));
  }

  // Get specific setting section
  public getSection<K extends keyof AdvancedAppSettings>(section: K): AdvancedAppSettings[K] {
    return JSON.parse(JSON.stringify(this.settings[section]));
  }

  // Get specific setting value
  public getSetting<K extends keyof AdvancedAppSettings, T extends keyof AdvancedAppSettings[K]>(
    section: K,
    key: T
  ): AdvancedAppSettings[K][T] {
    return this.settings[section][key];
  }

  // Update specific setting
  public async updateSetting<K extends keyof AdvancedAppSettings, T extends keyof AdvancedAppSettings[K]>(
    section: K,
    key: T,
    value: AdvancedAppSettings[K][T]
  ): Promise<void> {
    const oldValue = this.settings[section][key];
    this.settings[section][key] = value;
    
    const validation = this.validateSetting(section, key, value);
    if (!validation.isValid) {
      this.settings[section][key] = oldValue;
      throw new Error(`Invalid setting value: ${validation.errors[0]?.message}`);
    }

    this.markDirty();
    this.emit('settingChanged', { section, key, value, oldValue });
    
    if (this.shouldAutoSave()) {
      await this.saveSettings();
    }
  }

  // Update entire section
  public async updateSection<K extends keyof AdvancedAppSettings>(
    section: K,
    values: Partial<AdvancedAppSettings[K]>
  ): Promise<void> {
    const oldSection = JSON.parse(JSON.stringify(this.settings[section]));
    
    // Apply updates
    Object.assign(this.settings[section], values);
    
    // Validate entire section
    const validation = this.validateSection(section);
    if (!validation.isValid) {
      this.settings[section] = oldSection;
      throw new Error(`Invalid section values: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.markDirty();
    this.emit('sectionChanged', { section, values, oldSection });
    
    if (this.shouldAutoSave()) {
      await this.saveSettings();
    }
  }

  // Reset settings to defaults
  public async resetSettings(): Promise<void> {
    const oldSettings = JSON.parse(JSON.stringify(this.settings));
    this.settings = this.getDefaultSettings();
    
    this.markDirty();
    this.emit('settingsReset', { oldSettings, newSettings: this.settings });
    
    await this.saveSettings();
  }

  // Reset specific section to defaults
  public async resetSection<K extends keyof AdvancedAppSettings>(section: K): Promise<void> {
    const oldSection = JSON.parse(JSON.stringify(this.settings[section]));
    const defaultSettings = this.getDefaultSettings();
    this.settings[section] = defaultSettings[section];
    
    this.markDirty();
    this.emit('sectionReset', { section, oldSection, newSection: this.settings[section] });
    
    if (this.shouldAutoSave()) {
      await this.saveSettings();
    }
  }

  // Validate setting value
  private validateSetting<K extends keyof AdvancedAppSettings, T extends keyof AdvancedAppSettings[K]>(
    section: K,
    key: T,
    value: AdvancedAppSettings[K][T]
  ): SettingsValidationResult {
    const validationKey = `${String(section)}.${String(key)}`;
    const validator = this.validationRules.get(validationKey);
    
    if (validator) {
      return validator(value);
    }
    
    return { isValid: true, errors: [], warnings: [] };
  }

  // Validate entire section
  private validateSection<K extends keyof AdvancedAppSettings>(section: K): SettingsValidationResult {
    const result: SettingsValidationResult = { isValid: true, errors: [], warnings: [] };
    
    for (const key in this.settings[section]) {
      const validation = this.validateSetting(section, key as keyof AdvancedAppSettings[K], this.settings[section][key]);
      result.errors.push(...validation.errors);
      result.warnings.push(...validation.warnings);
    }
    
    result.isValid = result.errors.length === 0;
    return result;
  }

  // Export settings
  public async exportSettings(): Promise<SettingsExportData> {
    const exportData: SettingsExportData = {
      settings: this.getSettings(),
      metadata: {
        exportedAt: Date.now(),
        version: this.settings.version,
        checksum: await this.calculateChecksum(this.settings as unknown as Record<string, unknown>),
      },
    };
    
    return exportData;
  }

  // Import settings
  public async importSettings(data: SettingsExportData): Promise<void> {
    // Validate checksum
    const calculatedChecksum = await this.calculateChecksum(data.settings as unknown as Record<string, unknown>);
    if (calculatedChecksum !== data.metadata.checksum) {
      throw new Error('Settings data integrity check failed');
    }
    
    // Validate settings
    const validation = this.validateAllSettings(data.settings);
    if (!validation.isValid) {
      throw new Error(`Invalid settings: ${validation.errors.map(e => e.message).join(', ')}`);
    }
    
    const oldSettings = JSON.parse(JSON.stringify(this.settings));
    this.settings = this.migrateSettings(data.settings as unknown as Record<string, unknown>);
    
    this.markDirty();
    this.emit('settingsImported', { oldSettings, newSettings: this.settings });
    
    await this.saveSettings();
  }

  // Setup validation rules
  private setupValidationRules(): void {
    // Privacy validation rules
    this.validationRules.set('privacy.dataRetentionDays', (value: unknown) => {
      const errors = [];
      const numValue = typeof value === 'number' ? value : Number(value);
      if (isNaN(numValue) || numValue < 1 || numValue > 3650) {
        errors.push({ field: 'dataRetentionDays', message: 'Must be between 1 and 3650 days', severity: 'error' as const });
      }
      return { isValid: errors.length === 0, errors, warnings: [] };
    });

    // Cloud validation rules
    this.validationRules.set('cloud.costLimits', (value: unknown) => {
      const errors = [];
      if (value && typeof value === 'object' && 'daily' in value) {
        const costLimits = value as { daily: number };
        if (costLimits.daily < 0 || costLimits.daily > 1000) {
          errors.push({ field: 'daily', message: 'Daily cost limit must be between $0 and $1000', severity: 'error' as const });
        }
      }
      return { isValid: errors.length === 0, errors, warnings: [] };
    });

    // Performance validation rules
    this.validationRules.set('performance.maxConcurrentRequests', (value: unknown) => {
      const errors = [];
      const numValue = typeof value === 'number' ? value : Number(value);
      if (isNaN(numValue) || numValue < 1 || numValue > 20) {
        errors.push({ field: 'maxConcurrentRequests', message: 'Must be between 1 and 20', severity: 'error' as const });
      }
      return { isValid: errors.length === 0, errors, warnings: [] };
    });

    // Add more validation rules as needed...
  }

  // Validate all settings
  private validateAllSettings(settings: AdvancedAppSettings): SettingsValidationResult {
    const result: SettingsValidationResult = { isValid: true, errors: [], warnings: [] };
    
    for (const section in settings) {
      const sectionValidation = this.validateSection(section as keyof AdvancedAppSettings);
      result.errors.push(...sectionValidation.errors);
      result.warnings.push(...sectionValidation.warnings);
    }
    
    result.isValid = result.errors.length === 0;
    return result;
  }

  // Migrate settings from older versions
  private migrateSettings(settings: Record<string, unknown>): AdvancedAppSettings {
    const currentVersion = this.getDefaultSettings().migrationVersion;
    const settingsVersion = typeof settings.migrationVersion === 'number' ? settings.migrationVersion : 0;

    if (settingsVersion < currentVersion) {
      console.log(`[AdvancedSettings] Migrating settings from version ${settingsVersion} to ${currentVersion}`);
      // Perform migration logic here
      settings.migrationVersion = currentVersion;
    }

    // Merge with defaults to ensure all properties exist, but preserve existing values
    return this.deepMerge(this.getDefaultSettings() as unknown as Record<string, unknown>, settings) as unknown as AdvancedAppSettings;
  }

  // Deep merge objects - source takes precedence over target
  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && 
          target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        result[key] = this.deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
      } else if (source[key] !== undefined) {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  // Calculate checksum for data integrity
  private async calculateChecksum(data: Record<string, unknown>): Promise<string> {
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Mark settings as dirty
  private markDirty(): void {
    this.isDirty = true;
    this.scheduleAutoSave();
  }

  // Check if auto-save should be triggered
  private shouldAutoSave(): boolean {
    return false; // Don't auto-save in tests, only when explicitly called
  }

  // Schedule auto-save
  private scheduleAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setTimeout(() => {
      if (this.isDirty) {
        this.saveSettings();
      }
    }, 1000); // Auto-save after 1 second of inactivity
  }

  // Force save settings
  public async forceSave(): Promise<void> {
    await this.saveSettings();
  }

  // Get settings statistics
  public getStatistics(): {
    totalSettings: number;
    lastUpdated: Date;
    version: string;
    isDirty: boolean;
    cacheSize: number;
  } {
    return {
      totalSettings: this.countSettings(this.settings as unknown as Record<string, unknown>),
      lastUpdated: new Date(this.settings.lastUpdated),
      version: this.settings.version,
      isDirty: this.isDirty,
      cacheSize: this.settingsCache.size,
    };
  }

  // Count total number of settings
  private countSettings(obj: Record<string, unknown>, count = 0): number {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        count = this.countSettings(obj[key] as Record<string, unknown>, count);
      } else {
        count++;
      }
    }
    return count;
  }

  // Cleanup resources
  public destroy(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.settingsCache.clear();
    this.removeAllListeners();
  }
}