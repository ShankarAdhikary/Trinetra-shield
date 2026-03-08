/**
 * Time Tracking Route Tests
 */

const express = require('express');
const request = require('supertest');

// Mock TimeService
jest.mock('../../src/services/timeService', () => {
  const timeData = [];
  return jest.fn().mockImplementation(() => ({
    getByDateRange: jest.fn((userId, start, end) => timeData.filter(t => t.userId === userId)),
    save: jest.fn((userId, date, sites) => { timeData.push({ userId, date, sites }); }),
    getSummary: jest.fn((userId, days) => ({
      totalTime: 3600000,
      dailyAverage: 514285,
      daysTracked: days,
      topDomain: 'github.com'
    })),
    getTopSites: jest.fn((userId, limit, days) => [
      { domain: 'github.com', time: 1800000 },
      { domain: 'stackoverflow.com', time: 900000 }
    ]),
    clear: jest.fn()
  }));
});

const timeRoutes = require('../../src/routes/time');

describe('Time Tracking Routes', () => {
  let app;
  const testUserId = 'user-123';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.userId = testUserId; next(); });
    app.use('/api/time', timeRoutes);
  });

  describe('GET /api/time', () => {
    it('should return time data without date params', async () => {
      const res = await request(app).get('/api/time');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should accept valid date range', async () => {
      const res = await request(app)
        .get('/api/time')
        .query({ startDate: '2025-01-01', endDate: '2025-01-31' });

      expect(res.status).toBe(200);
    });

    it('should reject invalid date format', async () => {
      const res = await request(app)
        .get('/api/time')
        .query({ startDate: 'not-a-date' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/time', () => {
    it('should submit time data', async () => {
      const res = await request(app)
        .post('/api/time')
        .send({
          date: '2025-01-15T00:00:00.000Z',
          sites: [{ domain: 'github.com', time: 1800000 }]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject missing date', async () => {
      const res = await request(app)
        .post('/api/time')
        .send({ sites: [] });

      expect(res.status).toBe(400);
    });

    it('should reject missing sites', async () => {
      const res = await request(app)
        .post('/api/time')
        .send({ date: '2025-01-15T00:00:00.000Z' });

      expect(res.status).toBe(400);
    });

    it('should reject non-array sites', async () => {
      const res = await request(app)
        .post('/api/time')
        .send({ date: '2025-01-15T00:00:00.000Z', sites: 'not-array' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/time/summary', () => {
    it('should return summary with default days', async () => {
      const res = await request(app).get('/api/time/summary');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalTime');
      expect(res.body).toHaveProperty('dailyAverage');
      expect(res.body).toHaveProperty('daysTracked');
    });

    it('should accept custom days parameter', async () => {
      const res = await request(app)
        .get('/api/time/summary')
        .query({ days: 30 });

      expect(res.status).toBe(200);
      expect(res.body.daysTracked).toBe(30);
    });

    it('should reject invalid days value', async () => {
      const res = await request(app)
        .get('/api/time/summary')
        .query({ days: 0 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/time/top-sites', () => {
    it('should return top sites with defaults', async () => {
      const res = await request(app).get('/api/time/top-sites');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('domain');
      expect(res.body[0]).toHaveProperty('time');
    });

    it('should accept limit and days params', async () => {
      const res = await request(app)
        .get('/api/time/top-sites')
        .query({ limit: 5, days: 14 });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/time', () => {
    it('should clear time data', async () => {
      const res = await request(app).delete('/api/time');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should accept before date param', async () => {
      const res = await request(app)
        .delete('/api/time')
        .query({ before: '2025-01-01T00:00:00.000Z' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
