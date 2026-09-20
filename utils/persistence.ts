/**
 * Asset Storage Service
 * Handles metadata and binary BLOB persistence for the Property Hub.
 * Uses IndexedDB for both binary and JSON data to avoid LocalStorage quota limits.
 */

// Helper to convert base64 / data URIs to Blobs safely without huge memory spikes
function dataURItoBlob(dataURI: string): Blob | null {
  try {
    const parts = dataURI.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    
    // Use window.atob safely
    const byteStr = atob(parts[1]);
    const len = byteStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = byteStr.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch (e) {
    console.warn("dataURItoBlob conversion error:", e);
    return null;
  }
}

export const assetStore = {
  async get(key: string): Promise<Blob | null> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(['assets'], 'readonly');
        const store = transaction.objectStore('assets');
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },
  
  async save(key: string, blob: Blob | string): Promise<void> {
    try {
      let blobToSave: Blob | null = null;
      if (typeof blob === 'string') {
        if (blob.startsWith('data:')) {
          blobToSave = dataURItoBlob(blob);
        } else if (blob.startsWith('blob:')) {
          try {
            const resp = await fetch(blob);
            blobToSave = await resp.blob();
          } catch {
            return;
          }
        } else {
          return;
        }
      } else {
        blobToSave = blob;
      }

      if (!blobToSave) return;

      const db = await openDB();
      return new Promise((resolve) => {
        try {
          const transaction = db.transaction(['assets'], 'readwrite');
          const store = transaction.objectStore('assets');
          const request = store.put(blobToSave, key);
          request.onsuccess = () => resolve();
          request.onerror = (e) => {
            console.warn("Asset store put error (non-critical):", e);
            resolve();
          };
        } catch (txErr) {
          console.warn("Asset store transaction error:", txErr);
          resolve();
        }
      });
    } catch (err) {
      console.warn("assetStore save non-critical warning:", err);
    }
  },
  
  async getMetadata(key: string): Promise<any> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(['metadata'], 'readonly');
        const store = transaction.objectStore('metadata');
        const request = store.get(key);
        request.onsuccess = () => {
          const result = request.result;
          // Check localStorage as fallback for legacy data
          if (result === undefined || result === null) {
            try {
              const localVal = localStorage.getItem(key);
              if (localVal) {
                const parsed = JSON.parse(localVal);
                resolve(parsed);
                return;
              }
            } catch (e) {}
          }
          resolve(result || null);
        };
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },
  
  async saveMetadata(key: string, data: any): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        try {
          const transaction = db.transaction(['metadata'], 'readwrite');
          const store = transaction.objectStore('metadata');
          
          transaction.onerror = (err) => {
            console.warn(`saveMetadata transaction error for key "${key}":`, err);
            resolve();
          };
          transaction.onabort = (err) => {
            console.warn(`saveMetadata transaction aborted for key "${key}":`, err);
            resolve();
          };

          const request = store.put(data, key);
          request.onsuccess = () => resolve();
          request.onerror = (err) => {
            console.warn(`saveMetadata put error for key "${key}":`, err);
            resolve(); // Non-blocking
          };
        } catch (innerErr) {
          console.warn(`saveMetadata execution error for key "${key}":`, innerErr);
          resolve();
        }
      });
    } catch (err) {
      console.warn(`saveMetadata failure for key "${key}":`, err);
    }
  },

  async delete(key: string): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(['assets'], 'readwrite');
        const store = transaction.objectStore('assets');
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    } catch {
      // Safe non-blocking
    }
  },

  async deleteMetadata(key: string): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(['metadata'], 'readwrite');
        const store = transaction.objectStore('metadata');
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    } catch {
      // Safe non-blocking
    }
  },
  
  async clear() {
    try {
      localStorage.clear();
      const db = await openDB();
      const transaction = db.transaction(['assets', 'metadata'], 'readwrite');
      transaction.objectStore('assets').clear();
      transaction.objectStore('metadata').clear();
    } catch (e) {
      console.warn("Error clearing assetStore:", e);
    }
  }
};

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Version 2 introduces 'metadata' store
    const request = indexedDB.open('LuxuryAppDB', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets');
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
