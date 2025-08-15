// Consent Management System for Privacy Controls
import { EventBus } from '../background/eventBus';
import { BackgroundEventType } from '../background/types';

export interface ConsentRequest {
  id: string;
  type: ConsentType;
  title: string;
  description: string;
  details: string[];
  dataTypes: string[];
  purposes: string[];
  retention?: string;
  thirdParties?: string[];
  required: boolean;
  timestamp: number;
}

export interface ConsentResponse {
  requestId: string;
  granted: boolean;
  timestamp: number;
  conditions?: ConsentConditions;
  expiresAt?: number;
}

export interface ConsentConditions {
  dataMinimization?: boolean;
  purposeLimitation?: boolean;
  retentionLimit?: number; // days
  revocable?: boolean;
}

export enum ConsentType {
  CLOUD_PROCESSING = 'cloud_processing',
  DATA_EXPORT = 'data_export',
  ANALYTICS = 'analytics',
  THIRD_PARTY_INTEGRATION = 'third_party_integration',
  CROSS_DEVICE_SYNC = 'cross_device_sync',
  PERFORMANCE_MONITORING = 'performance_monitoring',
}

export interface ConsentRecord {
  id: string;
  type: ConsentType;
  granted: boolean;
  timestamp: number;
  expiresAt?: number;
  conditions: ConsentConditions;
  revokedAt?: number;
  version: string; // Privacy policy version
}

