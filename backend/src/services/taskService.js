/**
 * Task Service
 * Handles task data operations with database persistence
 */

const db = require('./database');
const logger = require('./logger');

class TaskService {
  /**
   * Get all tasks for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of tasks
   */
  async getByUserId(userId) {
    const tasks = db.getTasks(userId) || [];
    // Sort by created date, newest first
    return tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Get a task by ID
   * @param {string} id - Task ID
   * @param {string} userId - User ID (for ownership check)
   * @returns {Promise<object|null>} Task or null
   */
  async getById(id, userId) {
    const tasks = db.getTasks(userId) || [];
    return tasks.find(t => t.id === id) || null;
  }

  /**
   * Create a new task
   * @param {object} taskData - Task data
   * @returns {Promise<object>} Created task
   */
  async create(taskData) {
    db.addTask(taskData.userId, taskData);
    logger.info('Task created', { taskId: taskData.id, userId: taskData.userId });
    return taskData;
  }

  /**
   * Update a task
   * @param {string} id - Task ID
   * @param {string} userId - User ID (for ownership check)
   * @param {object} updates - Fields to update
   * @returns {Promise<object|null>} Updated task or null
   */
  async update(id, userId, updates) {
    const tasks = db.getTasks(userId) || [];
    const index = tasks.findIndex(t => t.id === id);
    
    if (index === -1) {
      return null;
    }

    // Don't allow updating ownership
    // eslint-disable-next-line no-unused-vars
    const { id: _id, userId: _userId, ...safeUpdates } = updates;

    const updatedTask = {
      ...tasks[index],
      ...safeUpdates,
      updatedAt: new Date().toISOString()
    };

    tasks[index] = updatedTask;
    db.setTasks(userId, tasks);
    
    logger.info('Task updated', { taskId: id, userId });

    return updatedTask;
  }

  /**
   * Delete a task
   * @param {string} id - Task ID
   * @param {string} userId - User ID (for ownership check)
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id, userId) {
    const deleted = db.deleteTask(userId, id);
    
    if (deleted) {
      logger.info('Task deleted', { taskId: id, userId });
    }

    return deleted;
  }

  /**
   * Get tasks by completion status
   * @param {string} userId - User ID
   * @param {boolean} completed - Completion status
   * @returns {Promise<Array>} List of tasks
   */
  async getByStatus(userId, completed) {
    const tasks = await this.getByUserId(userId);
    return tasks.filter(task => task.completed === completed);
  }

  /**
   * Sync tasks from extension
   * @param {string} userId - User ID
   * @param {Array} clientTasks - Tasks from client
   * @returns {Promise<Array>} Merged tasks
   */
  async syncTasks(userId, clientTasks) {
    const serverTasks = await this.getByUserId(userId);
    const serverTaskMap = new Map(serverTasks.map(t => [t.id, t]));

    // Merge tasks - client wins for conflicts based on updatedAt
    for (const clientTask of clientTasks) {
      const serverTask = serverTaskMap.get(clientTask.id);
      
      if (!serverTask) {
        // New task from client
        await this.create({ ...clientTask, userId });
      } else if (new Date(clientTask.updatedAt) > new Date(serverTask.updatedAt)) {
        // Client has newer version
        await this.update(clientTask.id, userId, clientTask);
      }
    }

    // Return all tasks
    return this.getByUserId(userId);
  }
}

module.exports = TaskService;
