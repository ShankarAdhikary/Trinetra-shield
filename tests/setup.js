/**
 * Jest Test Setup
 * Mocks for Chrome Extension APIs and common test utilities
 */

// Mock Chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: jest.fn((key, callback) => {
        const data = global.__chromeStorageSync || {};
        if (typeof key === 'string') {
          callback({ [key]: data[key] });
        } else if (key === null) {
          callback(data);
        } else {
          callback(data);
        }
      }),
      set: jest.fn((items, callback) => {
        global.__chromeStorageSync = { ...global.__chromeStorageSync, ...items };
        if (callback) callback();
      }),
      remove: jest.fn((key, callback) => {
        delete global.__chromeStorageSync[key];
        if (callback) callback();
      }),
      clear: jest.fn((callback) => {
        global.__chromeStorageSync = {};
        if (callback) callback();
      }),
      getBytesInUse: jest.fn((keys, callback) => callback(0)),
      QUOTA_BYTES: 102400
    },
    local: {
      get: jest.fn((key, callback) => {
        const data = global.__chromeStorageLocal || {};
        if (typeof key === 'string') {
          callback({ [key]: data[key] });
        } else if (key === null) {
          callback(data);
        } else {
          callback(data);
        }
      }),
      set: jest.fn((items, callback) => {
        global.__chromeStorageLocal = { ...global.__chromeStorageLocal, ...items };
        if (callback) callback();
      }),
      remove: jest.fn((key, callback) => {
        delete global.__chromeStorageLocal[key];
        if (callback) callback();
      }),
      clear: jest.fn((callback) => {
        global.__chromeStorageLocal = {};
        if (callback) callback();
      }),
      getBytesInUse: jest.fn((keys, callback) => callback(0)),
      QUOTA_BYTES: 5242880
    }
  },
  runtime: {
    lastError: null,
    sendMessage: jest.fn(),
    getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`),
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    openOptionsPage: jest.fn()
  },
  tabs: {
    query: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    onActivated: {
      addListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn()
    }
  },
  webNavigation: {
    onBeforeNavigate: {
      addListener: jest.fn()
    },
    onCompleted: {
      addListener: jest.fn()
    }
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  },
  notifications: {
    create: jest.fn(),
    clear: jest.fn(),
    update: jest.fn(),
    getAll: jest.fn(),
    onClicked: {
      addListener: jest.fn()
    },
    onButtonClicked: {
      addListener: jest.fn()
    },
    onClosed: {
      addListener: jest.fn()
    }
  }
};

// Reset storage between tests
beforeEach(() => {
  global.__chromeStorageSync = {};
  global.__chromeStorageLocal = {};
  chrome.runtime.lastError = null;
  jest.clearAllMocks();
});

// Custom matchers
expect.extend({
  toBeValidTask(received) {
    const pass = 
      received &&
      typeof received.id === 'string' &&
      typeof received.text === 'string' &&
      typeof received.completed === 'boolean' &&
      typeof received.createdAt === 'number';
    
    return {
      pass,
      message: () => pass
        ? `expected ${JSON.stringify(received)} not to be a valid task`
        : `expected ${JSON.stringify(received)} to be a valid task`
    };
  }
});
