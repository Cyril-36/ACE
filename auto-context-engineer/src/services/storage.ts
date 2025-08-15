// Storage service interface and implementation
import { Context, Summary, UserPreferences, StorageStats } from "../types";
import { WebCryptoEncryptionService } from "./encryption";

export interface StorageService {
  // Core operations
  store(key: string, data: unknown): Promise<void>;
  retrieve(key: string): Promise<unknown>;
  delete(key: string): Promise<void>;
  getByPrefix(prefix: string): Promise<Array<{ key: string; value: unknown }>>;

  // Context operations
  storeContext(context: Context): Promise<void>;
  getContext(id: string): Promise<Context | null>;
  getAllContexts(): Promise<Context[]>;

  // Summary operations
  storeSummary(summary: Summary): Promise<void>;
  getSummary(id: string): Promise<Summary | null>;
  getAllSummaries(): Promise<Summary[]>;

  // Preferences
  storePreferences(preferences: UserPreferences): Promise<void>;
  getPreferences(): Promise<UserPreferences | null>;

  // Maintenance
  cleanup(criteria: unknown): Promise<void>;
  getUsageStats(): Promise<StorageStats>;
}

export class IndexedDBStorageService implements StorageService {
  private dbName = 'AutoContextEngineerDB';
  private dbVersion = 1;
  private encryptionService: WebCryptoEncryptionService;
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private operationQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;

  // Connection pooling and caching
  private static instance: IndexedDBStorageService | null = null;
  // private connectionPool: IDBDatabase[] = []; // For future connection pooling
  // private readonly MAX_CONNECTIONS = 3; // For future connection pooling

  constructor() {
    this.encryptionService = new WebCryptoEncryptionService();
  }

  // Singleton pattern for better resource management
  static getInstance(): IndexedDBStorageService {
    if (!IndexedDBStorageService.instance) {
      IndexedDBStorageService.instance = new IndexedDBStorageService();
    }
    return IndexedDBStorageService.instance;
  }

