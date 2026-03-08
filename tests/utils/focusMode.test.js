/**
 * Focus Mode Tests
 */

import { FocusMode } from '../../src/utils/focusMode.js';

describe('FocusMode', () => {
  let focusMode;

  beforeEach(() => {
    focusMode = new FocusMode();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-11T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getState', () => {
    it('should return default state when not set', async () => {
      const state = await focusMode.getState();
      
      expect(state.enabled).toBe(false);
      expect(state.timerRunning).toBe(false);
      expect(state.duration).toBe(25 * 60);
      expect(state.blockedSitesCount).toBe(0);
    });

    it('should return stored state', async () => {
      global.__chromeStorageSync.focusState = {
        enabled: true,
        timerRunning: false,
        duration: 30 * 60,
        remainingSeconds: 30 * 60
      };
      global.__chromeStorageSync.settings = {
        blockedSites: ['facebook.com', 'twitter.com']
      };
      
      const state = await focusMode.getState();
      
      expect(state.enabled).toBe(true);
      expect(state.blockedSitesCount).toBe(2);
    });

    it('should calculate remaining time for running timer', async () => {
      global.__chromeStorageSync.focusState = {
        enabled: true,
        timerRunning: true,
        startTime: Date.now() - (10 * 60 * 1000), // Started 10 minutes ago
        duration: 25 * 60,
        remainingSeconds: 25 * 60
      };
      
      const state = await focusMode.getState();
      
      expect(state.remainingSeconds).toBe(15 * 60); // 15 minutes remaining
    });

    it('should stop timer when time expires', async () => {
      global.__chromeStorageSync.focusState = {
        enabled: true,
        timerRunning: true,
        startTime: Date.now() - (30 * 60 * 1000), // Started 30 minutes ago
        duration: 25 * 60,
        remainingSeconds: 25 * 60
      };
      
      const state = await focusMode.getState();
      
      expect(state.remainingSeconds).toBe(0);
      expect(state.timerRunning).toBe(false);
    });
  });

  describe('setEnabled', () => {
    it('should enable focus mode', async () => {
      const result = await focusMode.setEnabled(true);
      
      expect(result.success).toBe(true);
      expect(result.enabled).toBe(true);
      expect(global.__chromeStorageSync.focusState.enabled).toBe(true);
    });

    it('should disable focus mode and stop timer', async () => {
      global.__chromeStorageSync.focusState = {
        enabled: true,
        timerRunning: true,
        startTime: Date.now()
      };
      
      const result = await focusMode.setEnabled(false);
      
      expect(result.enabled).toBe(false);
      expect(global.__chromeStorageSync.focusState.timerRunning).toBe(false);
      expect(global.__chromeStorageSync.focusState.startTime).toBeNull();
    });
  });

  describe('startTimer', () => {
    it('should start the focus timer', async () => {
      global.__chromeStorageSync.settings = { focusDuration: 30 };
      
      const result = await focusMode.startTimer();
      
      expect(result.success).toBe(true);
      expect(result.duration).toBe(30 * 60);
      expect(global.__chromeStorageSync.focusState.enabled).toBe(true);
      expect(global.__chromeStorageSync.focusState.timerRunning).toBe(true);
      expect(chrome.alarms.create).toHaveBeenCalledWith('focusTimer', { delayInMinutes: 30 });
    });

    it('should use default duration if not configured', async () => {
      const result = await focusMode.startTimer();
      
      expect(result.duration).toBe(25 * 60);
    });
  });

  describe('pauseTimer', () => {
    it('should pause the timer and save remaining time', async () => {
      global.__chromeStorageSync.focusState = {
        enabled: true,
        timerRunning: true,
        startTime: Date.now() - (10 * 60 * 1000),
        duration: 25 * 60,
        remainingSeconds: 25 * 60
      };
      
      const result = await focusMode.pauseTimer();
      
      expect(result.success).toBe(true);
      expect(global.__chromeStorageSync.focusState.timerRunning).toBe(false);
      expect(global.__chromeStorageSync.focusState.remainingSeconds).toBe(15 * 60);
      expect(chrome.alarms.clear).toHaveBeenCalledWith('focusTimer');
    });
  });

  describe('resetTimer', () => {
    it('should reset the timer to initial state', async () => {
      global.__chromeStorageSync.focusState = {
        enabled: true,
        timerRunning: true,
        startTime: Date.now()
      };
      global.__chromeStorageSync.settings = { focusDuration: 30 };
      
      const result = await focusMode.resetTimer();
      
      expect(result.success).toBe(true);
      expect(global.__chromeStorageSync.focusState.enabled).toBe(false);
      expect(global.__chromeStorageSync.focusState.timerRunning).toBe(false);
      expect(global.__chromeStorageSync.focusState.remainingSeconds).toBe(30 * 60);
      expect(chrome.alarms.clear).toHaveBeenCalledWith('focusTimer');
    });
  });

  describe('setDuration', () => {
    it('should update duration in seconds', async () => {
      await focusMode.setDuration(45);
      
      expect(global.__chromeStorageSync.focusState.duration).toBe(45 * 60);
    });

    it('should update remaining time if timer not running', async () => {
      await focusMode.setDuration(45);
      
      expect(global.__chromeStorageSync.focusState.remainingSeconds).toBe(45 * 60);
    });

    it('should not update remaining time if timer is running', async () => {
      global.__chromeStorageSync.focusState = {
        timerRunning: true,
        remainingSeconds: 600
      };
      
      await focusMode.setDuration(45);
      
      expect(global.__chromeStorageSync.focusState.remainingSeconds).toBe(600);
    });
  });

  describe('isBlocked', () => {
    beforeEach(() => {
      global.__chromeStorageSync.focusState = { enabled: true };
      global.__chromeStorageSync.settings = {
        blockedSites: ['facebook.com', 'twitter.com', 'reddit.com']
      };
    });

    it('should return false when focus mode disabled', async () => {
      global.__chromeStorageSync.focusState = { enabled: false };
      
      const result = await focusMode.isBlocked('https://facebook.com');
      
      expect(result).toBe(false);
    });

    it('should block exact domain match', async () => {
      const result = await focusMode.isBlocked('https://facebook.com/feed');
      
      expect(result).toBe(true);
    });

    it('should block subdomain of blocked site', async () => {
      const result = await focusMode.isBlocked('https://www.facebook.com/page');
      
      expect(result).toBe(true);
    });

    it('should block m. subdomain', async () => {
      const result = await focusMode.isBlocked('https://m.facebook.com');
      
      expect(result).toBe(true);
    });

    it('should not block unrelated sites', async () => {
      const result = await focusMode.isBlocked('https://google.com');
      
      expect(result).toBe(false);
    });

    it('should not block similar named sites', async () => {
      const result = await focusMode.isBlocked('https://facebookish.com');
      
      expect(result).toBe(false);
    });

    it('should handle invalid URLs gracefully', async () => {
      const result = await focusMode.isBlocked('not-a-valid-url');
      
      expect(result).toBe(false);
    });
  });

  describe('addBlockedSite', () => {
    it('should add a new site to blocked list', async () => {
      global.__chromeStorageSync.settings = {
        blockedSites: ['facebook.com']
      };
      
      const result = await focusMode.addBlockedSite('instagram.com');
      
      expect(result.success).toBe(true);
      expect(result.blockedSites).toContain('instagram.com');
      expect(result.blockedSites).toContain('facebook.com');
    });

    it('should not add duplicate sites', async () => {
      global.__chromeStorageSync.settings = {
        blockedSites: ['facebook.com']
      };
      
      const result = await focusMode.addBlockedSite('Facebook.com');
      
      expect(result.blockedSites).toHaveLength(1);
    });

    it('should trim whitespace from site', async () => {
      global.__chromeStorageSync.settings = { blockedSites: [] };
      
      const result = await focusMode.addBlockedSite('  twitter.com  ');
      
      expect(result.blockedSites[0]).toBe('twitter.com');
    });
  });
});
