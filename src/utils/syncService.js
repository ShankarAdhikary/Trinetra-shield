/**
 * Sync Service
 * Handles synchronization between extension and backend
 */

import { ApiClient } from '../api/apiClient.js';
import { AuthService } from '../api/authService.js';

import { StorageService } from './storageService.js';

export class SyncService {
  constructor() {
    this.api = new ApiClient();
    this.auth = new AuthService();
    this.storage = new StorageService();
    this.syncInterval = null;
    this.lastSyncTime = null;
  }

  /**
   * Initialize sync service
   */
  async init() {
    // Start periodic sync if authenticated
    const isAuth = await this.auth.isAuthenticated();
    if (isAuth) {
      this.startPeriodicSync();
    }
  }

  /**
   * Start periodic sync (every 5 minutes)
   */
  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync every 5 minutes
    this.syncInterval = setInterval(() => {
      this.syncAll();
    }, 5 * 60 * 1000);

    // Also sync immediately
    this.syncAll();
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Sync all data with backend
   */
  async syncAll() {
    const isAuth = await this.auth.isAuthenticated();
    if (!isAuth) {
      console.log('Not authenticated, skipping sync');
      return;
    }

    try {
      await Promise.all([
        this.syncTasks(),
        this.syncTimeData(),
        this.syncSettings()
      ]);

      this.lastSyncTime = new Date();
      await this.storage.set('lastSyncTime', this.lastSyncTime.toISOString());
      
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  /**
   * Sync tasks with backend
   */
  async syncTasks() {
    try {
      // Get local tasks
      const localTasks = await this.storage.get('tasks') || [];
      
      // Send to backend for sync
      const response = await this.api.post('/api/sync/tasks', {
        tasks: localTasks
      });

      if (response.tasks) {
        // Update local storage with synced tasks
        await this.storage.set('tasks', response.tasks);
      }

      return response.tasks;
    } catch (error) {
      console.error('Task sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync time tracking data with backend
   */
  async syncTimeData() {
    try {
      // Get local time data
      const localTimeData = await this.storage.get('timeData') || {};
      
      // Send to backend for sync
      const response = await this.api.post('/api/sync/time', {
        timeData: localTimeData
      });

      if (response.timeData) {
        // Update local storage with synced data
        await this.storage.set('timeData', response.timeData);
      }

      return response.timeData;
    } catch (error) {
      console.error('Time data sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync settings with backend
   */
  async syncSettings() {
    try {
      // Get local settings
      const localSettings = await this.storage.get('settings') || {};
      
      // Send to backend for sync
      const response = await this.api.post('/api/sync/settings', {
        settings: localSettings
      });

      if (response.settings) {
        // Merge server settings with local (local takes precedence for conflicts)
        const mergedSettings = {
          ...response.settings,
          ...localSettings
        };
        await this.storage.set('settings', mergedSettings);
      }

      return response.settings;
    } catch (error) {
      console.error('Settings sync failed:', error);
      throw error;
    }
  }

  /**
   * Push local data to backend (force upload)
   */
  async pushToServer() {
    const isAuth = await this.auth.isAuthenticated();
    if (!isAuth) {
      throw new Error('Not authenticated');
    }

    const tasks = await this.storage.get('tasks') || [];
    const timeData = await this.storage.get('timeData') || {};
    const settings = await this.storage.get('settings') || {};

    const response = await this.api.post('/api/sync/push', {
      tasks,
      timeData,
      settings
    });

    return response;
  }

  /**
   * Pull data from backend (force download)
   */
  async pullFromServer() {
    const isAuth = await this.auth.isAuthenticated();
    if (!isAuth) {
      throw new Error('Not authenticated');
    }

    const response = await this.api.get('/api/sync/pull');

    if (response.tasks) {
      await this.storage.set('tasks', response.tasks);
    }
    if (response.timeData) {
      await this.storage.set('timeData', response.timeData);
    }
    if (response.settings) {
      await this.storage.set('settings', response.settings);
    }

    return response;
  }

  /**
   * Get last sync time
   */
  async getLastSyncTime() {
    const lastSync = await this.storage.get('lastSyncTime');
    return lastSync ? new Date(lastSync) : null;
  }

  /**
   * Check if sync is needed
   */
  async isSyncNeeded() {
    const lastSync = await this.getLastSyncTime();
    if (!lastSync) return true;

    // Sync if more than 5 minutes since last sync
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - lastSync.getTime() > fiveMinutes;
  }
}
