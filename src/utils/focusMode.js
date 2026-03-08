/**
 * Focus Mode
 * Manages focus sessions and site blocking
 */

import { StorageService } from './storageService.js';

export class FocusMode {
  constructor() {
    this.storage = new StorageService();
  }

  /**
   * Get current focus mode state
   * @returns {Promise<object>} Focus mode state
   */
  async getState() {
    const state = await this.storage.get('focusState') || {
      enabled: false,
      timerRunning: false,
      startTime: null,
      duration: 25 * 60, // 25 minutes in seconds
      remainingSeconds: 25 * 60
    };

    const settings = await this.storage.get('settings') || {};
    const blockedSites = settings.blockedSites || [];

    // Calculate remaining time if timer is running
    if (state.timerRunning && state.startTime) {
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      state.remainingSeconds = Math.max(0, state.duration - elapsed);
      
      if (state.remainingSeconds === 0) {
        state.timerRunning = false;
      }
    }

    return {
      ...state,
      blockedSitesCount: blockedSites.length
    };
  }

  /**
   * Enable or disable focus mode
   * @param {boolean} enabled - Whether to enable focus mode
   */
  async setEnabled(enabled) {
    const state = await this.storage.get('focusState') || {};
    
    state.enabled = enabled;
    
    if (!enabled) {
      state.timerRunning = false;
      state.startTime = null;
    }
    
    await this.storage.set('focusState', state);
    
    return { success: true, enabled };
  }

  /**
   * Start the focus timer
   */
  async startTimer() {
    const state = await this.storage.get('focusState') || {};
    const settings = await this.storage.get('settings') || {};
    
    const duration = (settings.focusDuration || 25) * 60; // Convert to seconds
    
    state.enabled = true;
    state.timerRunning = true;
    state.startTime = Date.now();
    state.duration = duration;
    state.remainingSeconds = duration;
    
    await this.storage.set('focusState', state);
    
    // Set alarm for when focus session ends
    chrome.alarms.create('focusTimer', {
      delayInMinutes: settings.focusDuration || 25
    });
    
    return { success: true, duration };
  }

  /**
   * Pause the focus timer
   */
  async pauseTimer() {
    const state = await this.storage.get('focusState') || {};
    
    if (state.timerRunning && state.startTime) {
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      state.remainingSeconds = Math.max(0, state.duration - elapsed);
    }
    
    state.timerRunning = false;
    state.startTime = null;
    
    await this.storage.set('focusState', state);
    chrome.alarms.clear('focusTimer');
    
    return { success: true };
  }

  /**
   * Reset the focus timer
   */
  async resetTimer() {
    const settings = await this.storage.get('settings') || {};
    const duration = (settings.focusDuration || 25) * 60;
    
    const state = {
      enabled: false,
      timerRunning: false,
      startTime: null,
      duration: duration,
      remainingSeconds: duration
    };
    
    await this.storage.set('focusState', state);
    chrome.alarms.clear('focusTimer');
    
    return { success: true };
  }

  /**
   * Set focus duration
   * @param {number} minutes - Duration in minutes
   */
  async setDuration(minutes) {
    const state = await this.storage.get('focusState') || {};
    
    state.duration = minutes * 60;
    
    if (!state.timerRunning) {
      state.remainingSeconds = minutes * 60;
    }
    
    await this.storage.set('focusState', state);
    
    return { success: true };
  }

  /**
   * Check if a URL should be blocked
   * @param {string} url - The URL to check
   * @returns {Promise<boolean>} Whether the URL should be blocked
   */
  async isBlocked(url) {
    const state = await this.storage.get('focusState') || {};
    
    if (!state.enabled) {
      return false;
    }
    
    const settings = await this.storage.get('settings') || {};
    const blockedSites = settings.blockedSites || [];
    
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Check if hostname matches any blocked site
      for (const site of blockedSites) {
        const siteLower = site.toLowerCase();
        
        if (hostname === siteLower || hostname.endsWith('.' + siteLower)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking blocked URL:', error);
      return false;
    }
  }

  /**
   * Add a site to the blocked list
   * @param {string} site - Domain to block
   */
  async addBlockedSite(site) {
    const settings = await this.storage.get('settings') || {};
    const blockedSites = settings.blockedSites || [];
    
    const siteLower = site.toLowerCase().trim();
    
    if (!blockedSites.includes(siteLower)) {
      blockedSites.push(siteLower);
      settings.blockedSites = blockedSites;
      await this.storage.set('settings', settings);
    }
    
    return { success: true, blockedSites };
  }

  /**
   * Remove a site from the blocked list
   * @param {string} site - Domain to unblock
   */
  async removeBlockedSite(site) {
    const settings = await this.storage.get('settings') || {};
    const blockedSites = settings.blockedSites || [];
    
    const siteLower = site.toLowerCase().trim();
    const index = blockedSites.indexOf(siteLower);
    
    if (index !== -1) {
      blockedSites.splice(index, 1);
      settings.blockedSites = blockedSites;
      await this.storage.set('settings', settings);
    }
    
    return { success: true, blockedSites };
  }

  /**
   * Get list of blocked sites
   * @returns {Promise<Array>} List of blocked domains
   */
  async getBlockedSites() {
    const settings = await this.storage.get('settings') || {};
    return settings.blockedSites || [];
  }

  /**
   * Get focus session statistics
   * @returns {Promise<object>} Focus session stats
   */
  async getStats() {
    const stats = await this.storage.get('focusStats') || {
      totalSessions: 0,
      totalMinutes: 0,
      completedSessions: 0,
      longestSession: 0
    };
    
    return stats;
  }

  /**
   * Record a completed focus session
   * @param {number} minutes - Duration of the session
   */
  async recordSession(minutes) {
    const stats = await this.storage.get('focusStats') || {
      totalSessions: 0,
      totalMinutes: 0,
      completedSessions: 0,
      longestSession: 0
    };
    
    stats.totalSessions++;
    stats.totalMinutes += minutes;
    stats.completedSessions++;
    stats.longestSession = Math.max(stats.longestSession, minutes);
    
    await this.storage.set('focusStats', stats);
    
    return stats;
  }
}
