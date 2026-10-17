import { test, expect } from '@playwright/test';

test.describe('Players Management', () => {
  test('should display players list page', async ({ page }) => {
    await page.goto('/dashboard/players');
    // Should have a table or list of players
    await expect(page.locator('table, [role="grid"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('should have search functionality', async ({ page }) => {
    await page.goto('/dashboard/players');
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();
    await expect(searchInput).toBeVisible();
  });
});
