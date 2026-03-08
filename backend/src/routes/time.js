/**
 * Time Tracking Routes
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');

const TimeService = require('../services/timeService');
const logger = require('../services/logger');

const timeService = new TimeService();

// Validation middleware
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * GET /api/time
 * Get time tracking data for a date range
 */
router.get('/', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  handleValidation
], async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || start;

    const data = await timeService.getByDateRange(req.userId, start, end);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/time
 * Submit time tracking data
 */
router.post('/', [
  body('date').isISO8601().withMessage('Valid date required'),
  body('sites').isArray().withMessage('Sites must be an array'),
  handleValidation
], async (req, res, next) => {
  try {
    const { date, sites } = req.body;

    await timeService.save(req.userId, date, sites);

    logger.info('Time data submitted', { userId: req.userId, date });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/time/summary
 * Get time tracking summary
 */
router.get('/summary', [
  query('days').optional().isInt({ min: 1, max: 365 }),
  handleValidation
], async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;

    const summary = await timeService.getSummary(req.userId, days);

    res.json(summary);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/time/top-sites
 * Get top sites by time spent
 */
router.get('/top-sites', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('days').optional().isInt({ min: 1, max: 365 }),
  handleValidation
], async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const days = parseInt(req.query.days) || 30;

    const topSites = await timeService.getTopSites(req.userId, limit, days);

    res.json(topSites);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/time
 * Clear time tracking data
 */
router.delete('/', [
  query('before').optional().isISO8601(),
  handleValidation
], async (req, res, next) => {
  try {
    const before = req.query.before;

    await timeService.clear(req.userId, before);

    logger.info('Time data cleared', { userId: req.userId, before });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
