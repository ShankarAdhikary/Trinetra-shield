/**
 * Sync Route Tests
 */

const express = require('express');
const request = require('supertest');

// Mock services
jest.mock('../../src/services/taskService', () => {
  return jest.fn().mockImplementation(() => ({
    getByUserId: jest.fn(() => [{ id: 't1', text: 'Server task', completed: false }]),
    syncTasks: jest.fn((userId, tasks) => tasks)
  }));
});

jest.mock('../../src/services/timeService', () => {
  return jest.fn().mockImplementation(() => ({
    getByDateRange: jest.fn(() => []),
    syncTimeData: jest.fn()
  }));
});

jest.mock('../../src/services/userService', () => {
  return jest.fn().mockImplementation(() => ({
    findById: jest.fn((userId) => ({
      id: userId,
      settings: { focusMode: false, syncEnabled: true },
      lastSyncTime: '2025-01-01T00:00:00.000Z'
    })),
    updateSettings: jest.fn((userId, settings) => settings)
  }));
});

const syncRoutes = require('../../src/routes/sync');

describe('Sync Routes', () => {
  let app;
  const testUserId = 'user-123';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.userId = testUserId; next(); });
    app.use('/api/sync', syncRoutes);
  });

  describe('POST /api/sync (full sync)', () => {
    it('should perform full sync with all data', async () => {
      const res = await request(app)
        .post('/api/sync')
        .send({
          tasks: [{ id: 'c1', text: 'Client task' }],
          timeData: [{ date: '2025-01-15', sites: [] }],
          settings: { focusMode: true }
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tasks');
      expect(res.body).toHaveProperty('timeData');
      expect(res.body).toHaveProperty('settings');
      expect(res.body).toHaveProperty('syncTime');
    });

    it('should return server tasks when no client tasks sent', async () => {
      const res = await request(app)
        .post('/api/sync')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.tasks).toHaveLength(1);
      expect(res.body.tasks[0].text).toBe('Server task');
    });

    it('should return server settings when no client settings sent', async () => {
      const res = await request(app)
        .post('/api/sync')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.settings).toHaveProperty('focusMode');
    });
  });

  describe('POST /api/sync/tasks', () => {
    it('should sync tasks array', async () => {
      const res = await request(app)
        .post('/api/sync/tasks')
        .send({ tasks: [{ id: 'c1', text: 'Task 1' }] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tasks');
      expect(res.body).toHaveProperty('syncTime');
    });

    it('should reject missing tasks array', async () => {
      const res = await request(app)
        .post('/api/sync/tasks')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject non-array tasks', async () => {
      const res = await request(app)
        .post('/api/sync/tasks')
        .send({ tasks: 'not-array' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/sync/time', () => {
    it('should sync time data', async () => {
      const res = await request(app)
        .post('/api/sync/time')
        .send({ timeData: [{ date: '2025-01-15', sites: [] }] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('syncTime');
    });

    it('should reject missing timeData', async () => {
      const res = await request(app)
        .post('/api/sync/time')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/sync/settings', () => {
    it('should sync settings', async () => {
      const res = await request(app)
        .post('/api/sync/settings')
        .send({ settings: { focusMode: true, breakInterval: 30 } });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('settings');
      expect(res.body).toHaveProperty('syncTime');
    });

    it('should reject missing settings object', async () => {
      const res = await request(app)
        .post('/api/sync/settings')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject non-object settings', async () => {
      const res = await request(app)
        .post('/api/sync/settings')
        .send({ settings: 'not-object' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/sync/status', () => {
    it('should return sync status', async () => {
      const res = await request(app).get('/api/sync/status');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('lastSync');
      expect(res.body).toHaveProperty('syncEnabled');
      expect(res.body).toHaveProperty('serverTime');
      expect(res.body.syncEnabled).toBe(true);
    });
  });
});
