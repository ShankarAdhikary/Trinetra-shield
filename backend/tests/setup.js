/**
 * Backend Jest Test Setup
 */

// Set test environment variables BEFORE any imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.PORT = '3001';

// Polyfill setImmediate for JSDOM environment
if (typeof setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

// Mock logger to avoid console output during tests
jest.mock('../src/services/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
