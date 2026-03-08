/**
 * AuthService Tests
 */

import { AuthService } from '../../src/api/authService.js';

// Mock ApiClient
jest.mock('../../src/api/apiClient.js', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    post: jest.fn().mockResolvedValue({}),
    get: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({})
  }))
}));

// Mock StorageService
jest.mock('../../src/utils/storageService.js', () => ({
  StorageService: jest.fn().mockImplementation(() => {
    const data = {};
    return {
      get: jest.fn((key) => Promise.resolve(data[key] || null)),
      set: jest.fn((key, value) => { data[key] = value; return Promise.resolve(); }),
      remove: jest.fn((key) => { delete data[key]; return Promise.resolve(); }),
      clear: jest.fn(() => { Object.keys(data).forEach(k => delete data[k]); return Promise.resolve(); })
    };
  })
}));

describe('AuthService', () => {
  let auth;

  beforeEach(() => {
    auth = new AuthService();
  });

  describe('getClientId', () => {
    it('should return placeholder when not in extension context', () => {
      const clientId = auth.getClientId();
      expect(clientId).toContain('apps.googleusercontent.com');
    });
  });

  describe('getCurrentUser', () => {
    it('should return null when no auth stored', async () => {
      const user = await auth.getCurrentUser();
      expect(user).toBeNull();
    });

    it('should return user when authenticated', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      auth.storage.get.mockResolvedValue({
        user: mockUser,
        token: 'token',
        expiresAt: Date.now() + 86400000
      });

      const user = await auth.getCurrentUser();
      expect(user).toEqual(mockUser);
    });

    it('should attempt refresh when token expired', async () => {
      auth.storage.get.mockResolvedValue({
        user: { id: '1' },
        token: 'old-token',
        expiresAt: Date.now() - 1000 // expired
      });
      const spy = jest.spyOn(auth, 'refreshToken').mockResolvedValue(false);

      const user = await auth.getCurrentUser();
      expect(spy).toHaveBeenCalled();
      expect(user).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no user', async () => {
      const result = await auth.isAuthenticated();
      expect(result).toBe(false);
    });

    it('should return true when user exists', async () => {
      jest.spyOn(auth, 'getCurrentUser').mockResolvedValue({ id: '1' });
      const result = await auth.isAuthenticated();
      expect(result).toBe(true);
    });
  });

  describe('logout', () => {
    it('should clear auth state', async () => {
      auth.storage.get.mockResolvedValue({ token: 'token', provider: 'email' });
      auth.api.post.mockResolvedValue({});

      await auth.logout();
      expect(auth.storage.remove).toHaveBeenCalledWith('auth');
    });

    it('should notify backend on logout', async () => {
      auth.storage.get.mockResolvedValue({ token: 'token', provider: 'email' });
      auth.api.post.mockResolvedValue({});

      await auth.logout();
      expect(auth.api.post).toHaveBeenCalledWith('/api/auth/logout');
    });
  });

  describe('refreshToken', () => {
    it('should update token on success', async () => {
      auth.storage.get.mockResolvedValue({ token: 'old-token' });
      auth.api.post.mockResolvedValue({ token: 'new-token' });

      const result = await auth.refreshToken();
      expect(result).toBe(true);
      expect(auth.storage.set).toHaveBeenCalledWith('auth', expect.objectContaining({ token: 'new-token' }));
    });

    it('should return false when no token stored', async () => {
      auth.storage.get.mockResolvedValue(null);
      const result = await auth.refreshToken();
      expect(result).toBe(false);
    });

    it('should logout on refresh failure', async () => {
      auth.storage.get.mockResolvedValue({ token: 'old-token' });
      auth.api.post.mockRejectedValue(new Error('Refresh failed'));
      const spy = jest.spyOn(auth, 'logout').mockResolvedValue();

      const result = await auth.refreshToken();
      expect(result).toBe(false);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('signupWithEmail', () => {
    it('should save auth state on successful signup', async () => {
      auth.api.post.mockResolvedValue({
        success: true,
        user: { id: '1', email: 'test@example.com' },
        token: 'new-token'
      });

      const user = await auth.signupWithEmail('test@example.com', 'Password1!', 'Test');
      expect(user.email).toBe('test@example.com');
      expect(auth.storage.set).toHaveBeenCalledWith('auth', expect.objectContaining({
        provider: 'email'
      }));
    });

    it('should throw on signup failure', async () => {
      auth.api.post.mockResolvedValue({ success: false, error: 'Email taken' });
      await expect(auth.signupWithEmail('test@example.com', 'password')).rejects.toThrow('Email taken');
    });
  });

  describe('loginWithEmail', () => {
    it('should save auth state on successful login', async () => {
      auth.api.post.mockResolvedValue({
        success: true,
        user: { id: '1', email: 'test@example.com' },
        token: 'login-token'
      });

      const user = await auth.loginWithEmail('test@example.com', 'Password1!');
      expect(user.email).toBe('test@example.com');
    });

    it('should throw on login failure', async () => {
      auth.api.post.mockResolvedValue({ success: false, error: 'Invalid credentials' });
      await expect(auth.loginWithEmail('test@example.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('sendOTP', () => {
    it('should send OTP to phone number', async () => {
      auth.api.post.mockResolvedValue({ success: true, message: 'OTP sent' });

      const result = await auth.sendOTP('+919876543210');
      expect(auth.api.post).toHaveBeenCalledWith('/api/auth/phone/send-otp', expect.objectContaining({
        phone: '+919876543210'
      }));
    });
  });

  describe('deleteAccount', () => {
    it('should delete account and clear storage', async () => {
      auth.api.delete.mockResolvedValue({});

      await auth.deleteAccount();
      expect(auth.api.delete).toHaveBeenCalledWith('/api/user/account');
      expect(auth.storage.clear).toHaveBeenCalled();
    });
  });

  describe('saveAuthState', () => {
    it('should store user, token, and provider', async () => {
      const user = { id: '1' };
      await auth.saveAuthState(user, 'token-123', 'google');

      expect(auth.storage.set).toHaveBeenCalledWith('auth', {
        user,
        token: 'token-123',
        provider: 'google',
        expiresAt: expect.any(Number)
      });
    });
  });
});
