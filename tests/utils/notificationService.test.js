/**
 * Notification Service Tests
 */

import { NotificationService } from '../../src/utils/notificationService.js';

describe('NotificationService', () => {
  let notificationService;

  beforeEach(() => {
    notificationService = new NotificationService();
    global.__chromeStorageLocal = {};
    global.__chromeStorageSync = {};
    chrome.notifications.create.mockClear();
    chrome.notifications.clear.mockClear();
    chrome.notifications.update.mockClear();
    chrome.notifications.getAll.mockClear();
  });

  describe('show', () => {
    it('should create a notification with default options', async () => {
      chrome.notifications.create.mockImplementation((id, options, cb) => cb(id));

      const result = await notificationService.show({
        title: 'Test Title',
        message: 'Test Message'
      });

      expect(result).toBeDefined();
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'basic',
          title: 'Test Title',
          message: 'Test Message'
        }),
        expect.any(Function)
      );
    });

    it('should return null when notifications are disabled', async () => {
      global.__chromeStorageSync.settings = { notificationsEnabled: false };

      const result = await notificationService.show({
        title: 'Test',
        message: 'Test'
      });

      expect(result).toBeNull();
      expect(chrome.notifications.create).not.toHaveBeenCalled();
    });

    it('should use custom notification ID when provided', async () => {
      chrome.notifications.create.mockImplementation((id, options, cb) => cb(id));

      const result = await notificationService.show({
        id: 'custom_id',
        title: 'Test',
        message: 'Test'
      });

      expect(result).toBe('custom_id');
    });

    it('should include buttons when provided', async () => {
      chrome.notifications.create.mockImplementation((id, options, cb) => cb(id));

      await notificationService.show({
        title: 'Test',
        message: 'Test',
        buttons: [{ title: 'OK' }, { title: 'Cancel' }]
      });

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          buttons: [{ title: 'OK' }, { title: 'Cancel' }]
        }),
        expect.any(Function)
      );
    });

    it('should auto-clear notification after timeout', async () => {
      jest.useFakeTimers();
      chrome.notifications.create.mockImplementation((id, options, cb) => cb(id));
      chrome.notifications.clear.mockImplementation((id, cb) => cb(true));

      await notificationService.show({
        title: 'Test',
        message: 'Test',
        timeout: 5000
      });

      jest.advanceTimersByTime(5000);

      expect(chrome.notifications.clear).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('should reject on chrome runtime error', async () => {
      chrome.runtime.lastError = { message: 'Test error' };
      chrome.notifications.create.mockImplementation((id, options, cb) => cb(id));

      await expect(notificationService.show({
        title: 'Test',
        message: 'Test'
      })).rejects.toEqual({ message: 'Test error' });

      chrome.runtime.lastError = null;
    });
  });

  describe('clear', () => {
    it('should clear a notification', async () => {
      chrome.notifications.clear.mockImplementation((id, cb) => cb(true));

      const result = await notificationService.clear('test_id');
      expect(result).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should clear all notifications', async () => {
      chrome.notifications.getAll.mockImplementation((cb) => cb({ id1: {}, id2: {} }));
      chrome.notifications.clear.mockImplementation((id, cb) => cb(true));

      await notificationService.clearAll();

      expect(chrome.notifications.clear).toHaveBeenCalledTimes(2);
    });

    it('should resolve when no notifications exist', async () => {
      chrome.notifications.getAll.mockImplementation((cb) => cb({}));

      await expect(notificationService.clearAll()).resolves.toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update a notification', async () => {
      chrome.notifications.update.mockImplementation((id, options, cb) => cb(true));

      const result = await notificationService.update('test_id', { message: 'Updated' });
      expect(result).toBe(true);
    });
  });

  describe('event listeners', () => {
    it('should register onClicked listener', () => {
      const callback = jest.fn();
      notificationService.onClicked(callback);
      expect(chrome.notifications.onClicked.addListener).toHaveBeenCalledWith(callback);
    });

    it('should register onButtonClicked listener', () => {
      const callback = jest.fn();
      notificationService.onButtonClicked(callback);
      expect(chrome.notifications.onButtonClicked.addListener).toHaveBeenCalledWith(callback);
    });

    it('should register onClosed listener', () => {
      const callback = jest.fn();
      notificationService.onClosed(callback);
      expect(chrome.notifications.onClosed.addListener).toHaveBeenCalledWith(callback);
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      chrome.notifications.create.mockImplementation((id, options, cb) => cb(id));
    });

    it('should show threat notification', async () => {
      const result = await notificationService.showThreatNotification({
        message: 'Threat detected!'
      });

      expect(result).toBeDefined();
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        expect.stringContaining('threat_'),
        expect.objectContaining({
          title: expect.stringContaining('Security Threat'),
          priority: 2,
          requireInteraction: true
        }),
        expect.any(Function)
      );
    });

    it('should show break reminder', async () => {
      const result = await notificationService.showBreakReminder();

      expect(result).toBeDefined();
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'break_reminder',
        expect.objectContaining({
          title: expect.stringContaining('Break')
        }),
        expect.any(Function)
      );
    });

    it('should show focus mode started notification', async () => {
      await notificationService.showFocusModeNotification(true);

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'focus_mode',
        expect.objectContaining({
          title: expect.stringContaining('Focus Mode Started')
        }),
        expect.any(Function)
      );
    });

    it('should show focus mode completed notification', async () => {
      await notificationService.showFocusModeNotification(false);

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'focus_mode',
        expect.objectContaining({
          title: expect.stringContaining('Complete')
        }),
        expect.any(Function)
      );
    });

    it('should show task reminder', async () => {
      await notificationService.showTaskReminder({ id: '123', text: 'Do something' });

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'task_123',
        expect.objectContaining({
          title: expect.stringContaining('Task'),
          message: 'Do something'
        }),
        expect.any(Function)
      );
    });

    it('should show daily summary', async () => {
      await notificationService.showDailySummary({
        totalMinutes: 125,
        threatsBlocked: 3
      });

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'daily_summary',
        expect.objectContaining({
          title: expect.stringContaining('Summary'),
          message: expect.stringContaining('2h 5m')
        }),
        expect.any(Function)
      );
    });

    it('should request permission (always grants for extensions)', async () => {
      const result = await notificationService.requestPermission();
      expect(result).toBe(true);
    });
  });
});
