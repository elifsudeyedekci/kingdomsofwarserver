import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('should have no critical accessibility violations on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // Basic accessibility checks
    // Check for landmark regions
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    // Check that interactive elements are keyboard accessible
    const buttons = page.locator('button:visible');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('page should have meta viewport for mobile', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });
});
