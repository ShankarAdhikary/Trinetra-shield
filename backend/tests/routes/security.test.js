/**
 * Security Route Tests
 */

const express = require('express');
const request = require('supertest');

// Mock the database before requiring routes
jest.mock('../../src/services/database', () => {
  const logs = [];
  return jest.fn().mockImplementation(() => ({
    addSecurityLog: jest.fn((log) => logs.push(log)),
    getSecurityLogs: jest.fn(() => logs)
  }));
});

const securityRoutes = require('../../src/routes/security');

describe('Security Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/security', securityRoutes);
  });

  describe('GET /api/security/check', () => {
    it('should return safe for normal URLs', async () => {
      const res = await request(app)
        .get('/api/security/check')
        .query({ url: 'https://google.com' });

      expect(res.status).toBe(200);
      expect(res.body.safe).toBe(true);
    });

    it('should detect known phishing domains', async () => {
      const res = await request(app)
        .get('/api/security/check')
        .query({ url: 'https://login-secure.tk/page' });

      expect(res.status).toBe(200);
      expect(res.body.safe).toBe(false);
      expect(res.body.threat).toBe('phishing');
      expect(res.body.confidence).toBeGreaterThanOrEqual(95);
    });

    it('should detect suspicious TLDs', async () => {
      const res = await request(app)
        .get('/api/security/check')
        .query({ url: 'https://example.tk' });

      expect(res.status).toBe(200);
      expect(res.body.details).toEqual(
        expect.arrayContaining([expect.stringContaining('.tk')])
      );
    });

    it('should detect lookalike domains', async () => {
      const res = await request(app)
        .get('/api/security/check')
        .query({ url: 'https://paypa1.com/login' });

      expect(res.status).toBe(200);
      expect(res.body.safe).toBe(false);
      expect(res.body.threat).toBe('lookalike_domain');
    });

    it('should detect IP address URLs', async () => {
      const res = await request(app)
        .get('/api/security/check')
        .query({ url: 'http://192.168.1.1/admin' });

      expect(res.status).toBe(200);
      expect(res.body.details).toEqual(
        expect.arrayContaining([expect.stringContaining('IP address')])
      );
    });

    it('should detect excessive subdomains', async () => {
      const res = await request(app)
        .get('/api/security/check')
        .query({ url: 'https://a.b.c.d.e.example.com' });

      expect(res.status).toBe(200);
      expect(res.body.details).toEqual(
        expect.arrayContaining([expect.stringContaining('subdomains')])
      );
    });

    it('should reject invalid URLs', async () => {
      const res = await request(app)
        .get('/api/security/check')
        .query({ url: 'not-a-url' });

      expect(res.status).toBe(400);
    });

    it('should require url parameter', async () => {
      const res = await request(app)
        .get('/api/security/check');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/security/report', () => {
    it('should accept a valid report', async () => {
      const res = await request(app)
        .post('/api/security/report')
        .send({
          url: 'https://phishing-site.com',
          type: 'phishing',
          description: 'Looks like a fake login page'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject reports with invalid type', async () => {
      const res = await request(app)
        .post('/api/security/report')
        .send({
          url: 'https://example.com',
          type: 'invalid_type'
        });

      expect(res.status).toBe(400);
    });

    it('should reject reports without URL', async () => {
      const res = await request(app)
        .post('/api/security/report')
        .send({
          type: 'phishing'
        });

      expect(res.status).toBe(400);
    });

    it('should accept report with all valid types', async () => {
      for (const type of ['phishing', 'malware', 'scam', 'other']) {
        const res = await request(app)
          .post('/api/security/report')
          .send({
            url: 'https://example.com',
            type
          });
        expect(res.status).toBe(200);
      }
    });
  });

  describe('GET /api/security/stats', () => {
    it('should return security statistics', async () => {
      const res = await request(app)
        .get('/api/security/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('threatsBlockedToday');
      expect(res.body).toHaveProperty('threatsBlockedWeek');
      expect(res.body).toHaveProperty('threatsBlockedMonth');
      expect(res.body).toHaveProperty('lastUpdated');
    });
  });

  describe('POST /api/security/batch-check', () => {
    it('should check multiple URLs', async () => {
      const res = await request(app)
        .post('/api/security/batch-check')
        .send({
          urls: ['https://google.com', 'https://example.com']
        });

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0]).toHaveProperty('safe');
      expect(res.body.results[1]).toHaveProperty('safe');
    });

    it('should detect mixed safe and unsafe URLs', async () => {
      const res = await request(app)
        .post('/api/security/batch-check')
        .send({
          urls: ['https://google.com', 'https://login-secure.tk/page']
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0].safe).toBe(true);
      expect(res.body.results[1].safe).toBe(false);
    });

    it('should reject empty URL array', async () => {
      const res = await request(app)
        .post('/api/security/batch-check')
        .send({ urls: [] });

      expect(res.status).toBe(400);
    });

    it('should reject more than 50 URLs', async () => {
      const urls = Array(51).fill('https://example.com');
      const res = await request(app)
        .post('/api/security/batch-check')
        .send({ urls });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/security/blocklist', () => {
    it('should return blocklist with domains', async () => {
      const res = await request(app)
        .get('/api/security/blocklist');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('domains');
      expect(Array.isArray(res.body.domains)).toBe(true);
      expect(res.body).toHaveProperty('updatedAt');
      expect(res.body).toHaveProperty('version');
    });

    it('should include known phishing domains', async () => {
      const res = await request(app)
        .get('/api/security/blocklist');

      expect(res.body.domains).toEqual(
        expect.arrayContaining(['login-secure.tk', 'account-verify.ml'])
      );
    });
  });
});
