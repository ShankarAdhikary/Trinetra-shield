/**
 * TRINETRA Options Page Script
 * Handles settings management and user preferences
 */

import { StorageService } from '../utils/storageService.js';
import { AuthService } from '../api/authService.js';

class OptionsController {
  constructor() {
    this.storage = new StorageService();
    this.authService = new AuthService();
    this.settings = {};
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupNavigation();
    this.setupEventListeners();
    await this.loadUserState();
    this.renderLists();
  }

  async loadSettings() {
    const defaults = {
      // General
      theme: 'light',
      startupPopup: false,
      syncEnabled: true,
      
      // Security
      phishingEnabled: true,
      securityLevel: 'medium',
      blockMalicious: true,
      showWarning: true,
      whitelist: [],
      
      // Productivity
      timeTrackingEnabled: true,
      trackPrivate: false,
      focusDuration: 25,
      focusSound: true,
      blockedSites: ['facebook.com', 'twitter.com', 'instagram.com', 'reddit.com', 'youtube.com'],
      
      // Notifications
      notificationsEnabled: true,
      notificationSound: true,
      threatNotifications: true,
      breakReminders: true,
      breakInterval: 60,
      dailySummary: true
    };

    const stored = await this.storage.get('settings');
    this.settings = { ...defaults, ...stored };
    this.applySettings();
  }

  applySettings() {
    // Theme
    document.body.dataset.theme = this.settings.theme;
    document.getElementById('theme-select').value = this.settings.theme;
    
    // General
    document.getElementById('startup-popup').checked = this.settings.startupPopup;
    document.getElementById('sync-enabled').checked = this.settings.syncEnabled;
    
    // Security
    document.getElementById('phishing-enabled').checked = this.settings.phishingEnabled;
    document.getElementById('security-level').value = this.settings.securityLevel;
    document.getElementById('block-malicious').checked = this.settings.blockMalicious;
    document.getElementById('show-warning').checked = this.settings.showWarning;
    
    // Productivity
    document.getElementById('time-tracking-enabled').checked = this.settings.timeTrackingEnabled;
    document.getElementById('track-private').checked = this.settings.trackPrivate;
    document.getElementById('focus-duration').value = this.settings.focusDuration;
    document.getElementById('focus-sound').checked = this.settings.focusSound;
    
    // Notifications
    document.getElementById('notifications-enabled').checked = this.settings.notificationsEnabled;
    document.getElementById('notification-sound').checked = this.settings.notificationSound;
    document.getElementById('threat-notifications').checked = this.settings.threatNotifications;
    document.getElementById('break-reminders').checked = this.settings.breakReminders;
    document.getElementById('break-interval').value = this.settings.breakInterval;
    document.getElementById('daily-summary').checked = this.settings.dailySummary;
  }

  async saveSettings() {
    await this.storage.set('settings', this.settings);
    
    // Notify background script of settings change
    chrome.runtime.sendMessage({
      type: 'SETTINGS_UPDATED',
      settings: this.settings
    });
  }

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.settings-section');

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = item.dataset.section;
        
        // Update navigation
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Show section
        sections.forEach(section => {
          section.classList.toggle('active', section.id === sectionId);
        });
        
