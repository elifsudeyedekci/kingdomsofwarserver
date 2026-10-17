/**
 * Jest configuration for integration tests.
 *
 * Integration tests hit a real PostgreSQL database and are intentionally
 * excluded from the default `npm test` run. Use `npm run test:integration`.
 *
 * DATABASE_URL must be set (typically via .env.test) before running.
 */

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '\\.integration\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  // Load .env.test before running so DATABASE_URL is available.
  globalSetup: '../jest.integration.global-setup.js',
  // Give DB-backed tests more time than the default 5 s.
  testTimeout: 30000,
  // Ensure the app is fully closed after each suite.
  forceExit: true,
  verbose: true,
};
