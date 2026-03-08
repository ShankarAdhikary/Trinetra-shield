/** @type {import('jest').Config} */
module.exports = {
  // Test environment for browser-like testing
  testEnvironment: 'jsdom',
  
  // Transform ES modules
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Also transform src files
  transformIgnorePatterns: [
    '/node_modules/'
  ],
  
  // Files to test
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  
  // Exclude backend tests (they have their own jest config)
  testPathIgnorePatterns: [
    '/node_modules/',
    '/backend/'
  ],
  
  // Test coverage configuration
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Module paths
  moduleDirectories: ['node_modules', 'src'],
  
  // Module name mapper for imports
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output
  verbose: true
};