        // Update URL hash
        window.location.hash = sectionId;
      });
    });

    // Handle initial hash
    const hash = window.location.hash.slice(1);
    if (hash) {
      const targetNav = document.querySelector(`.nav-item[data-section="${hash}"]`);
      if (targetNav) {
        targetNav.click();
      }
    }
  }

  setupEventListeners() {
    // Theme
    document.getElementById('theme-select').addEventListener('change', (e) => {
      this.settings.theme = e.target.value;
      document.body.dataset.theme = e.target.value;
      this.saveSettings();
    });

    // General toggles
    this.setupToggle('startup-popup', 'startupPopup');
    this.setupToggle('sync-enabled', 'syncEnabled');

    // Security toggles and selects
    this.setupToggle('phishing-enabled', 'phishingEnabled');
    this.setupToggle('block-malicious', 'blockMalicious');
    this.setupToggle('show-warning', 'showWarning');
    
    document.getElementById('security-level').addEventListener('change', (e) => {
      this.settings.securityLevel = e.target.value;
      this.saveSettings();
    });

    // Productivity
    this.setupToggle('time-tracking-enabled', 'timeTrackingEnabled');
    this.setupToggle('track-private', 'trackPrivate');
    this.setupToggle('focus-sound', 'focusSound');
    
    document.getElementById('focus-duration').addEventListener('change', (e) => {
      this.settings.focusDuration = parseInt(e.target.value);
      this.saveSettings();
    });

    // Notifications
    this.setupToggle('notifications-enabled', 'notificationsEnabled');
    this.setupToggle('notification-sound', 'notificationSound');
    this.setupToggle('threat-notifications', 'threatNotifications');
    this.setupToggle('break-reminders', 'breakReminders');
    this.setupToggle('daily-summary', 'dailySummary');
    
    document.getElementById('break-interval').addEventListener('change', (e) => {
      this.settings.breakInterval = parseInt(e.target.value);
      this.saveSettings();
    });

    // Whitelist management
    document.getElementById('add-whitelist-btn').addEventListener('click', () => {
      this.addToList('whitelist');
    });
    
    document.getElementById('whitelist-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addToList('whitelist');
      }
    });

    // Blocked sites management
    document.getElementById('add-blocked-btn').addEventListener('click', () => {
      this.addToList('blockedSites');
    });
    
    document.getElementById('blocked-site-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addToList('blockedSites');
      }
    });

    // Data management
    document.getElementById('export-data-btn').addEventListener('click', () => {
      this.exportData();
    });
    
    document.getElementById('clear-data-btn').addEventListener('click', () => {
      this.clearData();
    });

    // Auth buttons
    document.getElementById('login-btn')?.addEventListener('click', () => {
      this.authService.login();
    });
    
    document.getElementById('signup-btn')?.addEventListener('click', () => {
      this.authService.signup();
    });
    
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      this.logout();
    });
    
    document.getElementById('delete-account-btn')?.addEventListener('click', () => {
      this.deleteAccount();
    });
  }

  setupToggle(elementId, settingKey) {
    document.getElementById(elementId).addEventListener('change', (e) => {
      this.settings[settingKey] = e.target.checked;
      this.saveSettings();
    });
  }

  async loadUserState() {
    const user = await this.authService.getCurrentUser();
    const loggedInSection = document.getElementById('logged-in-section');
    const loggedOutSection = document.getElementById('logged-out-section');

    if (user) {
      loggedInSection.classList.remove('hidden');
      loggedOutSection.classList.add('hidden');
      
      document.getElementById('user-name').textContent = user.name || 'User';
      document.getElementById('user-email').textContent = user.email || '';
      document.getElementById('user-avatar').textContent = (user.name || 'U')[0].toUpperCase();
    } else {
      loggedInSection.classList.add('hidden');
      loggedOutSection.classList.remove('hidden');
    }
  }

  renderLists() {
    this.renderList('whitelist', 'whitelist');
    this.renderList('blocked-sites-list', 'blockedSites');
  }

  renderList(elementId, settingKey) {
    const listElement = document.getElementById(elementId);
    const items = this.settings[settingKey] || [];

    listElement.innerHTML = '';

    if (items.length === 0) {
      listElement.innerHTML = '<li class="empty-state">No items added</li>';
      return;
    }

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${this.escapeHtml(item)}</span>
        <button class="remove-btn" data-index="${index}" title="Remove">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      `;
      
      li.querySelector('.remove-btn').addEventListener('click', () => {
        this.removeFromList(settingKey, index);
      });
      
      listElement.appendChild(li);
    });
  }

  addToList(settingKey) {
    const inputId = settingKey === 'whitelist' ? 'whitelist-input' : 'blocked-site-input';
    const input = document.getElementById(inputId);
    const value = input.value.trim().toLowerCase();

    if (!value) return;

    // Validate domain format
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/;
    if (!domainRegex.test(value)) {
      alert('Please enter a valid domain (e.g., example.com)');
      return;
    }

    if (!this.settings[settingKey]) {
      this.settings[settingKey] = [];
    }

    if (this.settings[settingKey].includes(value)) {
      alert('This domain is already in the list');
      return;
    }

    this.settings[settingKey].push(value);
    input.value = '';
    
    this.saveSettings();
    this.renderList(settingKey === 'whitelist' ? 'whitelist' : 'blocked-sites-list', settingKey);
  }

  removeFromList(settingKey, index) {
    this.settings[settingKey].splice(index, 1);
    this.saveSettings();
    this.renderList(settingKey === 'whitelist' ? 'whitelist' : 'blocked-sites-list', settingKey);
  }

  async exportData() {
    try {
      const data = await this.storage.getAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `trinetra-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data. Please try again.');
    }
  }

  async clearData() {
    const confirmed = confirm(
      'Are you sure you want to clear all data? This will delete all your tasks, settings, and browsing history. This action cannot be undone.'
    );
    
    if (!confirmed) return;

    try {
      await this.storage.clear();
      await this.loadSettings();
      this.renderLists();
      alert('All data has been cleared.');
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('Failed to clear data. Please try again.');
    }
  }

  async logout() {
    try {
      await this.authService.logout();
      await this.loadUserState();
    } catch (error) {
      console.error('Failed to logout:', error);
      alert('Failed to sign out. Please try again.');
    }
  }

  async deleteAccount() {
    const confirmed = confirm(
      'Are you sure you want to delete your account? This will permanently delete all your data and cannot be undone.'
    );
    
    if (!confirmed) return;

    try {
      await this.authService.deleteAccount();
      await this.storage.clear();
      await this.loadUserState();
      alert('Your account has been deleted.');
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to delete account. Please try again.');
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
