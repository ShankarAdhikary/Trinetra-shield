/**
 * SyncService Tests
 */

import { SyncService } from '../../src/utils/syncService.js';

// Mock ApiClient
jest.mock('../../src/api/apiClient.js', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    post: jest.fn().mockResolvedValue({}),
    get: jest.fn().mockResolvedValue({})
  }))
}));

// Mock AuthService
jest.mock('../../src/api/authService.js', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    isAuthenticated: jest.fn().mockResolvedValue(true)
  }))
}));

// Mock StorageService
jest.mock('../../src/utils/storageService.js', () => ({
  StorageService: jest.fn().mockImplementation(() => {
    const data = {};
    return {
      get: jest.fn((key) => Promise.resolve(data[key] || null)),
      set: jest.fn((key, value) => { data[key] = value; return Promise.resolve(); }),
      remove: jest.fn((key) => { delete data[key]; return Promise.resolve(); }),
      clear: jest.fn(() => { Object.keys(data).forEach(k => delete data[k]); return Promise.resolve(); })
    };
  })
}));

describe('SyncService', () => {
  let syncService;

  beforeEach(() => {
    jest.useFakeTimers();
    syncService = new SyncService();
  });

  afterEach(() => {
    syncService.stopPeriodicSync();
    jest.useRealTimers();
  });

  describe('init', () => {
    it('should start periodic sync when authenticated', async () => {
      const spy = jest.spyOn(syncService, 'startPeriodicSync');
      await syncService.init();
      expect(spy).toHaveBeenCalled();
    });

    it('should not start sync when not authenticated', async () => {
      syncService.auth.isAuthenticated.mockResolvedValue(false);
      const spy = jest.spyOn(syncService, 'syncAll');
      await syncService.init();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('startPeriodicSync', () => {
    it('should set up sync interval', () => {
      syncService.startPeriodicSync();
      expect(syncService.syncInterval).not.toBeNull();
    });

    it('should clear previous interval on restart', () => {
      syncService.startPeriodicSync();
      const first = syncService.syncInterval;
      syncService.startPeriodicSync();
      expect(syncService.syncInterval).not.toBe(first);
    });
  });

  describe('stopPeriodicSync', () => {
    it('should clear sync interval', () => {
      syncService.startPeriodicSync();
      syncService.stopPeriodicSync();
      expect(syncService.syncInterval).toBeNull();
    });
  });

  describe('syncAll', () => {
    it('should sync tasks, time, and settings', async () => {
      const taskSpy = jest.spyOn(syncService, 'syncTasks').mockResolvedValue([]);
      const timeSpy = jest.spyOn(syncService, 'syncTimeData').mockResolvedValue({});
      const settingsSpy = jest.spyOn(syncService, 'syncSettings').mockResolvedValue({});

      await syncService.syncAll();

      expect(taskSpy).toHaveBeenCalled();
      expect(timeSpy).toHaveBeenCalled();
      expect(settingsSpy).toHaveBeenCalled();
    });

    it('should update lastSyncTime on success', async () => {
      jest.spyOn(syncService, 'syncTasks').mockResolvedValue([]);
      jest.spyOn(syncService, 'syncTimeData').mockResolvedValue({});
      jest.spyOn(syncService, 'syncSettings').mockResolvedValue({});

      await syncService.syncAll();
      expect(syncService.lastSyncTime).toBeInstanceOf(Date);
    });

    it('should skip sync when not authenticated', async () => {
      syncService.auth.isAuthenticated.mockResolvedValue(false);
      const taskSpy = jest.spyOn(syncService, 'syncTasks');

      await syncService.syncAll();
      expect(taskSpy).not.toHaveBeenCalled();
    });
  });

  describe('syncTasks', () => {
    it('should send local tasks and update storage', async () => {
      syncService.api.post.mockResolvedValue({ tasks: [{ id: '1', text: 'Synced' }] });

      const result = await syncService.syncTasks();
      expect(syncService.api.post).toHaveBeenCalledWith('/api/sync/tasks', expect.any(Object));
      expect(result).toEqual([{ id: '1', text: 'Synced' }]);
    });

    it('should throw on API error', async () => {
      syncService.api.post.mockRejectedValue(new Error('Network error'));
      await expect(syncService.syncTasks()).rejects.toThrow('Network error');
    });
  });

  describe('syncTimeData', () => {
    it('should sync time data with backend', async () => {
      syncService.api.post.mockResolvedValue({ timeData: { '2025-01-15': {} } });

      const result = await syncService.syncTimeData();
      expect(syncService.api.post).toHaveBeenCalledWith('/api/sync/time', expect.any(Object));
    });
  });

  describe('syncSettings', () => {
    it('should sync settings and merge local over server', async () => {
      syncService.api.post.mockResolvedValue({ settings: { theme: 'dark', focusMode: false } });

      const result = await syncService.syncSettings();
      expect(syncService.api.post).toHaveBeenCalledWith('/api/sync/settings', expect.any(Object));
    });
  });

  describe('pushToServer', () => {
    it('should push all local data to server', async () => {
      syncService.api.post.mockResolvedValue({ success: true });

      await syncService.pushToServer();
      expect(syncService.api.post).toHaveBeenCalledWith('/api/sync/push', expect.any(Object));
    });

    it('should throw when not authenticated', async () => {
      syncService.auth.isAuthenticated.mockResolvedValue(false);
      await expect(syncService.pushToServer()).rejects.toThrow('Not authenticated');
    });
  });

  describe('pullFromServer', () => {
    it('should download and store server data', async () => {
      syncService.api.get.mockResolvedValue({
        tasks: [{ id: '1' }],
        timeData: {},
        settings: {}
      });

      await syncService.pullFromServer();
      expect(syncService.api.get).toHaveBeenCalledWith('/api/sync/pull');
    });

    it('should throw when not authenticated', async () => {
      syncService.auth.isAuthenticated.mockResolvedValue(false);
      await expect(syncService.pullFromServer()).rejects.toThrow('Not authenticated');
    });
  });

  describe('getLastSyncTime', () => {
    it('should return null when never synced', async () => {
      const result = await syncService.getLastSyncTime();
      expect(result).toBeNull();
    });
  });

  describe('isSyncNeeded', () => {
    it('should return true when never synced', async () => {
      const result = await syncService.isSyncNeeded();
      expect(result).toBe(true);
    });
  });
});
