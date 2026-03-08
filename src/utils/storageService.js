/**
 * Storage Service
 * Handles Chrome storage operations with sync and local storage
 */

export class StorageService {
  constructor() {
    this.useSync = true;
  }

  /**
   * Get a value from storage
   * @param {string} key - The key to retrieve
   * @returns {Promise<any>} The stored value
   */
  async get(key) {
    return new Promise((resolve, reject) => {
      const storage = this.useSync ? chrome.storage.sync : chrome.storage.local;
      
      storage.get(key, (result) => {
        if (chrome.runtime.lastError) {
          // Fall back to local storage if sync fails
          if (this.useSync) {
            chrome.storage.local.get(key, (localResult) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(localResult[key]);
              }
            });
          } else {
            reject(chrome.runtime.lastError);
          }
        } else {
          resolve(result[key]);
        }
      });
    });
  }

  /**
   * Set a value in storage
   * @param {string} key - The key to set
   * @param {any} value - The value to store
   * @returns {Promise<void>}
   */
  async set(key, value) {
    return new Promise((resolve, reject) => {
      const storage = this.useSync ? chrome.storage.sync : chrome.storage.local;
      
      storage.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          // Fall back to local storage if sync fails
          if (this.useSync) {
            chrome.storage.local.set({ [key]: value }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          } else {
            reject(chrome.runtime.lastError);
          }
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Remove a value from storage
   * @param {string} key - The key to remove
   * @returns {Promise<void>}
   */
  async remove(key) {
    return new Promise((resolve, reject) => {
      const storage = this.useSync ? chrome.storage.sync : chrome.storage.local;
      
      storage.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get all stored data
   * @returns {Promise<object>} All stored data
   */
  async getAll() {
    return new Promise((resolve, reject) => {
      const storage = this.useSync ? chrome.storage.sync : chrome.storage.local;
      
      storage.get(null, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Clear all storage
   * @returns {Promise<void>}
   */
  async clear() {
    return new Promise((resolve, reject) => {
      // Clear both sync and local storage
      chrome.storage.sync.clear(() => {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    });
  }

  /**
   * Get storage usage info
   * @returns {Promise<object>} Usage information
   */
  async getUsage() {
    return new Promise((resolve) => {
      chrome.storage.sync.getBytesInUse(null, (syncBytes) => {
        chrome.storage.local.getBytesInUse(null, (localBytes) => {
          resolve({
            syncBytes,
            localBytes,
            syncQuota: chrome.storage.sync.QUOTA_BYTES,
            localQuota: chrome.storage.local.QUOTA_BYTES
          });
        });
      });
    });
  }

  /**
   * Set whether to use sync storage
   * @param {boolean} useSync - Whether to use sync storage
   */
  setUseSync(useSync) {
    this.useSync = useSync;
  }
}
