/**
 * Tasks Route Tests
 */

const express = require('express');
const request = require('supertest');

// Mock TaskService
const mockTasks = [];
jest.mock('../../src/services/taskService', () => {
  return jest.fn().mockImplementation(() => ({
    getByUserId: jest.fn((userId) => mockTasks.filter(t => t.userId === userId)),
    create: jest.fn((task) => { mockTasks.push(task); return task; }),
    getById: jest.fn((id, userId) => mockTasks.find(t => t.id === id && t.userId === userId) || null),
    update: jest.fn((id, userId, updates) => {
      const task = mockTasks.find(t => t.id === id && t.userId === userId);
      if (!task) return null;
      Object.assign(task, updates);
      return task;
    }),
    delete: jest.fn((id, userId) => {
      const idx = mockTasks.findIndex(t => t.id === id && t.userId === userId);
      if (idx === -1) return false;
      mockTasks.splice(idx, 1);
      return true;
    }),
    mergeTasks: jest.fn((userId, clientTasks, serverTasks) => [...clientTasks, ...serverTasks]),
    syncTasks: jest.fn((userId, tasks) => tasks)
  }));
});

const taskRoutes = require('../../src/routes/tasks');

describe('Tasks Routes', () => {
  let app;
  const testUserId = 'user-123';

  beforeEach(() => {
    mockTasks.length = 0;
    app = express();
    app.use(express.json());
    // Inject userId middleware
    app.use((req, res, next) => { req.userId = testUserId; next(); });
    app.use('/api/tasks', taskRoutes);
  });

  describe('GET /api/tasks', () => {
    it('should return empty array when no tasks', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return user tasks', async () => {
      mockTasks.push({ id: 'task-1', userId: testUserId, text: 'Test task' });
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].text).toBe('Test task');
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a task with valid data', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ text: 'New task' });

      expect(res.status).toBe(201);
      expect(res.body.text).toBe('New task');
      expect(res.body.completed).toBe(false);
      expect(res.body.priority).toBe('normal');
    });

    it('should reject empty text', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ text: '' });

      expect(res.status).toBe(400);
    });

    it('should accept priority levels', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ text: 'High priority task', priority: 'high' });

      expect(res.status).toBe(201);
      expect(res.body.priority).toBe('high');
    });

    it('should reject invalid priority', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ text: 'Task', priority: 'urgent' });

      expect(res.status).toBe(400);
    });

    it('should accept optional dueDate', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ text: 'Task', dueDate: '2025-12-31T00:00:00.000Z' });

      expect(res.status).toBe(201);
      expect(res.body.dueDate).toBe('2025-12-31T00:00:00.000Z');
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should return task by ID', async () => {
      const taskId = '550e8400-e29b-41d4-a716-446655440000';
      mockTasks.push({ id: taskId, userId: testUserId, text: 'Found task' });

      const res = await request(app).get(`/api/tasks/${taskId}`);
      expect(res.status).toBe(200);
      expect(res.body.text).toBe('Found task');
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app).get('/api/tasks/550e8400-e29b-41d4-a716-446655440000');
      expect(res.status).toBe(404);
    });

    it('should reject invalid UUID', async () => {
      const res = await request(app).get('/api/tasks/not-a-uuid');
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    const taskId = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
      mockTasks.push({ id: taskId, userId: testUserId, text: 'Original', completed: false, priority: 'normal' });
    });

    it('should update task text', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .send({ text: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('Updated');
    });

    it('should mark task as completed', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .send({ completed: true });

      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app)
        .patch('/api/tasks/550e8400-e29b-41d4-a716-446655440001')
        .send({ text: 'Nope' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete existing task', async () => {
      const taskId = '550e8400-e29b-41d4-a716-446655440000';
      mockTasks.push({ id: taskId, userId: testUserId, text: 'Delete me' });

      const res = await request(app).delete(`/api/tasks/${taskId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app).delete('/api/tasks/550e8400-e29b-41d4-a716-446655440000');
      expect(res.status).toBe(404);
    });

    it('should reject invalid UUID', async () => {
      const res = await request(app).delete('/api/tasks/bad-id');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/tasks/sync', () => {
    it('should sync client tasks with server', async () => {
      const clientTasks = [{ id: 'c1', text: 'Client task' }];

      const res = await request(app)
        .post('/api/tasks/sync')
        .send({ tasks: clientTasks });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should reject non-array tasks', async () => {
      const res = await request(app)
        .post('/api/tasks/sync')
        .send({ tasks: 'not-an-array' });

      expect(res.status).toBe(400);
    });
  });
});
