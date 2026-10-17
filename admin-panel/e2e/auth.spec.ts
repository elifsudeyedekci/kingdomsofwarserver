import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page for unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login or show auth UI
    await expect(page).toHaveURL(/login|auth|sign-in/);
  });

  test('should show login form with email and password fields', async ({ page }) => {
    await page.goto('/');
    // Check for login form elements
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"], input[name="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should show error message
    await expect(page.locator('text=Invalid credentials, text=error, [role="alert"]').first()).toBeVisible({ timeout: 5000 });
  });
});