  // Optimized database initialization with connection pooling
  private async initDB(): Promise<IDBDatabase> {
    if (this.db && this.db.objectStoreNames.length > 0) {
      return this.db;
    }

    // Reuse existing promise if initialization is in progress
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        this.dbPromise = null;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores with optimized indexes
        if (!db.objectStoreNames.contains('contexts')) {
          const contextStore = db.createObjectStore('contexts', { keyPath: 'id' });
          contextStore.createIndex('timestamp', 'timestamp', { unique: false });
          contextStore.createIndex('source', 'source', { unique: false });
          contextStore.createIndex('composite', ['source', 'timestamp'], { unique: false });
        }

        if (!db.objectStoreNames.contains('summaries')) {
          const summaryStore = db.createObjectStore('summaries', { keyPath: 'id' });
          summaryStore.createIndex('timestamp', 'timestamp', { unique: false });
          summaryStore.createIndex('contextId', 'contextId', { unique: false });
        }

        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('general')) {
          const generalStore = db.createObjectStore('general');
          generalStore.createIndex('type', 'type', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  async store(key: string, data: unknown): Promise<void> {
    return this.queueOperation(async () => {
      const db = await this.initDB();
      const encryptedData = await this.encryptionService.encrypt(data);
      
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(['general'], 'readwrite');
        const store = transaction.objectStore('general');
        const request = store.put(encryptedData, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    });
  }

  // Batch store operation for better performance
  async storeBatch(items: Array<{ key: string; data: unknown }>): Promise<void> {
    return this.queueOperation(async () => {
      const db = await this.initDB();

      // Encrypt all items first
      const encryptedItems = await Promise.all(
        items.map(async (item) => ({
          key: item.key,
          data: await this.encryptionService.encrypt(item.data)
        }))
      );

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(['general'], 'readwrite');
        const store = transaction.objectStore('general');
        let completed = 0;
        let hasError = false;

        for (const item of encryptedItems) {
          try {
            const request = store.put(item.data, item.key);

            request.onsuccess = () => {
              completed++;
              if (completed === encryptedItems.length && !hasError) {
                resolve();
              }
            };

            request.onerror = () => {
              if (!hasError) {
                hasError = true;
                reject(request.error);
              }
            };
          } catch (error) {
            if (!hasError) {
              hasError = true;
              reject(error);
            }
            break;
          }
        }
      });
    });
  }

  // Operation queue for better concurrency control
  private async queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.operationQueue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      void this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    
    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error('Storage operation failed:', error);
        }
      }
    }
    
    this.isProcessingQueue = false;
  }

  async retrieve(key: string): Promise<unknown> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['general'], 'readonly');
      const store = transaction.objectStore('general');
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        if (request.result) {
          try {
            const decryptedData = await this.encryptionService.decrypt(request.result);
            resolve(decryptedData);
          } catch (error) {
            reject(error);
          }
        } else {
          resolve(null);
        }
      };
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['general'], 'readwrite');
      const store = transaction.objectStore('general');
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getByPrefix(prefix: string): Promise<Array<{ key: string; value: unknown }>> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['general'], 'readonly');
      const store = transaction.objectStore('general');
      const request = store.openCursor();
      const results: Array<{ key: string; value: unknown }> = [];

      request.onerror = () => reject(request.error);
      request.onsuccess = async (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const key = cursor.key as string;
          if (key.startsWith(prefix)) {
            try {
              const decryptedValue = await this.encryptionService.decrypt(cursor.value);
              results.push({ key, value: decryptedValue });
            } catch (error) {
              console.warn(`Failed to decrypt value for key ${key}:`, error);
            }
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    });
  }

  async storeContext(context: Context): Promise<void> {
    const db = await this.initDB();
    const encryptedContext = await this.encryptionService.encrypt(context);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contexts'], 'readwrite');
      const store = transaction.objectStore('contexts');
      const request = store.put({ 
        id: context.id, 
        data: encryptedContext, 
        timestamp: context.timestamp, 
        source: context.source 
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getContext(id: string): Promise<Context | null> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contexts'], 'readonly');
      const store = transaction.objectStore('contexts');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        if (request.result) {
          try {
            const decryptedContext = await this.encryptionService.decrypt(request.result.data) as Context;
            resolve(decryptedContext);
          } catch (error) {
            reject(error);
          }
        } else {
          resolve(null);
        }
      };
    });
  }

  async getAllContexts(): Promise<Context[]> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contexts'], 'readonly');
      const store = transaction.objectStore('contexts');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        try {
          const contexts: Context[] = [];
          for (const item of request.result) {
            const decryptedContext = await this.encryptionService.decrypt(item.data) as Context;
            contexts.push(decryptedContext);
          }
          resolve(contexts);
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  async storeSummary(summary: Summary): Promise<void> {
    const db = await this.initDB();
    const encryptedSummary = await this.encryptionService.encrypt(summary);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['summaries'], 'readwrite');
      const store = transaction.objectStore('summaries');
      const request = store.put({ 
        id: summary.id, 
        data: encryptedSummary, 
        timestamp: summary.timestamp 
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getSummary(id: string): Promise<Summary | null> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['summaries'], 'readonly');
      const store = transaction.objectStore('summaries');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        if (request.result) {
          try {
            const decryptedSummary = await this.encryptionService.decrypt(request.result.data) as Summary;
            resolve(decryptedSummary);
          } catch (error) {
            reject(error);
          }
        } else {
          resolve(null);
        }
      };
    });
  }

  async getAllSummaries(): Promise<Summary[]> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['summaries'], 'readonly');
      const store = transaction.objectStore('summaries');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        try {
          const summaries: Summary[] = [];
          for (const item of request.result) {
            const decryptedSummary = await this.encryptionService.decrypt(item.data) as Summary;
            summaries.push(decryptedSummary);
          }
          resolve(summaries);
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  async storePreferences(preferences: UserPreferences): Promise<void> {
    const db = await this.initDB();
    const encryptedPreferences = await this.encryptionService.encrypt(preferences);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['preferences'], 'readwrite');
      const store = transaction.objectStore('preferences');
      const request = store.put({ id: 'user_preferences', data: encryptedPreferences });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getPreferences(): Promise<UserPreferences | null> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['preferences'], 'readonly');
      const store = transaction.objectStore('preferences');
      const request = store.get('user_preferences');

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        if (request.result) {
          try {
            const decryptedPreferences = await this.encryptionService.decrypt(request.result.data) as UserPreferences;
            resolve(decryptedPreferences);
          } catch (error) {
            reject(error);
          }
        } else {
          resolve(null);
        }
      };
    });
  }

  async cleanup(criteria: unknown): Promise<void> {
    // Implementation for cleanup based on criteria
    const db = await this.initDB();
    
    // Use criteria if provided, otherwise default to 30 days
    const cleanupCriteria = criteria as { maxAge?: number } || {};
    const cutoffDate = Date.now() - (cleanupCriteria.maxAge || 30 * 24 * 60 * 60 * 1000);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contexts'], 'readwrite');
      const store = transaction.objectStore('contexts');
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoffDate);
      const request = index.openCursor(range);

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  async getUsageStats(): Promise<StorageStats> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contexts', 'summaries'], 'readonly');
      let contextCount = 0;
      let summaryCount = 0;
      let totalSize = 0;

      // Count contexts
      const contextStore = transaction.objectStore('contexts');
      const contextRequest = contextStore.count();
      
      contextRequest.onsuccess = () => {
        contextCount = contextRequest.result;
      };

      // Count summaries
      const summaryStore = transaction.objectStore('summaries');
      const summaryRequest = summaryStore.count();
      
      summaryRequest.onsuccess = () => {
        summaryCount = summaryRequest.result;
      };

      transaction.oncomplete = () => {
        // Estimate storage usage (rough calculation)
        totalSize = (contextCount + summaryCount) * 1024; // Rough estimate
        
        resolve({
          totalSize: 100 * 1024 * 1024, // 100MB total quota
          usedSize: totalSize,
          availableSize: 100 * 1024 * 1024 - totalSize,
          itemCount: contextCount + summaryCount,
          lastCleanup: new Date(),
          quotaUsed: totalSize,
          quotaAvailable: 100 * 1024 * 1024 - totalSize,
        });
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }
}
