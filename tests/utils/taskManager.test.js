/**
 * Task Manager Tests
 */

import { TaskManager } from '../../src/utils/taskManager.js';

describe('TaskManager', () => {
  let taskManager;

  beforeEach(() => {
    taskManager = new TaskManager();
  });

  describe('addTask', () => {
    it('should add a new task with required fields', async () => {
      const task = await taskManager.addTask('Test task');
      
      expect(task).toHaveProperty('id');
      expect(task.text).toBe('Test task');
      expect(task.completed).toBe(false);
      expect(task.createdAt).toBeDefined();
      expect(task.priority).toBe('normal');
    });

    it('should add task with custom options', async () => {
      const dueDate = Date.now() + 86400000;
      const task = await taskManager.addTask('Task with options', {
        priority: 'high',
        dueDate,
        tags: ['work', 'urgent']
      });
      
      expect(task.priority).toBe('high');
      expect(task.dueDate).toBe(dueDate);
      expect(task.tags).toEqual(['work', 'urgent']);
    });

    it('should trim task text', async () => {
      const task = await taskManager.addTask('  Trimmed task  ');
      
      expect(task.text).toBe('Trimmed task');
    });

    it('should add task to beginning of list', async () => {
      await taskManager.addTask('First task');
      await taskManager.addTask('Second task');
      
      const tasks = await taskManager.getTasks();
      
      expect(tasks[0].text).toBe('Second task');
      expect(tasks[1].text).toBe('First task');
    });
  });

  describe('getTasks', () => {
    it('should return empty array when no tasks', async () => {
      const tasks = await taskManager.getTasks();
      
      expect(tasks).toEqual([]);
    });

    it('should return all tasks', async () => {
      await taskManager.addTask('Task 1');
      await taskManager.addTask('Task 2');
      await taskManager.addTask('Task 3');
      
      const tasks = await taskManager.getTasks();
      
      expect(tasks).toHaveLength(3);
    });
  });

  describe('getTask', () => {
    it('should return a task by ID', async () => {
      const created = await taskManager.addTask('Test task');
      
      const task = await taskManager.getTask(created.id);
      
      expect(task).toEqual(created);
    });

    it('should return null for non-existent ID', async () => {
      const task = await taskManager.getTask('non-existent-id');
      
      expect(task).toBeNull();
    });
  });

  describe('updateTask', () => {
    it('should update task fields', async () => {
      const created = await taskManager.addTask('Original text');
      
      // Wait a tick to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updated = await taskManager.updateTask(created.id, {
        text: 'Updated text',
        priority: 'high'
      });
      
      expect(updated.text).toBe('Updated text');
      expect(updated.priority).toBe('high');
      expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    });

    it('should return null for non-existent task', async () => {
      const result = await taskManager.updateTask('non-existent', { text: 'test' });
      
      expect(result).toBeNull();
    });
  });

  describe('toggleTask', () => {
    it('should toggle task completion to true', async () => {
      const created = await taskManager.addTask('Test task');
      
      const toggled = await taskManager.toggleTask(created.id, true);
      
      expect(toggled.completed).toBe(true);
      expect(toggled.completedAt).toBeDefined();
    });

    it('should toggle task completion to false', async () => {
      const created = await taskManager.addTask('Test task');
      await taskManager.toggleTask(created.id, true);
      
      const toggled = await taskManager.toggleTask(created.id, false);
      
      expect(toggled.completed).toBe(false);
      expect(toggled.completedAt).toBeNull();
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      const created = await taskManager.addTask('Test task');
      
      const result = await taskManager.deleteTask(created.id);
      const tasks = await taskManager.getTasks();
      
      expect(result).toBe(true);
      expect(tasks).toHaveLength(0);
    });

    it('should return false for non-existent task', async () => {
      const result = await taskManager.deleteTask('non-existent');
      
      expect(result).toBe(false);
    });
  });

  describe('clearCompleted', () => {
    it('should remove all completed tasks', async () => {
      const task1 = await taskManager.addTask('Task 1');
      await taskManager.addTask('Task 2');
      await taskManager.toggleTask(task1.id, true);
      
      const deletedCount = await taskManager.clearCompleted();
      const tasks = await taskManager.getTasks();
      
      expect(deletedCount).toBe(1);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Task 2');
    });
  });

  describe('clearAll', () => {
    it('should remove all tasks', async () => {
      await taskManager.addTask('Task 1');
      await taskManager.addTask('Task 2');
      
      await taskManager.clearAll();
      const tasks = await taskManager.getTasks();
      
      expect(tasks).toHaveLength(0);
    });
  });

  describe('reorderTask', () => {
    it('should reorder tasks', async () => {
      await taskManager.addTask('Task 1');
      await taskManager.addTask('Task 2');
      const task3 = await taskManager.addTask('Task 3');
      
      const reordered = await taskManager.reorderTask(task3.id, 2);
      
      expect(reordered[2].text).toBe('Task 3');
    });
  });

  describe('getFilteredTasks', () => {
    beforeEach(async () => {
      const task1 = await taskManager.addTask('Task 1');
      await taskManager.addTask('Task 2');
      await taskManager.toggleTask(task1.id, true);
    });

    it('should filter active tasks', async () => {
      const active = await taskManager.getFilteredTasks('active');
      
      expect(active).toHaveLength(1);
      expect(active[0].text).toBe('Task 2');
    });

    it('should filter completed tasks', async () => {
      const completed = await taskManager.getFilteredTasks('completed');
      
      expect(completed).toHaveLength(1);
      expect(completed[0].text).toBe('Task 1');
    });

    it('should return all tasks for "all" filter', async () => {
      const all = await taskManager.getFilteredTasks('all');
      
      expect(all).toHaveLength(2);
    });
  });

  describe('getStats', () => {
    it('should return task statistics', async () => {
      const task1 = await taskManager.addTask('Task 1');
      await taskManager.addTask('Task 2');
      await taskManager.addTask('Task 3', { dueDate: Date.now() - 1000 });
      await taskManager.toggleTask(task1.id, true);
      
      const stats = await taskManager.getStats();
      
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.active).toBe(2);
      expect(stats.overdue).toBe(1);
    });
  });

  describe('searchTasks', () => {
    beforeEach(async () => {
      await taskManager.addTask('Shopping list', { tags: ['personal'] });
      await taskManager.addTask('Work meeting', { tags: ['work'] });
      await taskManager.addTask('Call mom', { tags: ['personal'] });
    });

    it('should search by text', async () => {
      const results = await taskManager.searchTasks('meet');
      
      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('Work meeting');
    });

    it('should search by tag', async () => {
      const results = await taskManager.searchTasks('personal');
      
      expect(results).toHaveLength(2);
    });

    it('should be case-insensitive', async () => {
      const results = await taskManager.searchTasks('SHOPPING');
      
      expect(results).toHaveLength(1);
    });
  });

  describe('exportTasks / importTasks', () => {
    it('should export tasks to JSON', async () => {
      await taskManager.addTask('Export test');
      
      const exported = await taskManager.exportTasks();
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveLength(1);
      expect(parsed[0].text).toBe('Export test');
    });

    it('should import tasks from JSON', async () => {
      const tasksJson = JSON.stringify([{
        id: 'imported-1',
        text: 'Imported task',
        completed: false,
        createdAt: Date.now(),
        priority: 'normal',
        tags: []
      }]);
      
      const count = await taskManager.importTasks(tasksJson);
      const tasks = await taskManager.getTasks();
      
      expect(count).toBe(1);
      expect(tasks).toHaveLength(1);
    });

    it('should merge imported tasks with existing', async () => {
      await taskManager.addTask('Existing task');
      
      const tasksJson = JSON.stringify([{
        id: 'imported-1',
        text: 'Imported task',
        completed: false,
        createdAt: Date.now(),
        priority: 'normal',
        tags: []
      }]);
      
      await taskManager.importTasks(tasksJson, true);
      const tasks = await taskManager.getTasks();
      
      expect(tasks).toHaveLength(2);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = taskManager.generateId();
      const id2 = taskManager.generateId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^task_/);
    });
  });
});
