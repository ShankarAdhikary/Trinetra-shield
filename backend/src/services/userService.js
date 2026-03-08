/**
 * User Service
 * Handles user data operations
 */

const bcrypt = require('bcryptjs');

const db = require('./database');
const logger = require('./logger');

class UserService {
  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {Promise<object|null>} User object or null
   */
  async findById(id) {
    return db.getUserById(id);
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<object|null>} User object or null
   */
  async findByEmail(email) {
    return db.getUserByEmail(email);
  }

  /**
   * Find user by phone number
   * @param {string} phone - Phone number
   * @returns {Promise<object|null>} User object or null
   */
  async findByPhone(phone) {
    return db.getUserByPhone(phone);
  }

  /**
   * Create a new user
   * @param {object} userData - User data
   * @returns {Promise<object>} Created user
   */
  async create(userData) {
    const user = {
      ...userData,
      settings: {
        securityLevel: 'medium',
        notificationsEnabled: true,
        syncEnabled: true,
        focusModeDefaults: {
          duration: 25,
          breakDuration: 5
        }
      }
    };

    // Hash password if provided
    if (userData.password) {
      user.passwordHash = await bcrypt.hash(userData.password, 12);
      delete user.password;
    }

    db.createUser(user);
    logger.info('User created', { userId: user.id, email: user.email });

    return this.sanitizeUser(user);
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {object} updates - Fields to update
   * @returns {Promise<object|null>} Updated user or null
   */
  async update(id, updates) {
    const user = db.getUserById(id);
    
    if (!user) {
      return null;
    }

    // Don't allow updating sensitive fields directly
    // eslint-disable-next-line no-unused-vars
    const { id: _id, email: _email, passwordHash: _hash, ...safeUpdates } = updates;

    const updated = db.updateUser(id, safeUpdates);
    logger.info('User updated', { userId: id });

    return this.sanitizeUser(updated);
  }

  /**
   * Update user settings
   * @param {string} id - User ID
   * @param {object} settings - Settings to update
   * @returns {Promise<object|null>} Updated user or null
   */
  async updateSettings(id, settings) {
    const user = db.getUserById(id);
    
    if (!user) {
      return null;
    }

    const newSettings = {
      ...user.settings,
      ...settings
    };

    db.updateUser(id, { settings: newSettings });
    logger.info('User settings updated', { userId: id });

    return newSettings;
  }

  /**
   * Verify user password
   * @param {object} user - User object
   * @param {string} password - Password to verify
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(user, password) {
    if (!user.passwordHash) {
      return false;
    }
    return bcrypt.compare(password, user.passwordHash);
  }

  /**
   * Delete user
   * @param {string} id - User ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    const deleted = db.deleteUser(id);
    if (deleted) {
      logger.info('User deleted', { userId: id });
    }
    return deleted;
  }

  /**
   * Export all user data (GDPR compliance)
   * @param {string} id - User ID
   * @returns {Promise<object>} All user data
   */
  async exportUserData(id) {
    const user = db.getUserById(id);
    if (!user) return null;

    const Database = require('./database');
    const TaskService = require('./taskService');
    const TimeService = require('./timeService');

    const taskService = new TaskService();
    const timeService = new TimeService();

    const tasks = await taskService.getByUserId(id);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    const timeData = await timeService.getByDateRange(
      id,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    return {
      user: this.sanitizeUser(user),
      tasks,
      timeData,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Remove sensitive fields from user object
   * @param {object} user - User object
   * @returns {object} Sanitized user
   */
  sanitizeUser(user) {
    if (!user) return null;
    // eslint-disable-next-line no-unused-vars
    const { passwordHash: _hash, ...sanitized } = user;
    return sanitized;
  }
}

module.exports = UserService;
