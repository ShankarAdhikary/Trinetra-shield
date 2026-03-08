/**
 * Time Tracker
 * Tracks time spent on different websites
 */

import { StorageService } from './storageService.js';

export class TimeTracker {
  constructor() {
    this.storage = new StorageService();
    this.currentSite = null;
    this.startTime = null;
    this.updateInterval = null;
    this._restoreState();
  }

  /**
   * Restore tracking state from storage (survives service worker restarts)
   */
  async _restoreState() {
    try {
      const state = await this.storage.get('_trackingState');
      if (state && state.currentSite && state.startTime) {
        this.currentSite = state.currentSite;
        this.startTime = state.startTime;
      }
    } catch (e) {
      // Ignore — first run
    }
  }

  /**
   * Persist tracking state to storage
   */
  async _persistState() {
    try {
      await this.storage.set('_trackingState', {
        currentSite: this.currentSite,
        startTime: this.startTime
      });
    } catch (e) {
      // Non-critical
    }
  }

  /**
   * Start tracking a site
   * @param {string} url - The URL to track
   */
  async trackSite(url) {
    try {
      // Restore state in case service worker restarted
      if (!this.currentSite && !this.startTime) {
        await this._restoreState();
      }

      // Save time for previous site
      if (this.currentSite && this.startTime) {
        await this.saveElapsedTime();
      }

      // Start tracking new site
      const urlObj = new URL(url);
      
      // Skip internal URLs
      if (this.shouldSkip(url)) {
        this.currentSite = null;
        this.startTime = null;
        await this._persistState();
        return;
      }

      this.currentSite = urlObj.hostname;
      this.startTime = Date.now();
      await this._persistState();
    } catch (error) {
      console.error('Failed to track site:', error);
    }
  }

  /**
   * Check if URL should be skipped for tracking
   */
  shouldSkip(url) {
    return url.startsWith('chrome://') ||
           url.startsWith('chrome-extension://') ||
           url.startsWith('about:') ||
           url.startsWith('edge://') ||
           url.startsWith('file://') ||
           url.startsWith('devtools://');
  }

  /**
   * Save elapsed time for current site
   */
  async saveElapsedTime() {
    // Restore state if lost (service worker restart)
    if (!this.currentSite || !this.startTime) {
      await this._restoreState();
    }
    if (!this.currentSite || !this.startTime) return;

    const elapsedMs = Date.now() - this.startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    if (elapsedSeconds < 5) return; // Skip very short visits

    const elapsedMinutes = Math.round(elapsedSeconds / 60 * 10) / 10; // 0.1 min precision
    if (elapsedMinutes < 0.1) return;

    const today = this.getDateKey();
    const data = await this.storage.get('timeData') || {};
    
    if (!data[today]) {
      data[today] = {};
    }
    
    if (!data[today][this.currentSite]) {
      data[today][this.currentSite] = 0;
    }
    
    data[today][this.currentSite] += elapsedMinutes;

    // Clean up old data (keep last 30 days)
    const keys = Object.keys(data).sort();
    while (keys.length > 30) {
      delete data[keys.shift()];
    }

    await this.storage.set('timeData', data);
    
    // Reset start time
    this.startTime = Date.now();
  }

  /**
   * Save current tracking state
   */
  async save() {
    if (!this.currentSite || !this.startTime) {
      await this._restoreState();
    }
    await this.saveElapsedTime();
  }

  /**
   * Get time data for today
   * @returns {Promise<object>} Today's time data
   */
  async getTodayData() {
    const today = this.getDateKey();
    const data = await this.storage.get('timeData') || {};
    const todayData = data[today] || {};

    // Calculate total and site breakdown
    let totalMinutes = 0;
    const sites = [];

    for (const [domain, minutes] of Object.entries(todayData)) {
      totalMinutes += minutes;
      sites.push({ domain, minutes });
    }

    // Sort by time spent (descending)
    sites.sort((a, b) => b.minutes - a.minutes);

    return {
      totalMinutes,
      sites,
      date: today
    };
  }

  /**
   * Get time data for a specific date range
   * @param {number} days - Number of days to retrieve
   * @returns {Promise<object>} Time data for the range
   */
  async getTimeDataRange(days = 7) {
    const data = await this.storage.get('timeData') || {};
    const result = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = this.formatDate(date);
      
      const dayData = data[key] || {};
      let totalMinutes = 0;
      
      for (const minutes of Object.values(dayData)) {
        totalMinutes += minutes;
      }
      
      result.push({
        date: key,
        totalMinutes,
        sites: Object.entries(dayData).map(([domain, minutes]) => ({ domain, minutes }))
      });
    }
    
    return result;
  }

  /**
   * Get top sites by time spent
   * @param {number} limit - Number of sites to return
   * @returns {Promise<Array>} Top sites
   */
  async getTopSites(limit = 10) {
    const data = await this.storage.get('timeData') || {};
    const siteMap = new Map();

    // Aggregate time across all days
    for (const dayData of Object.values(data)) {
      for (const [domain, minutes] of Object.entries(dayData)) {
        siteMap.set(domain, (siteMap.get(domain) || 0) + minutes);
      }
    }

    // Convert to array and sort
    const sites = Array.from(siteMap.entries())
      .map(([domain, minutes]) => ({ domain, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, limit);

    return sites;
  }

  /**
   * Clear time data
   */
  async clearData() {
    await this.storage.remove('timeData');
    this.currentSite = null;
    this.startTime = null;
  }

  /**
   * Get date key for storage
   */
  getDateKey() {
    return this.formatDate(new Date());
  }

  /**
   * Format date as YYYY-MM-DD
   */
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Format minutes as human-readable string
   * @param {number} minutes - Minutes to format
   * @returns {string} Formatted string
   */
  formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (mins === 0) {
      return `${hours}h`;
    }
    
    return `${hours}h ${mins}m`;
  }
}
