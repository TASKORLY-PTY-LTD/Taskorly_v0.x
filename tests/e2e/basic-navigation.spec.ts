import { test, expect } from '@playwright/test';

test.describe('Basic Navigation', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/');

    // Check if the page loads and has expected content
    await expect(page).toHaveTitle(/Taskorly/);

    // Check for main dashboard elements
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Check for navigation elements
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should navigate between main pages', async ({ page }) => {
    await page.goto('/');

    // Navigate to Chat page
    await page.locator('a[href="/chat"]').click();
    await expect(page).toHaveURL('/chat');
    await expect(page.locator('h1')).toContainText('Chat');

    // Navigate to Documents page
    await page.locator('a[href="/documents"]').click();
    await expect(page).toHaveURL('/documents');
    await expect(page.locator('h1')).toContainText('Documents');

    // Navigate to Settings page
    await page.locator('a[href="/settings"]').click();
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('h1')).toContainText('Settings');

    // Navigate to Servers page
    await page.locator('a[href="/servers"]').click();
    await expect(page).toHaveURL('/servers');
    await expect(page.locator('h1')).toContainText('MCP Servers');
  });

  test('should display dashboard statistics', async ({ page }) => {
    await page.goto('/');

    // Check for stat cards
    await expect(page.locator('text=Total Messages')).toBeVisible();
    await expect(page.locator('text=Documents')).toBeVisible();
    await expect(page.locator('text=MCP Servers')).toBeVisible();
    await expect(page.locator('text=System Status')).toBeVisible();

    // Check for recent activity sections
    await expect(page.locator('text=Recent Messages')).toBeVisible();
    await expect(page.locator('text=Recent Documents')).toBeVisible();

    // Check for quick actions
    await expect(page.locator('text=Quick Actions')).toBeVisible();
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
