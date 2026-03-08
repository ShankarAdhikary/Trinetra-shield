/**
 * Tasks Routes
 */

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const TaskService = require('../services/taskService');
const logger = require('../services/logger');

const taskService = new TaskService();

// Validation middleware
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * GET /api/tasks
 * Get all tasks for the user
 */
router.get('/', async (req, res, next) => {
  try {
    const tasks = await taskService.getByUserId(req.userId);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', [
  body('text').trim().isLength({ min: 1, max: 500 }).withMessage('Task text required'),
  body('priority').optional().isIn(['low', 'normal', 'high']),
  body('dueDate').optional().isISO8601(),
  handleValidation
], async (req, res, next) => {
  try {
    const { text, priority, dueDate, tags } = req.body;

    const task = await taskService.create({
      id: uuidv4(),
      userId: req.userId,
      text,
      completed: false,
      priority: priority || 'normal',
      dueDate: dueDate || null,
      tags: tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    logger.info('Task created', { userId: req.userId, taskId: task.id });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tasks/:id
 * Get a specific task
 */
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid task ID'),
  handleValidation
], async (req, res, next) => {
  try {
    const task = await taskService.getById(req.params.id, req.userId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/tasks/:id
 * Update a task
 */
router.patch('/:id', [
  param('id').isUUID().withMessage('Invalid task ID'),
  body('text').optional().trim().isLength({ min: 1, max: 500 }),
  body('completed').optional().isBoolean(),
  body('priority').optional().isIn(['low', 'normal', 'high']),
  handleValidation
], async (req, res, next) => {
  try {
    const { text, completed, priority, dueDate, tags } = req.body;

    const task = await taskService.update(req.params.id, req.userId, {
      text,
      completed,
      priority,
      dueDate,
      tags,
      updatedAt: new Date().toISOString(),
      completedAt: completed ? new Date().toISOString() : null
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    logger.info('Task updated', { userId: req.userId, taskId: task.id });

    res.json(task);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete('/:id', [
  param('id').isUUID().withMessage('Invalid task ID'),
  handleValidation
], async (req, res, next) => {
  try {
    const deleted = await taskService.delete(req.params.id, req.userId);

    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }

    logger.info('Task deleted', { userId: req.userId, taskId: req.params.id });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks/sync
 * Sync tasks between client and server
 */
router.post('/sync', async (req, res, next) => {
  try {
    const { tasks: clientTasks } = req.body;

    if (!Array.isArray(clientTasks)) {
      return res.status(400).json({ error: 'Tasks must be an array' });
    }

    const serverTasks = await taskService.getByUserId(req.userId);
    const mergedTasks = await taskService.mergeTasks(req.userId, clientTasks, serverTasks);

    logger.info('Tasks synced', { userId: req.userId, count: mergedTasks.length });

    res.json(mergedTasks);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/tasks
 * Clear completed tasks
 */
router.delete('/', async (req, res, next) => {
  try {
    const deleted = await taskService.clearCompleted(req.userId);

    logger.info('Completed tasks cleared', { userId: req.userId, count: deleted });

    res.json({ success: true, deleted });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
