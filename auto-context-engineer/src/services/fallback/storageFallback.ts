// Storage fallback mechanisms for when primary storage fails
import { globalErrorHandler } from '../error/errorHandler';

export interface StorageAdapter {
  name: string;
  available: boolean;
  priority: number;
  store(key: string, data: unknown): Promise<void>;
  retrieve(key: string): Promise<unknown>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

export class MemoryStorageAdapter implements StorageAdapter {
  name = 'Memory Storage';
  available = true;
  priority = 3; // Lowest priority - temporary only
  private storage = new Map<string, unknown>();

  async store(key: string, data: unknown): Promise<void> {
    this.storage.set(key, data);
    await Promise.resolve(); // Maintain async interface
  }

  async retrieve(key: string): Promise<unknown> {
    return await Promise.resolve(this.storage.get(key));
  }

  async remove(key: string): Promise<void> {
    this.storage.delete(key);
    await Promise.resolve();
  }

  async clear(): Promise<void> {
    this.storage.clear();
    await Promise.resolve();
  }

  async size(): Promise<number> {
    return await Promise.resolve(this.storage.size);
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  name = 'Local Storage';
  available = typeof localStorage !== 'undefined';
  priority = 2;

  async store(key: string, data: unknown): Promise<void> {
    if (!this.available) throw new Error('LocalStorage not available');
    
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Try to free up space by removing old items
        await this.cleanup();
        localStorage.setItem(key, JSON.stringify(data));
      } else {
        throw error;
      }
    }
  }

  async retrieve(key: string): Promise<unknown> {
    if (!this.available) throw new Error('LocalStorage not available');
    
    const item = localStorage.getItem(key);
    return await Promise.resolve(item ? JSON.parse(item) : undefined);
  }

  async remove(key: string): Promise<void> {
    if (!this.available) throw new Error('LocalStorage not available');
    localStorage.removeItem(key);
    await Promise.resolve();
  }

  async clear(): Promise<void> {
    if (!this.available) throw new Error('LocalStorage not available');
    localStorage.clear();
    await Promise.resolve();
  }

  async size(): Promise<number> {
    if (!this.available) return 0;
    return await Promise.resolve(localStorage.length);
  }

  private cleanup(): void {
    // Remove oldest items (simple strategy - could be improved)
    const keys = Object.keys(localStorage);
    const itemsToRemove = Math.ceil(keys.length * 0.1); // Remove 10% of items
    
    for (let i = 0; i < itemsToRemove && i < keys.length; i++) {
      localStorage.removeItem(keys[i]);
    }
  }
}

export class IndexedDBAdapter implements StorageAdapter {
  name = 'IndexedDB';
  available = typeof indexedDB !== 'undefined';
  priority = 1; // Highest priority
  private db?: IDBDatabase;
  private dbName = 'AutoContextEngineer';
  private version = 1;

  async store(key: string, data: unknown): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contexts'], 'readwrite');
      const store = transaction.objectStore('contexts');
      const request = store.put({ key, data, timestamp: Date.now() });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(request.error?.message || 'Storage operation failed'));
    });
  }

  async retrieve(key: string): Promise<unknown> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contexts'], 'readonly');
      const store = transaction.objectStore('contexts');
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : undefined);
      };
      request.onerror = () => reject(new Error(request.error?.message || 'Retrieve operation failed'));
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contexts'], 'readwrite');
      const store = transaction.objectStore('contexts');
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contexts'], 'readwrite');
      const store = transaction.objectStore('contexts');
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async size(): Promise<number> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contexts'], 'readonly');
      const store = transaction.objectStore('contexts');
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('contexts')) {
          const store = db.createObjectStore('contexts', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }
}

export class StorageFallbackService {
  private adapters: StorageAdapter[] = [];
  private currentAdapter?: StorageAdapter;

  constructor() {
    this.initializeAdapters();
  }

