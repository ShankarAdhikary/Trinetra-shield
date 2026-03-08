/**
 * Notification Service
 * Handles Chrome notifications
 */

import { StorageService } from './storageService.js';

export class NotificationService {
  constructor() {
    this.storage = new StorageService();
    this.defaultIcon = 'assets/icons/icon128.png';
  }

  /**
   * Show a notification
   * @param {object} options - Notification options
   * @returns {Promise<string>} Notification ID
   */
  async show(options) {
    // Check if notifications are enabled
    const settings = await this.storage.get('settings') || {};
    
    if (settings.notificationsEnabled === false) {
      return null;
    }

    const notificationId = options.id || 'trinetra_' + Date.now();
    
    const notificationOptions = {
      type: options.type || 'basic',
      iconUrl: options.iconUrl || chrome.runtime.getURL(this.defaultIcon),
      title: options.title || 'TRINETRA',
      message: options.message || '',
      priority: options.priority || 0,
      requireInteraction: options.requireInteraction || false
    };

    // Add buttons if provided
    if (options.buttons) {
      notificationOptions.buttons = options.buttons;
    }

    // Add items for list type
    if (options.type === 'list' && options.items) {
      notificationOptions.items = options.items;
    }

    // Add progress for progress type
    if (options.type === 'progress' && typeof options.progress === 'number') {
      notificationOptions.progress = options.progress;
    }

    return new Promise((resolve, reject) => {
      chrome.notifications.create(notificationId, notificationOptions, (id) => {
        if (chrome.runtime.lastError) {
          console.error('Notification error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          // Auto-clear after timeout if specified
          if (options.timeout) {
            setTimeout(() => {
              this.clear(id);
            }, options.timeout);
          }
          
          resolve(id);
        }
      });
    });
  }

  /**
   * Clear a notification
   * @param {string} notificationId - Notification ID to clear
   * @returns {Promise<boolean>} Whether the notification was cleared
   */
  async clear(notificationId) {
    return new Promise((resolve) => {
      chrome.notifications.clear(notificationId, (wasCleared) => {
        resolve(wasCleared);
      });
    });
  }

  /**
   * Clear all notifications
   * @returns {Promise<void>}
   */
  async clearAll() {
    return new Promise((resolve) => {
      chrome.notifications.getAll((notifications) => {
        const ids = Object.keys(notifications);
        let cleared = 0;
        
        if (ids.length === 0) {
          resolve();
          return;
        }
        
        ids.forEach(id => {
          chrome.notifications.clear(id, () => {
            cleared++;
            if (cleared === ids.length) {
              resolve();
            }
          });
        });
      });
    });
  }

  /**
   * Update a notification
   * @param {string} notificationId - Notification ID to update
   * @param {object} options - Updated options
   * @returns {Promise<boolean>} Whether the notification was updated
   */
  async update(notificationId, options) {
    return new Promise((resolve) => {
      chrome.notifications.update(notificationId, options, (wasUpdated) => {
        resolve(wasUpdated);
      });
    });
  }

  /**
   * Listen for notification clicks
   * @param {function} callback - Callback function
   */
  onClicked(callback) {
    chrome.notifications.onClicked.addListener(callback);
  }

  /**
   * Listen for notification button clicks
   * @param {function} callback - Callback function
   */
  onButtonClicked(callback) {
    chrome.notifications.onButtonClicked.addListener(callback);
  }

  /**
   * Listen for notification closed
   * @param {function} callback - Callback function
   */
  onClosed(callback) {
    chrome.notifications.onClosed.addListener(callback);
  }

  /**
   * Show a security threat notification
   * @param {object} threat - Threat information
   */
  async showThreatNotification(threat) {
    return this.show({
      id: 'threat_' + Date.now(),
      title: '⚠️ Security Threat Detected',
      message: threat.message || 'A potential security threat was blocked.',
      type: 'basic',
      priority: 2,
      requireInteraction: true,
      buttons: [
        { title: 'View Details' },
        { title: 'Dismiss' }
      ]
    });
  }

  /**
   * Show a break reminder notification
   */
  async showBreakReminder() {
    return this.show({
      id: 'break_reminder',
      title: '☕ Time for a Break',
      message: 'You\'ve been browsing for a while. Take a short break to rest your eyes.',
      type: 'basic',
      timeout: 30000 // Auto-dismiss after 30 seconds
    });
  }

  /**
   * Show a focus mode notification
   * @param {boolean} started - Whether focus mode was started or ended
   */
  async showFocusModeNotification(started) {
    return this.show({
      id: 'focus_mode',
      title: started ? '🎯 Focus Mode Started' : '🎉 Focus Session Complete',
      message: started 
        ? 'Distracting sites are now blocked. Stay focused!'
        : 'Great job! You completed your focus session.',
      type: 'basic',
      timeout: 10000
    });
  }

  /**
   * Show a task reminder notification
   * @param {object} task - Task information
   */
  async showTaskReminder(task) {
    return this.show({
      id: 'task_' + task.id,
      title: '📋 Task Reminder',
      message: task.text,
      type: 'basic',
      buttons: [
        { title: 'Mark Complete' },
        { title: 'Snooze' }
      ]
    });
  }

  /**
   * Show a daily summary notification
   * @param {object} summary - Summary data
   */
  async showDailySummary(summary) {
    const hours = Math.floor(summary.totalMinutes / 60);
    const minutes = summary.totalMinutes % 60;
    
    return this.show({
      id: 'daily_summary',
      title: '📊 Your Daily Summary',
      message: `Today you browsed for ${hours}h ${minutes}m. ${summary.threatsBlocked} threats were blocked.`,
      type: 'basic',
      requireInteraction: true
    });
  }

  /**
   * Request notification permission
   * @returns {Promise<boolean>} Whether permission was granted
   */
  async requestPermission() {
    // Chrome extensions don't need to request notification permission
    // as it's declared in the manifest
    return true;
  }
}
