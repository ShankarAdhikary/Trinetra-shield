/**
 * TRINETRA Popup Script
 * Main entry point for the popup UI
 */

import { TaskManager } from '../utils/taskManager.js';
import { TimeTracker } from '../utils/timeTracker.js';
import { FocusMode } from '../utils/focusMode.js';
import { AuthService } from '../api/authService.js';
import { StorageService } from '../utils/storageService.js';
import { SyncService } from '../utils/syncService.js';

class PopupController {
  constructor() {
    this.taskManager = new TaskManager();
    this.timeTracker = new TimeTracker();
    this.focusMode = new FocusMode();
    this.authService = new AuthService();
    this.storage = new StorageService();
    this.syncService = new SyncService();
    
    this.init();
  }

  async init() {
    await this.loadUserState();
    this.setupEventListeners();
    this.setupTabs();
    await this.loadSecurityStats();
    await this.loadTasks();
    await this.loadTimeData();
    await this.loadFocusState();
    this.checkConnectionStatus();
  }

  // Check backend connection and update sync status
  async checkConnectionStatus() {
    const syncStatus = document.getElementById('sync-status');
    if (!syncStatus) return;

    try {
      syncStatus.className = 'sync-status syncing';
      syncStatus.title = 'Checking connection...';
      
      // Try to reach the backend
      const response = await fetch('https://trinetra-shield.onrender.com/health', {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        const user = await this.authService.getCurrentUser();
        if (user) {
          syncStatus.className = 'sync-status synced';
          syncStatus.title = 'Connected & Synced';
        } else {
          syncStatus.className = 'sync-status';
          syncStatus.title = 'Connected - Sign in to sync';
        }
      } else {
        syncStatus.className = 'sync-status offline';
        syncStatus.title = 'Server unavailable';
      }
    } catch (error) {
      syncStatus.className = 'sync-status offline';
      syncStatus.title = 'Offline - Data saved locally';
    }
  }

  // Manual sync triggered by user
  async manualSync() {
    const syncStatus = document.getElementById('sync-status');
    if (!syncStatus) return;

    const user = await this.authService.getCurrentUser();
    if (!user) {
      this.openLoginPage();
      return;
    }

    try {
      syncStatus.className = 'sync-status syncing';
      syncStatus.title = 'Syncing...';
      
      await this.syncService.syncAll();
      
      syncStatus.className = 'sync-status synced';
      syncStatus.title = 'Synced just now';
      
      // Reload data after sync
      await this.loadTasks();
      await this.loadTimeData();
    } catch (error) {
      console.error('Sync failed:', error);
      syncStatus.className = 'sync-status error';
      syncStatus.title = 'Sync failed - ' + (error.message || 'Try again');
    }
  }

  async loadUserState() {
    const user = await this.authService.getCurrentUser();
    const authSection = document.getElementById('auth-section');
    const profileSection = document.getElementById('profile-section');
    
    if (!user) {
      authSection.classList.remove('hidden');
      if (profileSection) profileSection.classList.add('hidden');
    } else {
      authSection.classList.add('hidden');
      if (profileSection) {
        profileSection.classList.remove('hidden');
        this.updateProfileUI(user);
      }
    }
  }

  updateProfileUI(user) {
    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const avatarEl = document.getElementById('profile-avatar');

    if (nameEl) nameEl.textContent = user.name || 'User';
    if (emailEl) emailEl.textContent = user.email || user.phone || '';
    
    // Show profile picture if available
    if (avatarEl && user.picture) {
      avatarEl.innerHTML = `<img src="${user.picture}" alt="Profile" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    }
  }

  setupEventListeners() {
    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // Sync status click - manual sync
    document.getElementById('sync-status')?.addEventListener('click', async () => {
      await this.manualSync();
    });

    // Auth buttons - Open login page
    document.getElementById('login-btn')?.addEventListener('click', () => {
      this.openLoginPage();
    });

    // Quick Google login
    document.getElementById('google-login-btn')?.addEventListener('click', async () => {
      try {
        await this.authService.loginWithGoogle();
        await this.loadUserState();
      } catch (error) {
        console.error('Google login failed:', error);
        // Show error message or redirect to login page
        alert(error.message || 'Google sign-in failed. Please use Email or Phone login.');
      }
    });

    // Quick phone login - open login page with phone tab
    document.getElementById('phone-login-btn')?.addEventListener('click', () => {
      this.openLoginPage('phone');
    });

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      try {
        await this.authService.logout();
        await this.loadUserState();
      } catch (error) {
        console.error('Logout failed:', error);
      }
    });

    // Task management
    document.getElementById('add-task-btn').addEventListener('click', () => {
      this.addTask();
    });

    document.getElementById('task-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addTask();
      }
    });

    // Focus mode
    document.getElementById('focus-toggle').addEventListener('change', (e) => {
      this.toggleFocusMode(e.target.checked);
    });

    document.getElementById('start-focus-btn').addEventListener('click', () => {
      this.startFocusTimer();
    });

    document.getElementById('reset-focus-btn').addEventListener('click', () => {
      this.resetFocusTimer();
    });

    // Manage blocked sites
    document.getElementById('manage-blocked-link').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });

    // Help link
    document.getElementById('help-link').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://github.com/your-username/trinetra#troubleshooting' });
    });
  }

  setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.dataset.tab;
        
        // Update active tab button
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Show corresponding content
        tabContents.forEach(content => {
          content.classList.toggle('hidden', content.id !== `${tabId}-tab`);
          content.classList.toggle('active', content.id === `${tabId}-tab`);
        });
      });
    });
  }

  async loadSecurityStats() {
    try {
      const stats = await this.storage.get('securityStats') || {
        blockedCount: 0,
        scannedCount: 0
      };

      document.getElementById('blocked-count').textContent = stats.blockedCount;
      document.getElementById('scanned-count').textContent = stats.scannedCount;

      // Get current tab security status
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await this.checkCurrentSite(tab.url);
      }
    } catch (error) {
      console.error('Failed to load security stats:', error);
    }
  }

  async checkCurrentSite(url) {
    const statusElement = document.getElementById('current-url');
    const indicatorElement = document.querySelector('.site-indicator');
    const badgeElement = document.getElementById('security-badge');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_URL_SAFETY',
        url: url
      });

      if (response.safe) {
        statusElement.textContent = 'Current site is safe';
        indicatorElement.className = 'site-indicator safe';
        badgeElement.textContent = 'Protected';
        badgeElement.className = 'badge badge-success';
      } else if (response.warning) {
        statusElement.textContent = 'Proceed with caution';
        indicatorElement.className = 'site-indicator warning';
        badgeElement.textContent = 'Warning';
        badgeElement.className = 'badge badge-warning';
      } else {
        statusElement.textContent = 'Potentially unsafe site';
        indicatorElement.className = 'site-indicator danger';
        badgeElement.textContent = 'At Risk';
        badgeElement.className = 'badge badge-danger';
      }
    } catch (error) {
      console.error('Failed to check site safety:', error);
      statusElement.textContent = 'Unable to verify site safety';
    }
  }

  async loadTasks() {
    try {
      const tasks = await this.taskManager.getTasks();
      this.renderTasks(tasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }

  renderTasks(tasks) {
    const taskList = document.getElementById('task-list');
    const noTasksElement = document.getElementById('no-tasks');

    taskList.innerHTML = '';

    if (tasks.length === 0) {
      noTasksElement.classList.remove('hidden');
      return;
    }

    noTasksElement.classList.add('hidden');

    tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item';
      li.dataset.id = task.id;
      li.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <span class="task-text ${task.completed ? 'completed' : ''}">${this.escapeHtml(task.text)}</span>
        <button class="task-delete" title="Delete task">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      `;

      // Toggle task completion
      li.querySelector('.task-checkbox').addEventListener('change', async (e) => {
        await this.taskManager.toggleTask(task.id, e.target.checked);
        li.querySelector('.task-text').classList.toggle('completed', e.target.checked);
      });

      // Delete task
      li.querySelector('.task-delete').addEventListener('click', async () => {
        await this.taskManager.deleteTask(task.id);
        li.remove();
        const remainingTasks = await this.taskManager.getTasks();
        if (remainingTasks.length === 0) {
          noTasksElement.classList.remove('hidden');
        }
      });

      taskList.appendChild(li);
    });
  }

