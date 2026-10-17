/**
 * Jest global setup for integration tests.
 *
 * Loads .env.test into process.env before any test module is imported,
 * so DATABASE_URL and other secrets are available to NestJS ConfigModule.
 *
 * This runs once per worker in a separate Node process — keep it lightweight.
 */

const path = require('path');
const fs = require('fs');

module.exports = async function globalSetup() {
  const envTestPath = path.resolve(__dirname, '.env.test');

  if (!fs.existsSync(envTestPath)) {
    console.warn(
      '[integration] .env.test not found — falling back to existing process.env. ' +
        'Copy .env.example to .env.test and set DATABASE_URL to run integration tests.',
    );
    return;
  }

  // Simple key=value parser — avoids pulling in dotenv as a prod dependency.
  const lines = fs.readFileSync(envTestPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    // Do not override values already set in the process environment.
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  console.log('[integration] Loaded environment from .env.test');
};
