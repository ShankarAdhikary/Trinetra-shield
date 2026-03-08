/**
 * Auth Service
 * Handles user authentication with Email, Phone, and Google OAuth
 */

import { StorageService } from '../utils/storageService.js';

import { ApiClient } from './apiClient.js';

export class AuthService {
  constructor() {
    this.api = new ApiClient();
    this.storage = new StorageService();
    
    // OAuth configuration
    // Set GOOGLE_CLIENT_ID in manifest.json oauth2 section before deploying
    this.config = {
      clientId: this.getClientId(),
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      redirectUri: typeof chrome !== 'undefined' && chrome.identity 
        ? chrome.identity.getRedirectURL() 
        : 'https://localhost',
      scopes: ['openid', 'email', 'profile']
    };
  }

  /**
   * Get Google Client ID from manifest.json oauth2 config
   */
  getClientId() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
        const manifest = chrome.runtime.getManifest();
        if (manifest.oauth2 && manifest.oauth2.client_id) {
          return manifest.oauth2.client_id;
        }
      }
    } catch (e) {
      // Ignore — running outside extension context
    }
    return 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
  }

  // ============================================
  // COMMON METHODS
  // ============================================

  /**
   * Get current authenticated user
   * @returns {Promise<object|null>} User object or null
   */
  async getCurrentUser() {
    try {
      const auth = await this.storage.get('auth');
      
      if (!auth || !auth.user) {
        return null;
      }

      // Check if token is expired
      if (auth.expiresAt && Date.now() > auth.expiresAt) {
        // Try to refresh token
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          return null;
        }
      }

      return auth.user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  /**
   * Sign out
   */
  async logout() {
    try {
      const auth = await this.storage.get('auth');
      
      // Revoke OAuth token if Google login
      if (auth?.provider === 'google' && auth?.token) {
        await this.revokeGoogleToken(auth.token);
      }

      // Notify backend
      try {
        await this.api.post('/api/auth/logout');
      } catch (e) {
        // Ignore if backend unavailable
      }

      // Clear local auth state
      await this.storage.remove('auth');

      return true;
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Get auth token for API requests
   * @returns {Promise<string|null>}
   */
  async getToken() {
    const auth = await this.storage.get('auth');
    return auth?.token || null;
  }

  /**
   * Refresh auth token
   */
  async refreshToken() {
    try {
      const auth = await this.storage.get('auth');
      if (!auth?.token) {
        return false;
      }

      const response = await this.api.post('/api/auth/refresh');
      
      if (response.token) {
        auth.token = response.token;
        auth.expiresAt = Date.now() + 7 * 24 * 3600 * 1000; // 7 days
        await this.storage.set('auth', auth);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await this.logout();
      return false;
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount() {
    try {
      await this.api.delete('/api/user/account');
      await this.storage.clear();
      return true;
    } catch (error) {
      console.error('Delete account failed:', error);
      throw error;
    }
  }

  /**
   * Save auth state locally
   */
  async saveAuthState(user, token, provider) {
    await this.storage.set('auth', {
      user,
      token,
      provider,
      expiresAt: Date.now() + 7 * 24 * 3600 * 1000 // 7 days
    });
  }

  // ============================================
  // EMAIL/PASSWORD AUTHENTICATION
  // ============================================

  /**
   * Sign up with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} name - User name (optional)
   * @param {string} captchaToken - CAPTCHA token (optional)
   * @returns {Promise<object>} User object
   */
  async signupWithEmail(email, password, name = '', captchaToken = null) {
    try {
      const response = await this.api.post('/api/auth/signup', {
        email,
        password,
        name,
        captchaToken
      });

      if (response.success) {
        await this.saveAuthState(response.user, response.token, 'email');
        return response.user;
      }

      throw new Error(response.error || 'Signup failed');
    } catch (error) {
      console.error('Email signup failed:', error);
      throw error;
    }
  }

  /**
   * Login with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} captchaToken - CAPTCHA token (optional)
   * @returns {Promise<object>} User object
   */
  async loginWithEmail(email, password, captchaToken = null) {
    try {
      const response = await this.api.post('/api/auth/login', {
        email,
        password,
        captchaToken
      });

      if (response.success) {
        await this.saveAuthState(response.user, response.token, 'email');
        return response.user;
      }

      throw new Error(response.error || 'Login failed');
    } catch (error) {
      console.error('Email login failed:', error);
      throw error;
    }
  }

  // ============================================
  // PHONE/OTP AUTHENTICATION
  // ============================================

  /**
   * Send OTP to phone number
   * @param {string} phone - Phone number with country code
   * @param {string} captchaToken - CAPTCHA token (optional)
   * @returns {Promise<object>} Response with success message
   */
  async sendOTP(phone, captchaToken = null) {
    try {
      const response = await this.api.post('/api/auth/phone/send-otp', {
        phone,
        captchaToken
      });

      return {
        success: response.success,
        message: response.message,
        // OTP is returned only in development mode
        otp: response.otp
      };
    } catch (error) {
      console.error('Send OTP failed:', error);
      throw error;
    }
  }

  /**
   * Verify OTP and login/register
   * @param {string} phone - Phone number
   * @param {string} otp - OTP code
   * @param {string} name - User name (for new users)
   * @returns {Promise<object>} User object
   */
  async verifyOTP(phone, otp, name = '') {
    try {
      const response = await this.api.post('/api/auth/phone/verify-otp', {
        phone,
        otp,
        name
      });

      if (response.success) {
        await this.saveAuthState(response.user, response.token, 'phone');
        return {
          user: response.user,
          isNewUser: response.isNewUser
        };
      }

      throw new Error(response.error || 'OTP verification failed');
    } catch (error) {
      console.error('OTP verification failed:', error);
      throw error;
    }
  }

  // ============================================
  // GOOGLE OAUTH AUTHENTICATION
  // ============================================

  /**
   * Login with Google OAuth
   * @returns {Promise<object>} User object
   */
  async loginWithGoogle() {
    try {
      // Get OAuth token using Chrome identity API
      const token = await this.getGoogleOAuthToken(true);
      
      if (!token) {
        throw new Error('Failed to get Google OAuth token');
      }

      // Fetch user info from Google
      const userInfo = await this.fetchGoogleUserInfo(token);

      // Authenticate with backend
      const response = await this.api.post('/api/auth/google', {
        token,
        email: userInfo.email,
        name: userInfo.name,
        providerId: userInfo.id,
        picture: userInfo.picture
      });

      if (response.success) {
        await this.saveAuthState(response.user, response.token, 'google');
        return {
          user: response.user,
          isNewUser: response.isNewUser
        };
      }

      throw new Error(response.error || 'Google login failed');
    } catch (error) {
      console.error('Google login failed:', error);
      throw error;
    }
  }

  /**
   * Get Google OAuth token using Chrome identity API
   * @param {boolean} interactive - Whether to show login prompt
   * @returns {Promise<string|null>} OAuth token
   */
  async getGoogleOAuthToken(interactive = true) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.identity) {
        reject(new Error('Chrome identity API not available'));
        return;
      }

      // Check if OAuth is configured
      if (this.config.clientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
        reject(new Error('Google OAuth not configured. Please set up a Google Cloud project and add your Client ID to manifest.json'));
        return;
      }

      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('OAuth error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message || 'Google sign-in failed. Please try Email or Phone login.'));
        } else {
          resolve(token);
        }
      });
    });
  }

  /**
   * Fetch user info from Google API
   * @param {string} token - OAuth token
   * @returns {Promise<object>} User info
   */
  async fetchGoogleUserInfo(token) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Google user info');
    }

    const data = await response.json();

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      picture: data.picture,
      verified: data.verified_email
    };
  }

  /**
   * Revoke Google OAuth token
   * @param {string} token - Token to revoke
   */
  async revokeGoogleToken(token) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.identity) {
        resolve();
        return;
      }

      chrome.identity.removeCachedAuthToken({ token }, () => {
        resolve();
      });
    });
  }

  /**
   * Launch OAuth flow in a new window (alternative method)
   * Use this if chrome.identity.getAuthToken is not available
   */
  async launchGoogleOAuthFlow() {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'token',
      scope: this.config.scopes.join(' ')
    });

    const authUrl = `${this.config.authUrl}?${params.toString()}`;

    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.identity) {
        reject(new Error('Chrome identity API not available'));
        return;
      }

      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true
        },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          // Parse token from redirect URL
          const url = new URL(redirectUrl);
          const hash = url.hash.substring(1);
          const params = new URLSearchParams(hash);
          const token = params.get('access_token');

          if (token) {
            resolve(token);
          } else {
            reject(new Error('No token in response'));
          }
        }
      );
    });
  }

  // ============================================
  // BACKWARDS COMPATIBILITY
  // ============================================

  /**
   * Generic login (defaults to Google)
   * @deprecated Use loginWithGoogle(), loginWithEmail(), or sendOTP()/verifyOTP() instead
   */
  async login() {
    return this.loginWithGoogle();
  }

  /**
   * Generic signup (defaults to Google)
   * @deprecated Use signupWithEmail() or sendOTP()/verifyOTP() instead
   */
  async signup() {
    return this.loginWithGoogle();
  }
}
