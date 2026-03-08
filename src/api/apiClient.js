/**
 * API Client
 * Handles communication with the backend server
 */

import { StorageService } from '../utils/storageService.js';

export class ApiClient {
  constructor() {
    // Backend URL - change to localhost:3000 for local development
    this.baseUrl = 'https://trinetra-shield.onrender.com';
    this.storage = new StorageService();
    this.timeout = 30000; // 30 seconds (Render free tier can be slow to wake)
  }

  /**
   * Set the API base URL
   * @param {string} url - The base URL
   */
  setBaseUrl(url) {
    this.baseUrl = url;
  }

  /**
   * Make an authenticated API request
   * @param {string} endpoint - API endpoint
   * @param {object} options - Fetch options
   * @returns {Promise<object>} API response
   */
  async request(endpoint, options = {}) {
    const token = await this.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(response.status, error.error || error.message || 'Request failed', error);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new ApiError(408, 'Request timeout');
      }
      
      throw error;
    }
  }

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @param {object} params - Query parameters
   * @returns {Promise<object>} API response
   */
  async get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    
    return this.request(url, { method: 'GET' });
  }

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {object} data - Request body
   * @returns {Promise<object>} API response
   */
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {object} data - Request body
   * @returns {Promise<object>} API response
   */
  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * PATCH request
   * @param {string} endpoint - API endpoint
   * @param {object} data - Request body
   * @returns {Promise<object>} API response
   */
  async patch(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<object>} API response
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  /**
   * Get stored auth token
   * @returns {Promise<string|null>} Auth token
   */
  async getToken() {
    const auth = await this.storage.get('auth');
    return auth?.token || null;
  }

  /**
   * Store auth token
   * @param {string} token - Auth token
   */
  async setToken(token) {
    const auth = await this.storage.get('auth') || {};
    auth.token = token;
    await this.storage.set('auth', auth);
  }

  /**
   * Clear auth token
   */
  async clearToken() {
    await this.storage.remove('auth');
  }

  // ============= API Methods =============

  /**
   * Sync user data with server
   * @param {object} data - Data to sync
   * @returns {Promise<object>} Sync result
   */
  async syncData(data) {
    return this.post('/api/sync', data);
  }

  /**
   * Get user profile
   * @returns {Promise<object>} User profile
   */
  async getProfile() {
    return this.get('/api/user/profile');
  }

  /**
   * Update user profile
   * @param {object} updates - Profile updates
   * @returns {Promise<object>} Updated profile
   */
  async updateProfile(updates) {
    return this.patch('/api/user/profile', updates);
  }

  /**
   * Get user settings
   * @returns {Promise<object>} User settings
   */
  async getSettings() {
    return this.get('/api/user/settings');
  }

  /**
   * Update user settings
   * @param {object} settings - Settings to update
   * @returns {Promise<object>} Updated settings
   */
  async updateSettings(settings) {
    return this.put('/api/user/settings', settings);
  }

  /**
   * Get tasks from server
   * @returns {Promise<Array>} Tasks
   */
  async getTasks() {
    return this.get('/api/tasks');
  }

  /**
   * Sync tasks with server
   * @param {Array} tasks - Local tasks
   * @returns {Promise<Array>} Merged tasks
   */
  async syncTasks(tasks) {
    return this.post('/api/tasks/sync', { tasks });
  }

  /**
   * Get time tracking data
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<object>} Time data
   */
  async getTimeData(startDate, endDate) {
    return this.get('/api/time', { startDate, endDate });
  }

  /**
   * Submit time tracking data
   * @param {object} data - Time data
   * @returns {Promise<object>} Result
   */
  async submitTimeData(data) {
    return this.post('/api/time', data);
  }

  /**
   * Report a security threat
   * @param {object} threat - Threat details
   * @returns {Promise<object>} Result
   */
  async reportThreat(threat) {
    return this.post('/api/security/report', threat);
  }

  /**
   * Get threat database updates
   * @param {string} lastUpdate - Last update timestamp
   * @returns {Promise<object>} Threat updates
   */
  async getThreatUpdates(lastUpdate) {
    return this.get('/api/security/threats', { since: lastUpdate });
  }

  /**
   * Log an error
   * @param {object} error - Error details
   * @returns {Promise<void>}
   */
  async logError(error) {
    try {
      await this.post('/api/logs/error', error);
    } catch (e) {
      console.error('Failed to log error to server:', e);
    }
  }
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(status, message, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}
