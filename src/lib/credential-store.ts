import type { AdbCredentialStore, AdbPrivateKey } from '@yume-chan/adb';

/**
 * 浏览器端的 ADB 凭据存储
 * 使用 IndexedDB 持久化 RSA 密钥对
 */
export class BrowserCredentialStore implements AdbCredentialStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private cachedKey: AdbPrivateKey | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('PenModsADB', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async generateKey(): Promise<AdbPrivateKey> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: 'SHA-1',
      },
      true,
      ['sign', 'verify'],
    );

    const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const key: AdbPrivateKey = {
      buffer: new Uint8Array(privateKey),
      name: 'penmods-installer@web',
    };

    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      tx.objectStore('keys').put({ id: 'default', key: Array.from(key.buffer) });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    this.cachedKey = key;
    return key;
  }

  async *iterateKeys(): AsyncIterable<AdbPrivateKey> {
    if (this.cachedKey) {
      yield this.cachedKey;
      return;
    }

    const db = await this.getDB();
    const stored = await new Promise<{ id: string; key: number[] } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction('keys', 'readonly');
        const req = tx.objectStore('keys').get('default');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      },
    );

    if (stored) {
      const key: AdbPrivateKey = {
        buffer: new Uint8Array(stored.key),
        name: 'penmods-installer@web',
      };
      this.cachedKey = key;
      yield key;
    }
  }
}
