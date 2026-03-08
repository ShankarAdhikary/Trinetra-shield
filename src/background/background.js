/**
 * TRINETRA Background Service Worker
 * Handles security checks, time tracking, and cross-tab communication
 */

import { SecurityService } from '../utils/securityService.js';
import { TimeTracker } from '../utils/timeTracker.js';
import { FocusMode } from '../utils/focusMode.js';
import { StorageService } from '../utils/storageService.js';
import { NotificationService } from '../utils/notificationService.js';
import { ApiClient } from '../api/apiClient.js';

class BackgroundController {
  constructor() {
    this.security = new SecurityService();
    this.timeTracker = new TimeTracker();
    this.focusMode = new FocusMode();
    this.storage = new StorageService();
    this.notifications = new NotificationService();
    this.api = new ApiClient();
    
    this.init();
  }

  init() {
    this.setupMessageListeners();
    this.setupWebNavigationListeners();
    this.setupTabListeners();
    this.setupAlarms();
    this.setupInstallListener();
  }

  /**
   * Handle messages from popup, options, and content scripts
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender)
        .then(sendResponse)
        .catch(error => {
          console.error('Message handler error:', error);
          sendResponse({ error: error.message });
        });
      
      return true; // Keep message channel open for async response
    });
  }

  async handleMessage(message, _sender) {
    switch (message.type) {
      case 'CHECK_URL_SAFETY':
        return this.checkUrlSafety(message.url);
      
      case 'GET_SECURITY_STATS':
        return this.getSecurityStats();
      
      case 'GET_TIME_DATA':
        return this.timeTracker.getTodayData();
      
      case 'GET_FOCUS_STATE':
        return this.focusMode.getState();
      
      case 'TOGGLE_FOCUS_MODE':
        return this.focusMode.setEnabled(message.enabled);
      
      case 'START_FOCUS_TIMER':
        return this.focusMode.startTimer();
      
      case 'RESET_FOCUS_TIMER':
        return this.focusMode.resetTimer();
      
      case 'SETTINGS_UPDATED':
        return this.handleSettingsUpdate(message.settings);
      
      case 'SYNC_DATA':
        return this.syncUserData();
      
      case 'PAGE_LOADED':
        return this.handlePageLoaded(message.url, message.pageInfo);
      
      case 'PHISHING_INDICATORS':
        return this.handlePhishingIndicators(message.url, message.indicators);
      
      case 'USER_PROCEEDED':
        return this.handleUserProceeded(message.url);
      
      default:
        console.warn('Unknown message type:', message.type);
        return { error: 'Unknown message type' };
    }
  }

  /**
   * Monitor web navigation for security checks
   */
  setupWebNavigationListeners() {
    chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
      if (details.frameId !== 0) return; // Only main frame
      
      try {
        const settings = await this.storage.get('settings') || {};
        
        // Check if site should be blocked during focus mode
        if (settings.focusModeEnabled) {
          const isBlocked = await this.focusMode.isBlocked(details.url);
          if (isBlocked) {
            this.blockNavigation(details.tabId, 'focus');
            return;
          }
        }
        
        // Security check
        if (settings.phishingEnabled !== false) {
          const safetyCheck = await this.checkUrlSafety(details.url);
          
          if (!safetyCheck.safe && settings.blockMalicious !== false) {
            if (settings.showWarning !== false) {
              this.blockNavigation(details.tabId, 'security', safetyCheck.threat);
            }
          }
        }
      } catch (error) {
        console.error('Navigation check error:', error);
      }
    });

    chrome.webNavigation.onCompleted.addListener(async (details) => {
      if (details.frameId !== 0) return;
      
      try {
        // Update scanned count
        const stats = await this.storage.get('securityStats') || { scannedCount: 0, blockedCount: 0 };
        stats.scannedCount++;
        await this.storage.set('securityStats', stats);
      } catch (error) {
        console.error('Failed to update stats:', error);
      }
    });
  }

  /**
   * Track active tab for time tracking
   */
  setupTabListeners() {
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
          await this.timeTracker.trackSite(tab.url);
        }
      } catch (error) {
        console.error('Tab tracking error:', error);
      }
    });

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.active && tab.url) {
        try {
          await this.timeTracker.trackSite(tab.url);
        } catch (error) {
          console.error('Tab update tracking error:', error);
        }
      }
    });
  }

  /**
   * Setup alarms for periodic tasks
   */
  setupAlarms() {
    // Break reminder alarm
    chrome.alarms.create('breakReminder', { periodInMinutes: 60 });
    
    // Time tracking save alarm (every 5 minutes)
    chrome.alarms.create('saveTimeData', { periodInMinutes: 5 });
    
    // Daily summary alarm (at end of day)
    chrome.alarms.create('dailySummary', {
      when: this.getEndOfDayTimestamp(),
      periodInMinutes: 24 * 60
    });

    // Threat blocklist update (every 6 hours)
    chrome.alarms.create('updateThreatList', { periodInMinutes: 360 });

    chrome.alarms.onAlarm.addListener(async (alarm) => {
      switch (alarm.name) {
        case 'breakReminder':
          await this.handleBreakReminder();
          break;
        case 'saveTimeData':
          await this.timeTracker.save();
          break;
        case 'dailySummary':
          await this.sendDailySummary();
          break;
        case 'focusTimer':
          await this.handleFocusTimerEnd();
          break;
        case 'updateThreatList':
          await this.updateThreatBlocklist();
          break;
      }
    });
  }

  /**
   * Handle extension install/update
   */
  setupInstallListener() {
    chrome.runtime.onInstalled.addListener(async (details) => {
      if (details.reason === 'install') {
        // First install - set default settings
        const defaultSettings = {
          theme: 'light',
          phishingEnabled: true,
          securityLevel: 'medium',
          blockMalicious: true,
          showWarning: true,
          timeTrackingEnabled: true,
          notificationsEnabled: true,
          breakReminders: true,
          breakInterval: 60,
          focusDuration: 25,
          blockedSites: ['facebook.com', 'twitter.com', 'instagram.com', 'reddit.com', 'youtube.com']
        };
        
        await this.storage.set('settings', defaultSettings);
        
        // Show welcome notification
        this.notifications.show({
          title: 'Welcome to TRINETRA!',
          message: 'Click the extension icon to get started.',
          type: 'basic'
        });
        
        // Open options page on first install
        chrome.runtime.openOptionsPage();
      } else if (details.reason === 'update') {
        // Handle update if needed
        console.log('TRINETRA updated to version', chrome.runtime.getManifest().version);
      }
    });
  }

  /**
   * Check URL safety using security service
   */
  async checkUrlSafety(url) {
    try {
      const settings = await this.storage.get('settings') || {};
      const whitelist = settings.whitelist || [];
      
      // Check whitelist
      const urlObj = new URL(url);
      if (whitelist.some(domain => urlObj.hostname.endsWith(domain))) {
        return { safe: true, whitelisted: true };
      }
      
      // Check against security service
      const result = await this.security.checkUrl(url, settings.securityLevel || 'medium');
      
      if (!result.safe) {
        // Update blocked count
        const stats = await this.storage.get('securityStats') || { scannedCount: 0, blockedCount: 0 };
        stats.blockedCount++;
        await this.storage.set('securityStats', stats);
        
        // Show notification
        if (settings.threatNotifications !== false) {
          this.notifications.show({
            title: 'Threat Detected!',
            message: `TRINETRA blocked a potentially dangerous site.`,
            type: 'basic'
          });
        }
      }
      
      return result;
    } catch (error) {
      console.error('URL safety check error:', error);
      return { safe: true, error: true }; // Fail open
    }
  }

  /**
   * Get security statistics
   */
  async getSecurityStats() {
    return await this.storage.get('securityStats') || {
      scannedCount: 0,
      blockedCount: 0
    };
  }

  /**
   * Block navigation and show block page
   */
  async blockNavigation(tabId, reason, threatInfo) {
    const blockUrl = chrome.runtime.getURL('content/blocked.html');
    const params = new URLSearchParams({
      reason,
      threat: threatInfo || ''
    });
    
    await chrome.tabs.update(tabId, {
      url: `${blockUrl}?${params.toString()}`
    });
  }

  /**
   * Handle settings update from options page
   */
  async handleSettingsUpdate(settings) {
    // Update alarms based on new settings
    if (settings.breakInterval) {
      chrome.alarms.create('breakReminder', { periodInMinutes: settings.breakInterval });
    }
    
    // Update focus mode
    if (settings.focusDuration) {
      await this.focusMode.setDuration(settings.focusDuration);
    }
    
    return { success: true };
  }

  /**
   * Handle break reminder alarm
   */
  async handleBreakReminder() {
    const settings = await this.storage.get('settings') || {};
    
    if (!settings.breakReminders) return;
    
    this.notifications.show({
      title: 'Time for a Break!',
      message: 'You\'ve been browsing for a while. Take a short break to rest your eyes.',
      type: 'basic'
    });
  }

  /**
   * Handle focus timer end
   */
  async handleFocusTimerEnd() {
    const settings = await this.storage.get('settings') || {};
    
    await this.focusMode.setEnabled(false);
    
    this.notifications.show({
      title: 'Focus Session Complete!',
      message: 'Great job staying focused! Take a well-deserved break.',
      type: 'basic'
    });
    
    if (settings.focusSound) {
      // Play completion sound (would need audio file)
    }
  }

  /**
   * Send daily summary notification
   */
  async sendDailySummary() {
    const settings = await this.storage.get('settings') || {};
    
    if (!settings.dailySummary) return;
    
    const timeData = await this.timeTracker.getTodayData();
    const stats = await this.getSecurityStats();
    
    const hours = Math.floor(timeData.totalMinutes / 60);
    const minutes = timeData.totalMinutes % 60;
    
    this.notifications.show({
      title: 'Your Daily Browsing Summary',
      message: `You browsed for ${hours}h ${minutes}m today. ${stats.blockedCount} threats were blocked.`,
      type: 'basic'
    });
    
    // Reset daily stats
    await this.storage.set('securityStats', { scannedCount: 0, blockedCount: 0 });
  }

  /**
   * Sync user data with backend
   */
  async syncUserData() {
    try {
      const settings = await this.storage.get('settings') || {};
      
      if (!settings.syncEnabled) {
        return { success: false, reason: 'Sync disabled' };
      }
      
      const data = await this.storage.getAll();
      await this.api.syncData(data);
      
      return { success: true };
    } catch (error) {
      console.error('Sync error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle page loaded event from content script
   */
  async handlePageLoaded(url, pageInfo) {
    if (!url || !pageInfo) return { success: true };

    try {
      // If the page has a login form on a non-HTTPS site, notify
      if (pageInfo.hasLoginForm && !pageInfo.hasSSL) {
        const settings = await this.storage.get('settings') || {};
        if (settings.threatNotifications !== false) {
          this.notifications.showThreatNotification({
            message: 'This login form is on an insecure (non-HTTPS) page. Your credentials could be intercepted.'
          });
        }
      }
    } catch (error) {
      console.error('Page loaded handler error:', error);
    }
    return { success: true };
  }

  /**
   * Handle phishing indicators from content script
   */
  async handlePhishingIndicators(url, indicators) {
    if (!indicators || indicators.length === 0) return { success: true };

    try {
      const settings = await this.storage.get('settings') || {};

      // If brand impersonation detected, take action
      if (indicators.includes('brand_impersonation')) {
        if (settings.threatNotifications !== false) {
          this.notifications.showThreatNotification({
            message: 'This site may be impersonating a trusted brand. Proceed with caution.'
          });
        }

        // Update blocked count
        const stats = await this.storage.get('securityStats') || { scannedCount: 0, blockedCount: 0 };
        stats.blockedCount++;
        await this.storage.set('securityStats', stats);
      }

      // Log indicators for analytics
      const securityLog = await this.storage.get('securityLog') || [];
      securityLog.push({
        url,
        indicators,
        timestamp: Date.now()
      });
      await this.storage.set('securityLog', securityLog.slice(-200));
    } catch (error) {
      console.error('Phishing indicators handler error:', error);
    }
    return { success: true };
  }

  /**
   * Handle user choosing to proceed on a flagged site
   */
  async handleUserProceeded(url) {
    try {
      const proceeded = await this.storage.get('proceededSites') || [];
      proceeded.push({ url, timestamp: Date.now() });
      await this.storage.set('proceededSites', proceeded.slice(-100));
    } catch (error) {
      console.error('User proceeded handler error:', error);
    }
    return { success: true };
  }

  /**
   * Update threat blocklist from backend
   */
  async updateThreatBlocklist() {
    try {
      const response = await fetch('https://trinetra-shield.onrender.com/api/security/blocklist', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.domains && Array.isArray(data.domains)) {
          await this.storage.set('threatBlocklist', data.domains);
          console.log(`Threat blocklist updated: ${data.domains.length} entries`);
        }
      }
    } catch (error) {
      // Backend unavailable, keep existing blocklist
      console.warn('Threat blocklist update failed:', error.message);
    }
  }

  /**
   * Get timestamp for end of current day
   */
  getEndOfDayTimestamp() {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return endOfDay.getTime();
  }
}

// Initialize background controller
new BackgroundController();
