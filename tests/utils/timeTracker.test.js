/**
 * Time Tracker Tests
 */

import { TimeTracker } from '../../src/utils/timeTracker.js';

describe('TimeTracker', () => {
  let timeTracker;

  beforeEach(() => {
    timeTracker = new TimeTracker();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-11T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('trackSite', () => {
    it('should start tracking a new site', async () => {
      await timeTracker.trackSite('https://example.com/page');
      
      expect(timeTracker.currentSite).toBe('example.com');
      expect(timeTracker.startTime).toBeDefined();
    });

    it('should not track internal URLs', async () => {
      await timeTracker.trackSite('chrome://extensions');
      
      expect(timeTracker.currentSite).toBeNull();
    });

    it('should not track chrome-extension URLs', async () => {
      await timeTracker.trackSite('chrome-extension://abc123/popup.html');
      
      expect(timeTracker.currentSite).toBeNull();
    });

    it('should save elapsed time when switching sites', async () => {
      await timeTracker.trackSite('https://site1.com');
      
      // Advance time by 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);
      
      await timeTracker.trackSite('https://site2.com');
      
      // Time should have been saved for site1
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });
  });

  describe('shouldSkip', () => {
    it('should skip chrome:// URLs', () => {
      expect(timeTracker.shouldSkip('chrome://settings')).toBe(true);
    });

    it('should skip chrome-extension:// URLs', () => {
      expect(timeTracker.shouldSkip('chrome-extension://id/page.html')).toBe(true);
    });

    it('should skip about: URLs', () => {
      expect(timeTracker.shouldSkip('about:blank')).toBe(true);
    });

    it('should skip file:// URLs', () => {
      expect(timeTracker.shouldSkip('file:///C:/test.html')).toBe(true);
    });

    it('should not skip regular URLs', () => {
      expect(timeTracker.shouldSkip('https://example.com')).toBe(false);
    });
  });

  describe('saveElapsedTime', () => {
    it('should not save if no current site', async () => {
      await timeTracker.saveElapsedTime();
      
      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    });

    it('should not save less than 1 minute', async () => {
      await timeTracker.trackSite('https://example.com');
      jest.advanceTimersByTime(30 * 1000); // 30 seconds
      
      await timeTracker.saveElapsedTime();
      
      // No time data should be saved
      expect(global.__chromeStorageSync.timeData).toBeUndefined();
    });

    it('should save time after 1 minute', async () => {
      await timeTracker.trackSite('https://example.com');
      jest.advanceTimersByTime(3 * 60 * 1000); // 3 minutes
      
      await timeTracker.saveElapsedTime();
      
      const timeData = global.__chromeStorageSync.timeData;
      expect(timeData).toBeDefined();
    });

    it('should accumulate time for the same site', async () => {
      // First visit
      await timeTracker.trackSite('https://example.com');
      jest.advanceTimersByTime(5 * 60 * 1000);
      await timeTracker.saveElapsedTime();
      
      // Reset tracking for second visit
      timeTracker.currentSite = 'example.com';
      timeTracker.startTime = Date.now();
      
      jest.advanceTimersByTime(5 * 60 * 1000);
      await timeTracker.saveElapsedTime();
      
      const timeData = global.__chromeStorageSync.timeData;
      const today = timeTracker.getDateKey();
      expect(timeData[today]['example.com']).toBe(10);
    });
  });

  describe('getTodayData', () => {
    it('should return empty data for new day', async () => {
      const data = await timeTracker.getTodayData();
      
      expect(data.totalMinutes).toBe(0);
      expect(data.sites).toEqual([]);
      expect(data.date).toBe('2026-02-11');
    });

    it('should return sites sorted by time', async () => {
      const today = timeTracker.getDateKey();
      global.__chromeStorageSync.timeData = {
        [today]: {
          'facebook.com': 30,
          'google.com': 15,
          'youtube.com': 60
        }
      };
      
      const data = await timeTracker.getTodayData();
      
      expect(data.totalMinutes).toBe(105);
      expect(data.sites[0].domain).toBe('youtube.com');
      expect(data.sites[1].domain).toBe('facebook.com');
      expect(data.sites[2].domain).toBe('google.com');
    });
  });

  describe('getTimeDataRange', () => {
    it('should return data for specified days', async () => {
      const today = timeTracker.formatDate(new Date());
      const yesterday = timeTracker.formatDate(new Date(Date.now() - 86400000));
      
      global.__chromeStorageSync.timeData = {
        [today]: { 'site1.com': 60 },
        [yesterday]: { 'site2.com': 30 }
      };
      
      const data = await timeTracker.getTimeDataRange(2);
      
      expect(data).toHaveLength(2);
      expect(data[0].date).toBe(today);
      expect(data[0].totalMinutes).toBe(60);
    });
  });

  describe('getTopSites', () => {
    it('should aggregate time across all days', async () => {
      const day1 = '2026-02-10';
      const day2 = '2026-02-11';
      
      global.__chromeStorageSync.timeData = {
        [day1]: { 'site1.com': 30, 'site2.com': 20 },
        [day2]: { 'site1.com': 45, 'site3.com': 10 }
      };
      
      const topSites = await timeTracker.getTopSites(10);
      
      expect(topSites[0].domain).toBe('site1.com');
      expect(topSites[0].minutes).toBe(75);
    });

    it('should limit results', async () => {
      const today = timeTracker.getDateKey();
      global.__chromeStorageSync.timeData = {
        [today]: {
          'site1.com': 10,
          'site2.com': 20,
          'site3.com': 30,
          'site4.com': 40,
          'site5.com': 50
        }
      };
      
      const topSites = await timeTracker.getTopSites(3);
      
      expect(topSites).toHaveLength(3);
      expect(topSites[0].domain).toBe('site5.com');
    });
  });

  describe('clearData', () => {
    it('should clear all time data', async () => {
      global.__chromeStorageSync.timeData = { '2026-02-11': { 'test.com': 10 } };
      timeTracker.currentSite = 'test.com';
      timeTracker.startTime = Date.now();
      
      await timeTracker.clearData();
      
      expect(chrome.storage.sync.remove).toHaveBeenCalledWith('timeData', expect.any(Function));
      expect(timeTracker.currentSite).toBeNull();
      expect(timeTracker.startTime).toBeNull();
    });
  });

  describe('getDateKey', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const key = timeTracker.getDateKey();
      
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(key).toBe('2026-02-11');
    });
  });

  describe('formatDuration', () => {
    it('should format minutes only', () => {
      expect(timeTracker.formatDuration(45)).toBe('45m');
    });

    it('should format hours only', () => {
      expect(timeTracker.formatDuration(120)).toBe('2h');
    });

    it('should format hours and minutes', () => {
      expect(timeTracker.formatDuration(135)).toBe('2h 15m');
    });
  });
});
