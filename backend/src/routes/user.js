/**
 * User Routes
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const UserService = require('../services/userService');
const logger = require('../services/logger');

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
 * GET /api/user/profile
 * Get current user profile
 */
router.get('/profile', async (req, res, next) => {
  try {
    const user = await userService.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      settings: user.settings || {}
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/user/profile
 * Update user profile
 */
router.patch('/profile', [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  handleValidation
], async (req, res, next) => {
  try {
    const { name } = req.body;

    const user = await userService.update(req.userId, { name });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User profile updated', { userId: req.userId });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/user/settings
 * Get user settings
 */
router.get('/settings', async (req, res, next) => {
  try {
    const user = await userService.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.settings || {});
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/user/settings
 * Update user settings
 */
router.put('/settings', async (req, res, next) => {
  try {
    const settings = req.body;

    const user = await userService.updateSettings(req.userId, settings);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User settings updated', { userId: req.userId });

    res.json(user.settings);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/user/account
 * Delete user account
 */
router.delete('/account', async (req, res, next) => {
  try {
    await userService.delete(req.userId);

    logger.info('User account deleted', { userId: req.userId });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/user/data
 * Export all user data (GDPR compliance)
 */
router.get('/data', async (req, res, next) => {
  try {
    const userData = await userService.exportUserData(req.userId);

    res.json(userData);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
