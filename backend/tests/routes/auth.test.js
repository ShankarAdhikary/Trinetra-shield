/**
 * Auth Route Tests
 */

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Set env before requiring modules
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.NODE_ENV = 'test';

const authRoutes = require('../../src/routes/auth');

describe('Auth Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ error: err.message });
    });
  });

  describe('POST /api/auth/signup', () => {
    it('should reject signup without email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ password: 'ValidPass1' });

      expect(res.status).toBe(400);
    });

    it('should reject signup with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'not-an-email', password: 'ValidPass1' });

      expect(res.status).toBe(400);
    });

    it('should reject signup with weak password (no uppercase)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'weakpass1' });

      expect(res.status).toBe(400);
    });

    it('should reject signup with weak password (no number)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'WeakPasss' });

      expect(res.status).toBe(400);
    });

    it('should reject signup with short password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'Sh1' });

      expect(res.status).toBe(400);
    });

    it('should accept signup with valid credentials', async () => {
      const uniqueEmail = `newuser-${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: uniqueEmail,
          password: 'ValidPass1',
          name: 'Test User'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.email).toBe(uniqueEmail);
      expect(res.body.token).toBeDefined();
    });

    it('should reject duplicate email signup', async () => {
      const dupeEmail = `dupe-${Date.now()}@example.com`;
      // First signup
      await request(app)
        .post('/api/auth/signup')
        .send({ email: dupeEmail, password: 'ValidPass1' });

      // Duplicate signup
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: dupeEmail, password: 'ValidPass1' });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    const loginEmail = `login-${Date.now()}@example.com`;

    beforeEach(async () => {
      // Create a user first
      await request(app)
        .post('/api/auth/signup')
        .send({ email: loginEmail, password: 'ValidPass1', name: 'Login User' });
    });

    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginEmail, password: 'ValidPass1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    it('should reject incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginEmail, password: 'WrongPass1' });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'ValidPass1' });

      expect(res.status).toBe(401);
    });

    it('should reject login without password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginEmail });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/phone/send-otp', () => {
    it('should accept valid phone number', async () => {
      const res = await request(app)
        .post('/api/auth/phone/send-otp')
        .send({ phone: '+1234567890' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject invalid phone number', async () => {
      const res = await request(app)
        .post('/api/auth/phone/send-otp')
        .send({ phone: '123' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/phone/verify-otp', () => {
    it('should reject invalid OTP format', async () => {
      const res = await request(app)
        .post('/api/auth/phone/verify-otp')
        .send({ phone: '+1234567890', otp: '12' });

      expect(res.status).toBe(400);
    });

    it('should reject non-numeric OTP', async () => {
      const res = await request(app)
        .post('/api/auth/phone/verify-otp')
        .send({ phone: '+1234567890', otp: 'abcdef' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should reject without token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh');

      expect(res.status).toBe(401);
    });

    it('should refresh a valid token', async () => {
      const token = jwt.sign(
        { userId: 'user123', email: 'test@example.com' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('should reject an invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should acknowledge logout', async () => {
      const res = await request(app)
        .post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should reject without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should return user info with valid token', async () => {
      // Create user first
      const meEmail = `me-${Date.now()}@example.com`;
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({ email: meEmail, password: 'ValidPass1', name: 'Me User' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${signupRes.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(meEmail);
    });
  });

  describe('GET /api/auth/config', () => {
    it('should return auth configuration', async () => {
      const res = await request(app)
        .get('/api/auth/config');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('captcha');
      expect(res.body).toHaveProperty('providers');
      expect(res.body.providers).toHaveProperty('email', true);
      expect(res.body.providers).toHaveProperty('phone', true);
    });
  });
});
