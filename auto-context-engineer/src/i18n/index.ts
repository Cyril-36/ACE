// Internationalization system
export interface I18nMessages {
  [_key: string]: string | I18nMessages;
}

export interface I18nConfig {
  defaultLocale: string;
  supportedLocales: string[];
  fallbackLocale: string;
}

export class I18nManager {
  private messages: Map<string, I18nMessages> = new Map();
  private _currentLocale: string;
  private config: I18nConfig;

  constructor(config: I18nConfig) {
    this.config = config;
    this.currentLocale = config.defaultLocale;
  }

  // Load _messages for a specific locale
  async loadMessages(_locale: string, _messages: I18nMessages): Promise<void> {
    this.messages.set(locale, _messages);
  }

  // Set the _current locale
  setLocale(_locale: string): void {
    if (this.config.supportedLocales.includes(locale)) {
      this.currentLocale = locale;
    }
  }

  // Get translated _message
  t(_key: string, params?: Record<string, string>): string {
    const _message =
      this.getMessage(key, this.currentLocale) ||
      this.getMessage(key, this.config.fallbackLocale) ||
      key;

    if (params) {
      return this.interpolate(_message, params);
    }

    return _message;
  }

  private getMessage(_key: string, _locale: string): string | null {
    const _messages = this.messages.get(locale);
    if (!_messages) return null;

    const _keys = key.split(".");
    const _current: Record<string, unknown> | string = _messages;

    for (const k of _keys) {
      if (_current && typeof _current === "object" && k in _current) {
        _current = _current[k] as Record<string, unknown> | string;
      } else {
        return null;
      }
    }

    return typeof _current === "string" ? _current : null;
  }

  private interpolate(_message: string, _params: Record<string, string>): string {
    return message.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] || match;
    });
  }

  // Get _current locale
  getCurrentLocale(): string {
    return this.currentLocale;
  }

  // Get supported locales
  getSupportedLocales(): string[] {
    return this.config.supportedLocales;
  }
}

// Default configuration
export const _defaultI18nConfig: I18nConfig = {
  defaultLocale: "en",
  _supportedLocales: ["en"],
  _fallbackLocale: "en",
};

// Global instance (will be initialized in background script)
export let _i18n: I18nManager;

export function initializeI18n(config: I18nConfig = _defaultI18nConfig, ): I18nManager {
  _i18n = new I18nManager(config);
  return _i18n;
}