  async addTask() {
    const input = document.getElementById('task-input');
    const text = input.value.trim();

    if (!text) return;

    try {
      await this.taskManager.addTask(text);
      input.value = '';
      await this.loadTasks();
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  }

  async loadTimeData() {
    try {
      const timeData = await this.timeTracker.getTodayData();
      this.renderTimeData(timeData);
    } catch (error) {
      console.error('Failed to load time data:', error);
    }
  }

  renderTimeData(timeData) {
    const totalTimeElement = document.getElementById('total-time');
    const siteListElement = document.getElementById('site-time-list');

    // Format total time
    const totalRounded = Math.round(timeData.totalMinutes);
    const hours = Math.floor(totalRounded / 60);
    const minutes = totalRounded % 60;
    totalTimeElement.textContent = totalRounded < 1 && timeData.totalMinutes > 0
      ? '<1m'
      : `${hours}h ${minutes}m`;

    // Render site breakdown
    siteListElement.innerHTML = '';

    if (timeData.sites.length === 0) {
      siteListElement.innerHTML = '<li class="empty-state">No browsing data yet</li>';
      return;
    }

    timeData.sites.slice(0, 5).forEach(site => {
      const li = document.createElement('li');
      li.className = 'site-time-item';
      li.innerHTML = `
        <span class="site-name">
          <img src="https://www.google.com/s2/favicons?domain=${site.domain}" class="site-favicon" alt="">
          ${this.escapeHtml(site.domain)}
        </span>
        <span class="site-duration">${this.formatDuration(site.minutes)}</span>
      `;
      siteListElement.appendChild(li);
    });
  }

  formatDuration(minutes) {
    const rounded = Math.round(minutes);
    if (rounded < 1) return '<1m';
    if (rounded < 60) {
      return `${rounded}m`;
    }
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    return `${hours}h ${mins}m`;
  }

  async loadFocusState() {
    try {
      const focusState = await this.focusMode.getState();
      const toggle = document.getElementById('focus-toggle');
      const timeDisplay = document.getElementById('focus-time');
      const blockedCount = document.getElementById('blocked-sites-count');

      toggle.checked = focusState.enabled;
      timeDisplay.textContent = this.formatFocusTime(focusState.remainingSeconds);
      blockedCount.textContent = `${focusState.blockedSitesCount} sites blocked`;

      if (focusState.enabled && focusState.timerRunning) {
        this.startFocusTimerUpdate();
      }
    } catch (error) {
      console.error('Failed to load focus state:', error);
    }
  }

  async toggleFocusMode(enabled) {
    try {
      await this.focusMode.setEnabled(enabled);
      if (enabled) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '../assets/icons/icon128.png',
          title: 'Focus Mode Enabled',
          message: 'Distracting sites are now blocked. Stay focused!'
        });
      }
    } catch (error) {
      console.error('Failed to toggle focus mode:', error);
    }
  }

  async startFocusTimer() {
    try {
      await this.focusMode.startTimer();
      this.startFocusTimerUpdate();
      
      document.getElementById('start-focus-btn').textContent = 'Pause';
    } catch (error) {
      console.error('Failed to start focus timer:', error);
    }
  }

  startFocusTimerUpdate() {
    const timeDisplay = document.getElementById('focus-time');
    
    this.focusTimerInterval = setInterval(async () => {
      const state = await this.focusMode.getState();
      timeDisplay.textContent = this.formatFocusTime(state.remainingSeconds);
      
      if (state.remainingSeconds <= 0) {
        clearInterval(this.focusTimerInterval);
        document.getElementById('start-focus-btn').textContent = 'Start Focus';
      }
    }, 1000);
  }

  async resetFocusTimer() {
    try {
      clearInterval(this.focusTimerInterval);
      await this.focusMode.resetTimer();
      document.getElementById('focus-time').textContent = '25:00';
      document.getElementById('start-focus-btn').textContent = 'Start Focus';
    } catch (error) {
      console.error('Failed to reset focus timer:', error);
    }
  }

  formatFocusTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  openLoginPage(tab = 'email') {
    // Open the login page in a new tab
    const loginUrl = chrome.runtime.getURL(`auth/login.html?tab=${tab}`);
    chrome.tabs.create({ url: loginUrl });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
