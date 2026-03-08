/**
 * Auth Middleware Tests
 */

const jwt = require('jsonwebtoken');

// Set JWT_SECRET before requiring auth middleware
const TEST_JWT_SECRET = 'test-secret-key-for-testing';
process.env.JWT_SECRET = TEST_JWT_SECRET;

const { authenticate, optionalAuth } = require('../../src/middleware/auth');

describe('Auth Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  describe('authenticate', () => {
    it('should reject requests without authorization header', () => {
      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No authorization header provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid authorization format', () => {
      req.headers.authorization = 'InvalidFormat token123';

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid authorization format. Use: Bearer <token>' });
    });

    it('should reject single word authorization', () => {
      req.headers.authorization = 'token123';

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject invalid tokens', () => {
      req.headers.authorization = 'Bearer invalid-token';

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });

    it('should reject expired tokens', () => {
      const expiredToken = jwt.sign(
        { userId: 'user123', email: 'test@example.com' },
        TEST_JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );
      req.headers.authorization = `Bearer ${expiredToken}`;

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
    });

    it('should accept valid tokens and attach user info', () => {
      const validToken = jwt.sign(
        { userId: 'user123', email: 'test@example.com' },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
      );
      req.headers.authorization = `Bearer ${validToken}`;

      authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.userId).toBe('user123');
      expect(req.userEmail).toBe('test@example.com');
    });
  });

  describe('optionalAuth', () => {
    it('should continue without authorization header', () => {
      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.userId).toBeUndefined();
    });

    it('should continue with invalid format without error', () => {
      req.headers.authorization = 'InvalidFormat';

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.userId).toBeUndefined();
    });

    it('should continue with invalid token without error', () => {
      req.headers.authorization = 'Bearer invalid-token';

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.userId).toBeUndefined();
    });

    it('should attach user info for valid token', () => {
      const validToken = jwt.sign(
        { userId: 'user123', email: 'test@example.com' },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
      );
      req.headers.authorization = `Bearer ${validToken}`;

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.userId).toBe('user123');
      expect(req.userEmail).toBe('test@example.com');
    });
  });
});
