/**
 * Sync Routes
 * Handles data synchronization between extension and backend
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const TaskService = require('../services/taskService');
const TimeService = require('../services/timeService');
const UserService = require('../services/userService');
const logger = require('../services/logger');

const taskService = new TaskService();
const timeService = new TimeService();
const userService = new UserService();

// Validation middleware
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * POST /api/sync
 * Full sync - upload and download all data
 */
router.post('/', [
  body('tasks').optional().isArray(),
  body('timeData').optional().isArray(),
  body('settings').optional().isObject(),
  body('lastSyncTime').optional().isISO8601(),
  handleValidation
], async (req, res, next) => {
  try {
    const { tasks, timeData, settings, lastSyncTime } = req.body;
    const userId = req.userId;

    const result = {
      tasks: [],
      timeData: [],
      settings: {},
      syncTime: new Date().toISOString()
    };

    // Sync tasks
    if (tasks && tasks.length > 0) {
      result.tasks = await taskService.syncTasks(userId, tasks);
    } else {
      result.tasks = await taskService.getByUserId(userId);
    }

    // Sync time data
    if (timeData && timeData.length > 0) {
      await timeService.syncTimeData(userId, timeData);
    }

    // Get time data for last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    result.timeData = await timeService.getByDateRange(
      userId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Sync settings
    if (settings) {
      result.settings = await userService.updateSettings(userId, settings);
    } else {
      const user = await userService.findById(userId);
      result.settings = user?.settings || {};
    }

    logger.info('Full sync completed', { userId });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sync/tasks
 * Sync tasks only
 */
router.post('/tasks', [
  body('tasks').isArray().withMessage('Tasks array required'),
  handleValidation
], async (req, res, next) => {
  try {
    const { tasks } = req.body;
    const userId = req.userId;

    const syncedTasks = await taskService.syncTasks(userId, tasks);

    logger.info('Tasks synced', { userId, count: tasks.length });

    res.json({ 
      tasks: syncedTasks,
      syncTime: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sync/time
 * Sync time tracking data only
 */
router.post('/time', [
  body('timeData').isArray().withMessage('Time data array required'),
  handleValidation
], async (req, res, next) => {
  try {
    const { timeData } = req.body;
    const userId = req.userId;

    await timeService.syncTimeData(userId, timeData);

    logger.info('Time data synced', { userId, days: timeData.length });

    res.json({ 
      success: true,
      syncTime: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sync/settings
 * Sync settings only
 */
router.post('/settings', [
  body('settings').isObject().withMessage('Settings object required'),
  handleValidation
], async (req, res, next) => {
  try {
    const { settings } = req.body;
    const userId = req.userId;

    const updatedSettings = await userService.updateSettings(userId, settings);

    logger.info('Settings synced', { userId });

    res.json({ 
      settings: updatedSettings,
      syncTime: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sync/status
 * Get sync status
 */
router.get('/status', async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await userService.findById(userId);

    res.json({
      lastSync: user?.lastSyncTime || null,
      syncEnabled: user?.settings?.syncEnabled ?? true,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
