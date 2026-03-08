/**
 * User Route Tests
 */

const express = require('express');
const request = require('supertest');

// Shared mock state accessible from both the mock factory and tests
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  settings: { theme: 'light' }
};

jest.mock('../../src/services/userService', () => {
  return jest.fn().mockImplementation(() => ({
    findById: jest.fn(() => ({ ...mockUser })),
    update: jest.fn((id, updates) => {
      Object.assign(mockUser, updates);
      return { ...mockUser };
    }),
    updateSettings: jest.fn((id, settings) => {
      mockUser.settings = { ...mockUser.settings, ...settings };
      return { ...mockUser };
    }),
    exportUserData: jest.fn(() => ({
      user: { ...mockUser },
      tasks: [],
      timeData: []
    })),
    delete: jest.fn(() => true)
  }));
});

const userRoutes = require('../../src/routes/user');

describe('User Routes', () => {
  let app;
  const testUserId = 'user-123';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.userId = testUserId; next(); });
    app.use('/api/user', userRoutes);
    // Reset mock user state
    mockUser.name = 'Test User';
    mockUser.settings = { theme: 'light' };
  });

  describe('GET /api/user/profile', () => {
    it('should return user profile', async () => {
      const res = await request(app).get('/api/user/profile');
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('test@example.com');
    });
  });

  describe('PATCH /api/user/profile', () => {
    it('should update user name', async () => {
      const res = await request(app)
        .patch('/api/user/profile')
        .send({ name: 'Updated Name' });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/user/settings', () => {
    it('should return user settings', async () => {
      const res = await request(app).get('/api/user/settings');
      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/user/settings', () => {
    it('should update user settings', async () => {
      const res = await request(app)
        .put('/api/user/settings')
        .send({ theme: 'dark', securityLevel: 'high' });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/user/data', () => {
    it('should export user data', async () => {
      const res = await request(app).get('/api/user/data');
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/user/account', () => {
    it('should delete user account', async () => {
      const res = await request(app)
        .delete('/api/user/account')
        .send({ confirm: true });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
