/**
 * Task Service Tests
 */

// Mock the logger before requiring TaskService
jest.mock('../../src/services/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const TaskService = require('../../src/services/taskService');

describe('TaskService', () => {
  let taskService;
  const userId = 'test-user-123';

  beforeEach(() => {
    taskService = new TaskService();
    // Clear any existing tasks by creating a fresh instance
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new task', async () => {
      const taskData = {
        id: 'task-1',
        userId,
        text: 'Test task',
        completed: false,
        priority: 'normal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const task = await taskService.create(taskData);

      expect(task).toEqual(taskData);
    });
  });

  describe('getByUserId', () => {
    it('should return empty array when no tasks exist', async () => {
      // Create a fresh instance to ensure no tasks exist
      const freshService = new TaskService();
      
      // Use a unique user ID that won't have any tasks
      const tasks = await freshService.getByUserId('non-existent-user-' + Date.now());

      expect(tasks).toEqual([]);
    });

    it('should return tasks for the user', async () => {
      const uniqueUserId = 'user-' + Date.now();
      
      await taskService.create({
        id: 'task-unique-1',
        userId: uniqueUserId,
        text: 'Task 1',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const tasks = await taskService.getByUserId(uniqueUserId);

      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks.some(t => t.text === 'Task 1')).toBe(true);
    });

    it('should not return tasks from other users', async () => {
      const user1 = 'user1-' + Date.now();
      const user2 = 'user2-' + Date.now();
      
      await taskService.create({
        id: 'task-user1-' + Date.now(),
        userId: user1,
        text: 'User 1 task',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const tasks = await taskService.getByUserId(user2);

      expect(tasks.every(t => t.userId !== user1)).toBe(true);
    });

    it('should sort tasks by created date (newest first)', async () => {
      const uniqueUserId = 'sort-user-' + Date.now();
      
      await taskService.create({
        id: 'old-task-' + Date.now(),
        userId: uniqueUserId,
        text: 'Old task',
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      });

      await taskService.create({
        id: 'new-task-' + Date.now(),
        userId: uniqueUserId,
        text: 'New task',
        completed: false,
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z'
      });

      const tasks = await taskService.getByUserId(uniqueUserId);

      expect(tasks[0].text).toBe('New task');
    });
  });

  describe('getById', () => {
    it('should return task by ID', async () => {
      const taskId = 'get-by-id-' + Date.now();
      const uniqueUserId = 'getbyid-user-' + Date.now();
      
      await taskService.create({
        id: taskId,
        userId: uniqueUserId,
        text: 'Test task',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const task = await taskService.getById(taskId, uniqueUserId);

      expect(task).not.toBeNull();
      expect(task.id).toBe(taskId);
    });

    it('should return null for non-existent task', async () => {
      const task = await taskService.getById('non-existent', userId);

      expect(task).toBeNull();
    });

    it('should return null when userId does not match', async () => {
      const taskId = 'ownership-' + Date.now();
      
      await taskService.create({
        id: taskId,
        userId: 'owner-user',
        text: 'Private task',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const task = await taskService.getById(taskId, 'other-user');

      expect(task).toBeNull();
    });
  });

  describe('update', () => {
    it('should update task fields', async () => {
      const taskId = 'update-' + Date.now();
      const uniqueUserId = 'update-user-' + Date.now();
      
      await taskService.create({
        id: taskId,
        userId: uniqueUserId,
        text: 'Original text',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const updated = await taskService.update(taskId, uniqueUserId, {
        text: 'Updated text',
        completed: true
      });

      expect(updated.text).toBe('Updated text');
      expect(updated.completed).toBe(true);
    });

    it('should update the updatedAt timestamp', async () => {
      const taskId = 'timestamp-' + Date.now();
      const uniqueUserId = 'timestamp-user-' + Date.now();
      const oldDate = '2026-01-01T00:00:00.000Z';
      
      await taskService.create({
        id: taskId,
        userId: uniqueUserId,
        text: 'Test',
        completed: false,
        createdAt: oldDate,
        updatedAt: oldDate
      });

      const updated = await taskService.update(taskId, uniqueUserId, { text: 'Changed' });

      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(oldDate).getTime());
    });

    it('should return null for non-existent task', async () => {
      const updated = await taskService.update('non-existent', userId, { text: 'test' });

      expect(updated).toBeNull();
    });

    it('should not allow updating ownership (userId)', async () => {
      const taskId = 'no-owner-change-' + Date.now();
      const originalUserId = 'original-owner-' + Date.now();
      
      await taskService.create({
        id: taskId,
        userId: originalUserId,
        text: 'Test',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await taskService.update(taskId, originalUserId, { userId: 'hacker' });

      const task = await taskService.getById(taskId, originalUserId);
      expect(task.userId).toBe(originalUserId);
    });
  });

  describe('delete', () => {
    it('should delete a task', async () => {
      const taskId = 'delete-' + Date.now();
      const uniqueUserId = 'delete-user-' + Date.now();
      
      await taskService.create({
        id: taskId,
        userId: uniqueUserId,
        text: 'To be deleted',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await taskService.delete(taskId, uniqueUserId);
      const task = await taskService.getById(taskId, uniqueUserId);

      expect(result).toBe(true);
      expect(task).toBeNull();
    });

    it('should return false for non-existent task', async () => {
      const result = await taskService.delete('non-existent', userId);

      expect(result).toBe(false);
    });

    it('should not delete task with wrong userId', async () => {
      const taskId = 'protected-' + Date.now();
      const ownerId = 'owner-' + Date.now();
      
      await taskService.create({
        id: taskId,
        userId: ownerId,
        text: 'Protected task',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await taskService.delete(taskId, 'other-user');

      expect(result).toBe(false);
    });
  });

  describe('getByStatus', () => {
    it('should filter by completion status', async () => {
      const uniqueUserId = 'status-user-' + Date.now();
      
      await taskService.create({
        id: 'completed-' + Date.now(),
        userId: uniqueUserId,
        text: 'Completed task',
        completed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await taskService.create({
        id: 'active-' + Date.now(),
        userId: uniqueUserId,
        text: 'Active task',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const completedTasks = await taskService.getByStatus(uniqueUserId, true);
      const activeTasks = await taskService.getByStatus(uniqueUserId, false);

      expect(completedTasks.every(t => t.completed === true)).toBe(true);
      expect(activeTasks.every(t => t.completed === false)).toBe(true);
    });
  });

  describe('syncTasks', () => {
    it('should add new tasks from client', async () => {
      const uniqueUserId = 'sync-user-' + Date.now();
      const clientTasks = [{
        id: 'client-task-' + Date.now(),
        userId: uniqueUserId,
        text: 'Client task',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }];

      const result = await taskService.syncTasks(uniqueUserId, clientTasks);

      expect(result.some(t => t.text === 'Client task')).toBe(true);
    });

    it('should update existing tasks if client version is newer', async () => {
      const taskId = 'sync-existing-' + Date.now();
      const uniqueUserId = 'sync-update-user-' + Date.now();
      
      // Create server task
      await taskService.create({
        id: taskId,
        userId: uniqueUserId,
        text: 'Server version',
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      });

      // Client task with newer timestamp
      const clientTasks = [{
        id: taskId,
        text: 'Client version',
        completed: true,
        updatedAt: '2026-02-01T00:00:00.000Z'
      }];

      const result = await taskService.syncTasks(uniqueUserId, clientTasks);
      const updatedTask = result.find(t => t.id === taskId);

      expect(updatedTask.text).toBe('Client version');
      expect(updatedTask.completed).toBe(true);
    });

    it('should keep server version if it is newer', async () => {
      const taskId = 'sync-server-wins-' + Date.now();
      const uniqueUserId = 'sync-server-user-' + Date.now();
      
      // Create server task with newer timestamp
      await taskService.create({
        id: taskId,
        userId: uniqueUserId,
        text: 'Server version',
        completed: false,
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z'
      });

      // Client task with older timestamp
      const clientTasks = [{
        id: taskId,
        text: 'Client version',
        completed: true,
        updatedAt: '2026-01-01T00:00:00.000Z'
      }];

      const result = await taskService.syncTasks(uniqueUserId, clientTasks);
      const task = result.find(t => t.id === taskId);

      expect(task.text).toBe('Server version');
    });
  });
});
