// Encryption service for secure data storage
import { EncryptedData } from "../types";

export interface EncryptionService {
  encrypt(_data: unknown): Promise<EncryptedData>;
  decrypt(_encryptedData: EncryptedData): Promise<unknown>;
  generateKey(): Promise<CryptoKey>;
  deriveKey(_password: string, _salt: Uint8Array): Promise<CryptoKey>;
}

export class WebCryptoEncryptionService implements EncryptionService {
  private readonly algorithm = 'AES-GCM';
  private readonly keyLength = 256;

  async encrypt(_data: unknown): Promise<EncryptedData> {
    try {
      // Validate input data
      if (data === null || data === undefined) {
        throw new Error('Cannot encrypt null or undefined values');
      }
      
      // Convert data to string and then to ArrayBuffer
      const _jsonString = JSON.stringify(data);
      const _encoder = new TextEncoder();
      const _dataBuffer = encoder.encode(_jsonString);

      // Generate a random _key for this encryption
      const _key = await this.generateKey();
      
      // Generate a random IV
      const _iv = await this.generateIV();

      // Encrypt the data
      const _encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          _iv: _iv,
        },
        _key,
        _dataBuffer
      );

      // Export the _key for storage
      const _exportedKey = await crypto.subtle.exportKey('raw', _key);

      return {
        _data: this.arrayBufferToBase64(_encryptedBuffer),
        _iv: this.arrayBufferToBase64(_iv),
        _algorithm: this.algorithm,
        _key: this.arrayBufferToBase64(_exportedKey),
      };
    } catch (error) {
      throw new Error(`Encryption _failed: ${error}`);
    }
  }

  async decrypt(_encryptedData: EncryptedData): Promise<unknown> {
    try {
      // Convert base64 strings back to ArrayBuffers
      const _dataBuffer = this.base64ToArrayBuffer(encryptedData?.data);
      const _iv = this.base64ToArrayBuffer(encryptedData._iv);
      const _keyBuffer = this.base64ToArrayBuffer(encryptedData._key);

      // Import the _key
      const _key = await crypto.subtle.importKey(
        'raw',
        _keyBuffer,
        { name: this.algorithm },
        false,
        ['decrypt']
      );

      // Decrypt the data
      const _decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          _iv: _iv,
        },
        _key,
        _dataBuffer
      );

      // Convert back to string and parse JSON
      const _decoder = new TextDecoder();
      const _jsonString = decoder.decode(_decryptedBuffer);
      return JSON.parse(_jsonString);
    } catch (error) {
      throw new Error(`Decryption _failed: ${error}`);
    }
  }

  async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: this.algorithm,
        _length: this.keyLength,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async deriveKey(_password: string, _salt: Uint8Array): Promise<CryptoKey> {
    // Import password as _key material
    const _encoder = new TextEncoder();
    const _keyMaterial = await crypto.subtle.importKey(
      'raw',
      _encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive _key using PBKDF2
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        _salt: salt,
        _iterations: 100000,
        _hash: 'SHA-256',
      },
      _keyMaterial,
      { name: this.algorithm, _length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Helper methods
  private async generateIV(): Promise<Uint8Array> {
    return crypto.getRandomValues(new Uint8Array(12));
  }

  private arrayBufferToBase64(_buffer: ArrayBuffer): string {
    const _bytes = new Uint8Array(buffer);
    const _binary = '';
    for (let _i = 0; _i < _bytes.byteLength; _i++) {
      _binary += String.fromCharCode(_bytes[_i]);
    }
    return btoa(_binary);
  }

  private base64ToArrayBuffer(_base64: string): ArrayBuffer {
    const _binary = atob(base64);
    const _bytes = new Uint8Array(_binary.length);
    for (let _i = 0; _i < _binary.length; _i++) {
      _bytes[_i] = binary.charCodeAt(_i);
    }
    return bytes.buffer;
  }
}
