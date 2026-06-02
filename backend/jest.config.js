'use strict';

module.exports = {
  testEnvironment: 'node',
  // Resolve '@/' imports the same way module-alias does, but inside Jest's resolver
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Each test file gets its own module registry — avoids cross-test model leakage
  resetModules: false,
  testTimeout: 60000,
  testMatch: ['**/src/__tests__/**/*.test.js'],
  // Print each describe/it name so failures are easy to locate
  verbose: true,
};
