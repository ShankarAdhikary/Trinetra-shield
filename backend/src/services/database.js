/**
 * Database Service
 * Simple JSON file-based database for development
 * Replace with MongoDB, PostgreSQL, or Firebase in production
 */

const fs = require('fs');
const path = require('path');

const logger = require('./logger');

// Database file path
const DB_PATH = path.join(__dirname, '../../data/db.json');
const DATA_DIR = path.join(__dirname, '../../data');

// Default database structure
const DEFAULT_DB = {
  users: {},
  tasks: {},
  timeData: {},
  settings: {},
  securityLogs: []
};

class Database {
  constructor() {
    this.data = null;
    this.saveTimeout = null;
    this.init();
  }

  /**
   * Initialize database
   */
  init() {
    try {
      // Create data directory if it doesn't exist
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        logger.info('Created data directory');
      }

      // Load existing database or create new one
      if (fs.existsSync(DB_PATH)) {
        const rawData = fs.readFileSync(DB_PATH, 'utf8');
        this.data = JSON.parse(rawData);
        logger.info('Database loaded successfully');
      } else {
        this.data = { ...DEFAULT_DB };
        this.saveSync();
        logger.info('Created new database');
      }
    } catch (error) {
      logger.error('Database initialization failed:', error);
      this.data = { ...DEFAULT_DB };
    }
  }

  /**
   * Save database to file (debounced)
   */
  save() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveSync();
    }, 100);
  }

  /**
   * Save database immediately
   */
  saveSync() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2));
    } catch (error) {
      logger.error('Failed to save database:', error);
    }
  }

  // ============================================
  // USER OPERATIONS
  // ============================================

  /**
   * Get user by ID
   */
  getUserById(id) {
    return this.data.users[id] || null;
  }

  /**
   * Get user by email
   */
  getUserByEmail(email) {
    if (!email) return null;
    return Object.values(this.data.users).find(u => u.email === email) || null;
  }

  /**
   * Get user by phone
   */
  getUserByPhone(phone) {
    if (!phone) return null;
    return Object.values(this.data.users).find(u => u.phone === phone) || null;
  }

  /**
   * Create user
   */
  createUser(user) {
    this.data.users[user.id] = user;
    this.save();
    return user;
  }

  /**
   * Update user
   */
  updateUser(id, updates) {
    if (!this.data.users[id]) return null;
    
    Object.assign(this.data.users[id], updates, {
      updatedAt: new Date().toISOString()
    });
    
    this.save();
    return this.data.users[id];
  }

  /**
   * Delete user
   */
  deleteUser(id) {
    if (!this.data.users[id]) return false;
    
    delete this.data.users[id];
    delete this.data.tasks[id];
    delete this.data.timeData[id];
    delete this.data.settings[id];
    
    this.save();
    return true;
  }

  // ============================================
  // TASK OPERATIONS
  // ============================================

  /**
   * Get tasks for user
   */
  getTasks(userId) {
    return this.data.tasks[userId] || [];
  }

  /**
   * Set tasks for user
   */
  setTasks(userId, tasks) {
    this.data.tasks[userId] = tasks;
    this.save();
    return tasks;
  }

  /**
   * Add task
   */
  addTask(userId, task) {
    if (!this.data.tasks[userId]) {
      this.data.tasks[userId] = [];
    }
    this.data.tasks[userId].push(task);
    this.save();
    return task;
  }

  /**
   * Update task
   */
  updateTask(userId, taskId, updates) {
    if (!this.data.tasks[userId]) return null;
    
    const index = this.data.tasks[userId].findIndex(t => t.id === taskId);
    if (index === -1) return null;

    Object.assign(this.data.tasks[userId][index], updates);
    this.save();
    return this.data.tasks[userId][index];
  }

  /**
   * Delete task
   */
  deleteTask(userId, taskId) {
    if (!this.data.tasks[userId]) return false;
    
    const index = this.data.tasks[userId].findIndex(t => t.id === taskId);
    if (index === -1) return false;

    this.data.tasks[userId].splice(index, 1);
    this.save();
    return true;
  }

  // ============================================
  // TIME DATA OPERATIONS
  // ============================================

  /**
   * Get time data for user
   */
  getTimeData(userId) {
    return this.data.timeData[userId] || {};
  }

  /**
   * Set time data for user
   */
  setTimeData(userId, timeData) {
    this.data.timeData[userId] = timeData;
    this.save();
    return timeData;
  }

  /**
   * Update time for site
   */
  updateSiteTime(userId, date, site, seconds) {
    if (!this.data.timeData[userId]) {
      this.data.timeData[userId] = {};
    }
    if (!this.data.timeData[userId][date]) {
      this.data.timeData[userId][date] = {};
    }
    
    this.data.timeData[userId][date][site] = 
      (this.data.timeData[userId][date][site] || 0) + seconds;
    
    this.save();
    return this.data.timeData[userId][date][site];
  }

  // ============================================
  // SETTINGS OPERATIONS
  // ============================================

  /**
   * Get settings for user
   */
  getSettings(userId) {
    return this.data.settings[userId] || {};
  }

  /**
   * Set settings for user
   */
  setSettings(userId, settings) {
    this.data.settings[userId] = settings;
    this.save();
    return settings;
  }

  // ============================================
  // SECURITY LOGS
  // ============================================

  /**
   * Add security log
   */
  addSecurityLog(log) {
    this.data.securityLogs.push({
      ...log,
      timestamp: new Date().toISOString()
    });

    // Keep only last 1000 logs
    if (this.data.securityLogs.length > 1000) {
      this.data.securityLogs = this.data.securityLogs.slice(-1000);
    }

    this.save();
  }

  /**
   * Get security logs
   */
  getSecurityLogs(limit = 100) {
    return this.data.securityLogs.slice(-limit);
  }

  // ============================================
  // STATS
  // ============================================

  /**
   * Get database stats
   */
  getStats() {
    return {
      users: Object.keys(this.data.users).length,
      tasks: Object.values(this.data.tasks).reduce((sum, t) => sum + t.length, 0),
      securityLogs: this.data.securityLogs.length
    };
  }
}

// Singleton instance
const db = new Database();

module.exports = db;
