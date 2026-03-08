/**
 * Time Service Tests
 */

// Mock the logger before requiring TimeService
jest.mock('../../src/services/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const TimeService = require('../../src/services/timeService');

describe('TimeService', () => {
  let timeService;
  const userId = 'test-user-' + Date.now();

  beforeEach(() => {
    timeService = new TimeService();
  });

  describe('save', () => {
    it('should save time data for a date', async () => {
      const uniqueUserId = 'save-user-' + Date.now();
      const date = '2026-02-11';
      const sites = { 'google.com': 30, 'github.com': 45 };

      const result = await timeService.save(uniqueUserId, date, sites);

      expect(result.date).toBe(date);
      expect(result.sites['google.com']).toBe(30);
      expect(result.sites['github.com']).toBe(45);
    });

    it('should accumulate time for the same site', async () => {
      const uniqueUserId = 'accumulate-user-' + Date.now();
      const date = '2026-02-11';

      await timeService.save(uniqueUserId, date, { 'google.com': 30 });
      const result = await timeService.save(uniqueUserId, date, { 'google.com': 20 });

      expect(result.sites['google.com']).toBe(50);
    });

    it('should handle multiple sites', async () => {
      const uniqueUserId = 'multi-site-user-' + Date.now();
      const date = '2026-02-11';

      await timeService.save(uniqueUserId, date, { 'site1.com': 10 });
      await timeService.save(uniqueUserId, date, { 'site2.com': 20 });
      const result = await timeService.save(uniqueUserId, date, { 'site1.com': 5, 'site3.com': 15 });

      expect(result.sites['site1.com']).toBe(15);
      expect(result.sites['site2.com']).toBe(20);
      expect(result.sites['site3.com']).toBe(15);
    });
  });

  describe('getByDate', () => {
    it('should return empty data for non-existent date', async () => {
      const result = await timeService.getByDate(userId, '2026-01-01');

      expect(result.date).toBe('2026-01-01');
      expect(result.sites).toEqual({});
    });

    it('should return saved data for existing date', async () => {
      const uniqueUserId = 'get-date-user-' + Date.now();
      const date = '2026-02-11';
      
      await timeService.save(uniqueUserId, date, { 'test.com': 60 });
      const result = await timeService.getByDate(uniqueUserId, date);

      expect(result.sites['test.com']).toBe(60);
    });
  });

  describe('getByDateRange', () => {
    it('should return data for date range', async () => {
      const uniqueUserId = 'range-user-' + Date.now();
      
      await timeService.save(uniqueUserId, '2026-02-10', { 'site1.com': 30 });
      await timeService.save(uniqueUserId, '2026-02-11', { 'site2.com': 45 });
      await timeService.save(uniqueUserId, '2026-02-12', { 'site3.com': 60 });

      const result = await timeService.getByDateRange(uniqueUserId, '2026-02-10', '2026-02-12');

      expect(result.length).toBe(3);
    });

    it('should return empty array for range with no data', async () => {
      const uniqueUserId = 'empty-range-user-' + Date.now();
      
      const result = await timeService.getByDateRange(uniqueUserId, '2020-01-01', '2020-01-07');

      expect(result).toEqual([]);
    });

    it('should only return days with data', async () => {
      const uniqueUserId = 'partial-range-user-' + Date.now();
      
      await timeService.save(uniqueUserId, '2026-02-10', { 'site.com': 30 });
      // Skip 2026-02-11
      await timeService.save(uniqueUserId, '2026-02-12', { 'site.com': 30 });

      const result = await timeService.getByDateRange(uniqueUserId, '2026-02-10', '2026-02-12');

      expect(result.length).toBe(2);
    });
  });

  describe('getSummary', () => {
    it('should calculate total minutes', async () => {
      const uniqueUserId = 'summary-user-' + Date.now();
      const today = new Date().toISOString().split('T')[0];
      
      await timeService.save(uniqueUserId, today, { 'site1.com': 60, 'site2.com': 30 });

      const summary = await timeService.getSummary(uniqueUserId, 7);

      expect(summary.totalMinutes).toBeGreaterThanOrEqual(90);
    });

    it('should calculate total hours', async () => {
      const uniqueUserId = 'hours-user-' + Date.now();
      const today = new Date().toISOString().split('T')[0];
      
      await timeService.save(uniqueUserId, today, { 'site.com': 120 });

      const summary = await timeService.getSummary(uniqueUserId, 7);

      expect(summary.totalHours).toBeGreaterThanOrEqual(2);
    });

    it('should track number of days with data', async () => {
      const uniqueUserId = 'days-tracked-user-' + Date.now();
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      await timeService.save(uniqueUserId, today.toISOString().split('T')[0], { 'site.com': 30 });
      await timeService.save(uniqueUserId, yesterday.toISOString().split('T')[0], { 'site.com': 30 });

      const summary = await timeService.getSummary(uniqueUserId, 7);

      expect(summary.daysTracked).toBe(2);
    });
  });
});
