/**
 * Task Manager
 * Handles task creation, updates, and persistence
 */

import { StorageService } from './storageService.js';

export class TaskManager {
  constructor() {
    this.storage = new StorageService();
  }

  /**
   * Get all tasks
   * @returns {Promise<Array>} List of tasks
   */
  async getTasks() {
    const tasks = await this.storage.get('tasks') || [];
    return tasks;
  }

  /**
   * Get a single task by ID
   * @param {string} id - Task ID
   * @returns {Promise<object|null>} The task or null
   */
  async getTask(id) {
    const tasks = await this.getTasks();
    return tasks.find(task => task.id === id) || null;
  }

  /**
   * Add a new task
   * @param {string} text - Task text
   * @param {object} options - Additional task options
   * @returns {Promise<object>} The created task
   */
  async addTask(text, options = {}) {
    const tasks = await this.getTasks();
    
    const task = {
      id: this.generateId(),
      text: text.trim(),
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      priority: options.priority || 'normal',
      dueDate: options.dueDate || null,
      tags: options.tags || []
    };
    
    tasks.unshift(task); // Add to beginning of list
    await this.storage.set('tasks', tasks);
    
    return task;
  }

  /**
   * Update a task
   * @param {string} id - Task ID
   * @param {object} updates - Fields to update
   * @returns {Promise<object|null>} The updated task or null
   */
  async updateTask(id, updates) {
    const tasks = await this.getTasks();
    const index = tasks.findIndex(task => task.id === id);
    
    if (index === -1) {
      return null;
    }
    
    tasks[index] = {
      ...tasks[index],
      ...updates,
      updatedAt: Date.now()
    };
    
    await this.storage.set('tasks', tasks);
    
    return tasks[index];
  }

  /**
   * Toggle task completion
   * @param {string} id - Task ID
   * @param {boolean} completed - Completion status
   * @returns {Promise<object|null>} The updated task or null
   */
  async toggleTask(id, completed) {
    return this.updateTask(id, { 
      completed,
      completedAt: completed ? Date.now() : null
    });
  }

  /**
   * Delete a task
   * @param {string} id - Task ID
   * @returns {Promise<boolean>} Whether the task was deleted
   */
  async deleteTask(id) {
    const tasks = await this.getTasks();
    const index = tasks.findIndex(task => task.id === id);
    
    if (index === -1) {
      return false;
    }
    
    tasks.splice(index, 1);
    await this.storage.set('tasks', tasks);
    
    return true;
  }

  /**
   * Delete all completed tasks
   * @returns {Promise<number>} Number of tasks deleted
   */
  async clearCompleted() {
    const tasks = await this.getTasks();
    const remaining = tasks.filter(task => !task.completed);
    const deleted = tasks.length - remaining.length;
    
    await this.storage.set('tasks', remaining);
    
    return deleted;
  }

  /**
   * Delete all tasks
   * @returns {Promise<void>}
   */
  async clearAll() {
    await this.storage.set('tasks', []);
  }

  /**
   * Reorder tasks
   * @param {string} id - Task ID to move
   * @param {number} newIndex - New position index
   * @returns {Promise<Array>} Reordered tasks
   */
  async reorderTask(id, newIndex) {
    const tasks = await this.getTasks();
    const currentIndex = tasks.findIndex(task => task.id === id);
    
    if (currentIndex === -1) {
      return tasks;
    }
    
    const [task] = tasks.splice(currentIndex, 1);
    tasks.splice(newIndex, 0, task);
    
    await this.storage.set('tasks', tasks);
    
    return tasks;
  }

  /**
   * Get tasks filtered by status
   * @param {string} filter - Filter type ('all', 'active', 'completed')
   * @returns {Promise<Array>} Filtered tasks
   */
  async getFilteredTasks(filter = 'all') {
    const tasks = await this.getTasks();
    
    switch (filter) {
      case 'active':
        return tasks.filter(task => !task.completed);
      case 'completed':
        return tasks.filter(task => task.completed);
      default:
        return tasks;
    }
  }

  /**
   * Get task statistics
   * @returns {Promise<object>} Task stats
   */
  async getStats() {
    const tasks = await this.getTasks();
    
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.completed).length,
      active: tasks.filter(t => !t.completed).length,
      overdue: tasks.filter(t => !t.completed && t.dueDate && t.dueDate < Date.now()).length
    };
  }

  /**
   * Search tasks
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching tasks
   */
  async searchTasks(query) {
    const tasks = await this.getTasks();
    const queryLower = query.toLowerCase();
    
    return tasks.filter(task => 
      task.text.toLowerCase().includes(queryLower) ||
      task.tags.some(tag => tag.toLowerCase().includes(queryLower))
    );
  }

  /**
   * Export tasks to JSON
   * @returns {Promise<string>} JSON string of tasks
   */
  async exportTasks() {
    const tasks = await this.getTasks();
    return JSON.stringify(tasks, null, 2);
  }

  /**
   * Import tasks from JSON
   * @param {string} json - JSON string of tasks
   * @param {boolean} merge - Whether to merge with existing tasks
   * @returns {Promise<number>} Number of tasks imported
   */
  async importTasks(json, merge = true) {
    try {
      const imported = JSON.parse(json);
      
      if (!Array.isArray(imported)) {
        throw new Error('Invalid tasks format');
      }
      
      let tasks = merge ? await this.getTasks() : [];
      const existingIds = new Set(tasks.map(t => t.id));
      
      for (const task of imported) {
        if (!existingIds.has(task.id)) {
          tasks.push({
            ...task,
            id: task.id || this.generateId(),
            updatedAt: Date.now()
          });
        }
      }
      
      await this.storage.set('tasks', tasks);
      
      return imported.length;
    } catch (error) {
      console.error('Failed to import tasks:', error);
      throw error;
    }
  }

  /**
   * Generate a unique task ID
   * @returns {string} Unique ID
   */
  generateId() {
    return 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }
}