export class ConsentManager {
  private eventBus: EventBus;
  private consentRecords: Map<string, ConsentRecord> = new Map();
  private pendingRequests: Map<string, ConsentRequest> = new Map();
  private consentVersion = '1.0.0';

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    void this.loadConsentRecords();
  }

  // Request consent for a specific operation
  async requestConsent(request: Omit<ConsentRequest, 'id' | 'timestamp'>): Promise<ConsentResponse> {
    const consentRequest: ConsentRequest = {
      ...request,
      id: this.generateRequestId(),
      timestamp: Date.now(),
    };

    // Check if we already have valid consent
    const existingConsent = this.getValidConsent(request.type);
    if (existingConsent && existingConsent.granted) {
      return {
        requestId: consentRequest.id,
        granted: true,
        timestamp: existingConsent.timestamp,
        conditions: existingConsent.conditions,
        expiresAt: existingConsent.expiresAt,
      };
    }

    // Store pending request
    this.pendingRequests.set(consentRequest.id, consentRequest);

    // Emit consent required event
    this.eventBus.emit({
      _type: BackgroundEventType.CONSENT_REQUIRED,
      payload: {
        request: consentRequest,
      },
      priority: 3, // CRITICAL priority
    });

    // Show consent dialog to user
    return this.showConsentDialog(consentRequest);
  }

  // Process user's consent response
  async processConsentResponse(response: ConsentResponse): Promise<void> {
    const request = this.pendingRequests.get(response.requestId);
    if (!request) {
      throw new Error(`Consent request ${response.requestId} not found`);
    }

    // Create consent record
    const consentRecord: ConsentRecord = {
      id: this.generateConsentId(),
      type: request.type,
      granted: response.granted,
      timestamp: response.timestamp,
      expiresAt: response.expiresAt,
      conditions: response.conditions || this.getDefaultConditions(request.type),
      version: this.consentVersion,
    };

    // Store consent record
    this.consentRecords.set(this.getConsentKey(request.type), consentRecord);
    await this.saveConsentRecords();

    // Remove pending request
    this.pendingRequests.delete(response.requestId);

    // Emit consent processed event
    this.eventBus.emit({
      _type: BackgroundEventType.PRIVACY_AUDIT,
      payload: {
        action: 'consent_processed',
        dataType: 'consent',
        success: true,
        details: {
          type: request.type,
          granted: response.granted,
          conditions: consentRecord.conditions,
        },
      },
    });

    console.log(`[ConsentManager] Consent ${response.granted ? 'granted' : 'denied'} for ${request.type}`);
  }

  // Check if we have valid consent for an operation
  hasValidConsent(type: ConsentType): boolean {
    const consent = this.getValidConsent(type);
    return consent ? consent.granted : false;
  }

  // Get consent record for a specific type
  getValidConsent(type: ConsentType): ConsentRecord | null {
    const consent = this.consentRecords.get(this.getConsentKey(type));
    
    if (!consent) {
      return null;
    }

    // Check if consent is revoked
    if (consent.revokedAt) {
      return null;
    }

    // Check if consent is expired
    if (consent.expiresAt && Date.now() > consent.expiresAt) {
      return null;
    }

    return consent;
  }

  // Revoke consent for a specific type
  async revokeConsent(type: ConsentType): Promise<void> {
    const consentKey = this.getConsentKey(type);
    const consent = this.consentRecords.get(consentKey);
    
    if (consent && consent.granted && !consent.revokedAt) {
      consent.revokedAt = Date.now();
      await this.saveConsentRecords();

      // Emit consent revoked event
      this.eventBus.emit({
        _type: BackgroundEventType.PRIVACY_AUDIT,
        payload: {
          action: 'consent_revoked',
          dataType: 'consent',
          success: true,
          details: {
            type,
            revokedAt: consent.revokedAt,
          },
        },
      });

      console.log(`[ConsentManager] Consent revoked for ${type}`);
    }
  }

  // Get all consent records
  getAllConsents(): ConsentRecord[] {
    return Array.from(this.consentRecords.values());
  }

  // Clear all consent records (for privacy reset)
  async clearAllConsents(): Promise<void> {
    this.consentRecords.clear();
    await this.saveConsentRecords();

    this.eventBus.emit({
      _type: BackgroundEventType.PRIVACY_AUDIT,
      payload: {
        action: 'all_consents_cleared',
        dataType: 'consent',
        success: true,
        details: {
          timestamp: Date.now(),
        },
      },
    });

    console.log('[ConsentManager] All consents cleared');
  }

  // Show consent dialog to user
  private async showConsentDialog(request: ConsentRequest): Promise<ConsentResponse> {
    return new Promise((resolve) => {
      // Create consent dialog
      const dialogData = {
        request,
        onResponse: (response: ConsentResponse) => {
          this.processConsentResponse(response);
          resolve(response);
        },
      };

      // Send message to show consent dialog
      chrome.runtime.sendMessage({
        __type: 'SHOW_CONSENT_DIALOG',
        data: dialogData,
      });
    });
  }

  // Get default conditions for consent type
  private getDefaultConditions(type: ConsentType): ConsentConditions {
    const baseConditions: ConsentConditions = {
      dataMinimization: true,
      purposeLimitation: true,
      revocable: true,
    };

    switch (type) {
      case ConsentType.CLOUD_PROCESSING:
        return {
          ...baseConditions,
          retentionLimit: 30, // 30 days
        };
      case ConsentType.DATA_EXPORT:
        return {
          ...baseConditions,
          retentionLimit: 0, // No retention for exports
        };
      case ConsentType.ANALYTICS:
        return {
          ...baseConditions,
          retentionLimit: 90, // 90 days
        };
      case ConsentType.PERFORMANCE_MONITORING:
        return {
          ...baseConditions,
          retentionLimit: 7, // 7 days
        };
      default:
        return baseConditions;
    }
  }

  // Generate unique request ID
  private generateRequestId(): string {
    return `consent_req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Generate unique consent ID
  private generateConsentId(): string {
    return `consent_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Get storage key for consent type
  private getConsentKey(type: ConsentType): string {
    return `consent_${type}`;
  }

  // Load consent records from storage
  private async loadConsentRecords(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(['consent_records']);
      if (stored.consent_records) {
        const records = stored.consent_records as Record<string, ConsentRecord>;
        this.consentRecords = new Map(Object.entries(records));
        console.log(`[ConsentManager] Loaded ${this.consentRecords.size} consent records`);
      }
    } catch (error) {
      console.error('[ConsentManager] Failed to load consent records:', error);
    }
  }

  // Save consent records to storage
  private async saveConsentRecords(): Promise<void> {
    try {
      const records = Object.fromEntries(this.consentRecords);
      await chrome.storage.local.set({ consent_records: records });
    } catch (error) {
      console.error('[ConsentManager] Failed to save consent records:', error);
    }
  }
}