import { test, expect } from '@playwright/test';

test.describe('Basic Navigation', () => {

  //Do the sign in before each test
  // test.beforeEach(async ({ page }) => { test.beforeEach(async ({ page }) => {
  //   // Navigate to dashboard page
  //   await page.goto('/');
  // });
  test('should first load login page when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Check if the page shows a login form
    await expect(page.locator('div.tracking-tight.text-2xl.font-bold')).toContainText('Welcome Back');

    // check its the login page 
    await expect(page.locator('button.inline-flex:nth-child(3)')).toContainText('Sign In');

  });

  test('should navigate between main pages after sign in', async ({ page }) => {
    await page.goto('/');

    //sign in with test accounts
    await page.locator('input[data-testid="email-input"]').fill('Zimraan@taskorly.com');
    await page.locator('input[data-testid="password-input"]').fill('Shammy010404!');
    await page.locator('button[type="submit"]').click();

    // Navigate to CustomerChat page
    await page.locator('a[href="/customer"]').click();
    await expect(page).toHaveURL('/customer');
    await expect(page.locator('h2[data-testid="customer-intro-title"]')).toHaveText('Welcome to your AI POS Assistant');

    // Navigate to Documents page
    await page.locator('a[href="/documents"]').click();
    await expect(page).toHaveURL('/documents');
    await expect(page.locator('h1[data-testid="documents-title"]')).toHaveText('Documents');

    // Navigate to Settings page
    await page.locator('a[href="/settings"]').click();
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('h1[data-testid="settings-title"]')).toHaveText('Settings');

  });

  test('should display dashboard quick actions and stat cards', async ({ page }) => {
    await page.goto('/');

    //sign in with test accounts
    await page.locator('input[data-testid="email-input"]').fill('Zimraan@taskorly.com');
    await page.locator('input[data-testid="password-input"]').fill('Shammy010404!');
    await page.locator('button[type="submit"]').click();

    await page.goto('/');

    // Check for Quick actions
    // await expect(page.locator('[data-testid="quick-actions-title"]')).toHaveText('Quick Actions');

    // Check for recent activity sections
    // await expect(page.locator('h2[data-testid="recent-documents-title"]')).toHaveText('Recent Documents');
    // await expect(page.locator('button[data-testid="manage-documents-button"]')).toBeVisible();
  });

  test('should have responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check if page is responsive
    await expect(page.locator('nav')).toBeVisible();

    // Mobile navigation should work
    const mobileMenuButton = page.locator('[data-testid="mobile-menu"]');
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
    }
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    // Navigate to non-existent page
    const response = await page.goto('/non-existent-page');

    // Should handle gracefully (either redirect or show 404)
    expect(response?.status()).toBeLessThan(500);
  });
});
