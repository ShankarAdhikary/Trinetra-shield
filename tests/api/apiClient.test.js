/**
 * ApiClient Tests
 */

import { ApiClient, ApiError } from '../../src/api/apiClient.js';

// Mock StorageService
jest.mock('../../src/utils/storageService.js', () => ({
  StorageService: jest.fn().mockImplementation(() => {
    const data = {};
    return {
      get: jest.fn((key) => Promise.resolve(data[key] || null)),
      set: jest.fn((key, value) => { data[key] = value; return Promise.resolve(); }),
      remove: jest.fn((key) => { delete data[key]; return Promise.resolve(); })
    };
  })
}));

// Mock fetch
global.fetch = jest.fn();

describe('ApiClient', () => {
  let client;

  beforeEach(() => {
    client = new ApiClient();
    fetch.mockClear();
  });

  describe('constructor', () => {
    it('should set default base URL', () => {
      expect(client.baseUrl).toBe('https://trinetra-shield.onrender.com');
    });

    it('should set 30s timeout', () => {
      expect(client.timeout).toBe(30000);
    });
  });

  describe('setBaseUrl', () => {
    it('should update base URL', () => {
      client.setBaseUrl('http://localhost:3000');
      expect(client.baseUrl).toBe('http://localhost:3000');
    });
  });

  describe('request', () => {
    it('should make authenticated request with token', async () => {
      client.storage.get.mockResolvedValue({ token: 'test-token' });
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' })
      });

      const result = await client.request('/api/test');

      expect(fetch).toHaveBeenCalledWith(
        'https://trinetra-shield.onrender.com/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          })
        })
      );
      expect(result).toEqual({ data: 'test' });
    });

    it('should make request without token', async () => {
      client.storage.get.mockResolvedValue(null);
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' })
      });

      await client.request('/api/test');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String)
          })
        })
      );
    });

    it('should throw ApiError on non-ok response', async () => {
      client.storage.get.mockResolvedValue(null);
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' })
      });

      await expect(client.request('/api/test')).rejects.toThrow();
    });

    it('should handle timeout with AbortError', async () => {
      client.timeout = 1;
      client.storage.get.mockResolvedValue(null);

      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      fetch.mockRejectedValue(abortError);

      await expect(client.request('/api/test')).rejects.toThrow();
    });
  });

  describe('get', () => {
    beforeEach(() => {
      client.storage.get.mockResolvedValue(null);
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });
    });

    it('should make GET request', async () => {
      await client.get('/api/tasks');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should append query params', async () => {
      await client.get('/api/time', { startDate: '2025-01-01', endDate: '2025-01-31' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2025-01-01'),
        expect.any(Object)
      );
    });
  });

  describe('post', () => {
    beforeEach(() => {
      client.storage.get.mockResolvedValue(null);
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });

    it('should make POST with JSON body', async () => {
      await client.post('/api/tasks', { text: 'Test' });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'Test' })
        })
      );
    });
  });

  describe('patch', () => {
    beforeEach(() => {
      client.storage.get.mockResolvedValue(null);
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });

    it('should make PATCH request', async () => {
      await client.patch('/api/tasks/1', { completed: true });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      client.storage.get.mockResolvedValue(null);
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });

    it('should make DELETE request', async () => {
      await client.delete('/api/tasks/1');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('token management', () => {
    it('should get stored token', async () => {
      client.storage.get.mockResolvedValue({ token: 'my-token' });
      const token = await client.getToken();
      expect(token).toBe('my-token');
    });

    it('should return null when no token', async () => {
      client.storage.get.mockResolvedValue(null);
      const token = await client.getToken();
      expect(token).toBeNull();
    });

    it('should store token', async () => {
      client.storage.get.mockResolvedValue({});
      await client.setToken('new-token');
      expect(client.storage.set).toHaveBeenCalledWith('auth', expect.objectContaining({ token: 'new-token' }));
    });

    it('should clear token', async () => {
      await client.clearToken();
      expect(client.storage.remove).toHaveBeenCalledWith('auth');
    });
  });

  describe('API convenience methods', () => {
    beforeEach(() => {
      jest.spyOn(client, 'get').mockResolvedValue({});
      jest.spyOn(client, 'post').mockResolvedValue({});
      jest.spyOn(client, 'patch').mockResolvedValue({});
      jest.spyOn(client, 'put').mockResolvedValue({});
    });

    it('syncData should POST to /api/sync', async () => {
      await client.syncData({ tasks: [] });
      expect(client.post).toHaveBeenCalledWith('/api/sync', { tasks: [] });
    });

    it('getProfile should GET /api/user/profile', async () => {
      await client.getProfile();
      expect(client.get).toHaveBeenCalledWith('/api/user/profile');
    });

    it('getTasks should GET /api/tasks', async () => {
      await client.getTasks();
      expect(client.get).toHaveBeenCalledWith('/api/tasks');
    });

    it('syncTasks should POST to /api/tasks/sync', async () => {
      await client.syncTasks([{ id: '1' }]);
      expect(client.post).toHaveBeenCalledWith('/api/tasks/sync', { tasks: [{ id: '1' }] });
    });
  });
});
