import { test, expect } from '@playwright/test';

// These tests assume we can bypass auth (mock or seeded test user)
// In CI, use NEXTAUTH_SECRET and a seeded admin user
test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard — auth will redirect if needed
    await page.goto('/dashboard');
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Dashboard|Kingdoms of War/i);
  });

  test('should display navigation sidebar', async ({ page }) => {
    // Check for sidebar navigation links
    const sidebar = page.locator('nav, aside, [data-testid="sidebar"]').first();
    await expect(sidebar).toBeVisible();
  });

  test('should have dashboard heading', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