  /**
   * Store data with automatic fallback
   */
  async store(key: string, data: unknown): Promise<void> {
    const adapter = await this.getWorkingAdapter();
    
    try {
      await adapter.store(key, data);
    } catch (error) {
      // Mark current adapter as failed and try next one
      this.currentAdapter = undefined;
      
      await globalErrorHandler.handleError(error as Error, {
        component: 'StorageFallbackService',
        operation: 'store',
        metadata: { key, adapterName: adapter.name },
      });
      
      // Retry with next adapter
      const nextAdapter = await this.getWorkingAdapter();
      if (nextAdapter !== adapter) {
        await nextAdapter.store(key, data);
      } else {
        throw error;
      }
    }
  }

  /**
   * Retrieve data with automatic fallback
   */
  async retrieve(key: string): Promise<unknown> {
    const adapter = await this.getWorkingAdapter();
    
    try {
      return await adapter.retrieve(key);
    } catch (error) {
      // Try other adapters in case data was stored elsewhere
      for (const fallbackAdapter of this.getAvailableAdapters()) {
        if (fallbackAdapter === adapter) continue;
        
        try {
          const data = await fallbackAdapter.retrieve(key);
          if (data !== undefined) {
            return data;
          }
        } catch {
          // Continue to next adapter
        }
      }
      
      await globalErrorHandler.handleError(error as Error, {
        component: 'StorageFallbackService',
        operation: 'retrieve',
        metadata: { key, adapterName: adapter.name },
      });
      
      throw error;
    }
  }

  /**
   * Remove data from all adapters
   */
  async remove(key: string): Promise<void> {
    const errors: Error[] = [];
    
    // Try to remove from all adapters
    for (const adapter of this.getAvailableAdapters()) {
      try {
        await adapter.remove(key);
      } catch (error) {
        errors.push(error as Error);
      }
    }
    
    if (errors.length === this.getAvailableAdapters().length) {
      throw new Error(`Failed to remove key from all storage adapters: ${errors.map(e => e.message).join(', ')}`);
    }
  }

  /**
   * Clear all storage adapters
   */
  async clear(): Promise<void> {
    const errors: Error[] = [];
    
    for (const adapter of this.getAvailableAdapters()) {
      try {
        await adapter.clear();
      } catch (error) {
        errors.push(error as Error);
      }
    }
    
    if (errors.length > 0) {
      console.warn('Some storage adapters failed to clear:', errors);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    currentAdapter: string;
    availableAdapters: string[];
    totalSize: number;
  }> {
    const currentAdapter = await this.getWorkingAdapter();
    const availableAdapters = this.getAvailableAdapters().map(a => a.name);
    
    let totalSize = 0;
    try {
      totalSize = await currentAdapter.size();
    } catch {
      // Ignore size errors
    }
    
    return {
      currentAdapter: currentAdapter.name,
      availableAdapters,
      totalSize,
    };
  }

  private initializeAdapters(): void {
    this.adapters = [
      new IndexedDBAdapter(),
      new LocalStorageAdapter(),
      new MemoryStorageAdapter(),
    ];
  }

  private getAvailableAdapters(): StorageAdapter[] {
    return this.adapters
      .filter(adapter => adapter.available)
      .sort((a, b) => a.priority - b.priority);
  }

  private async getWorkingAdapter(): Promise<StorageAdapter> {
    if (this.currentAdapter) {
      return this.currentAdapter;
    }

    const availableAdapters = this.getAvailableAdapters();
    
    for (const adapter of availableAdapters) {
      try {
        // Test the adapter with a simple operation
        await adapter.store('__test__', 'test');
        await adapter.retrieve('__test__');
        await adapter.remove('__test__');
        
        this.currentAdapter = adapter;
        return adapter;
      } catch (error) {
        console.warn(`Storage adapter ${adapter.name} failed test:`, error);
      }
    }
    
    throw new Error('No working storage adapter available');
  }
}

// Global storage fallback service
export const globalStorageFallback = new StorageFallbackService();