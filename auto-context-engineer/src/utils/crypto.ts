// Cryptographic utilities
export class CryptoUtils {
  static generateRandomBytes(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  static generateSalt(): Uint8Array {
    return this.generateRandomBytes(16);
  }

  static async generateIV(): Promise<Uint8Array> {
    return this.generateRandomBytes(12);
  }

  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  static async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return this.arrayBufferToBase64(hashBuffer);
  }
}

// Export individual functions for convenience
export const generateHash = CryptoUtils.hashString.bind(CryptoUtils);
export const generateId = async (): Promise<string> => {
  const randomBytes = await CryptoUtils.generateRandomBytes(16);
  return CryptoUtils.arrayBufferToBase64(randomBytes.buffer);
};
export const secureRandomBytes = CryptoUtils.generateRandomBytes.bind(CryptoUtils);
