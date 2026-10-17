// Test fixture: authenticated admin user
// Usage: test.use({ storageState: 'e2e/fixtures/auth.json' })
// Generate with: npx playwright codegen http://localhost:3000 --save-storage=e2e/fixtures/auth.json

export const TEST_ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'admin@kingdoms-of-war.com',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'test-password',
};
