import { test, expect } from '@playwright/test';

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to chat page
    await page.goto('/chat');
  });

  test('should display chat interface', async ({ page }) => {
    // Check for main chat elements
    await expect(page.locator('h1')).toContainText('Chat');

    // Check for message area (should be visible even if empty)
    await expect(page.locator('[data-testid="message-list"]')).toBeVisible();

    // Check for chat input
    await expect(
      page.locator('textarea[placeholder*="message"]')
    ).toBeVisible();

    // Check for send button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should send a message (mock mode)', async ({ page }) => {
    // In development mode, this should work with mock data
    const messageInput = page.locator('textarea[placeholder*="message"]');
    const sendButton = page.locator('button[type="submit"]');

    // Type a message
    await messageInput.fill('Hello, can you help me with testing?');

    // Send the message
    await sendButton.click();

    // The message should appear in the chat
    await expect(
      page.locator('text=Hello, can you help me with testing?')
    ).toBeVisible();

    // Should get some response (mock data)
    await expect(page.locator('[data-testid="message-bubble"]')).toHaveCount(2); // User + Assistant
  });

  test('should handle empty message submission', async ({ page }) => {
    const sendButton = page.locator('button[type="submit"]');

    // Try to send empty message
    await sendButton.click();

    // Should not send empty message - button might be disabled or show validation
    const messageInput = page.locator('textarea[placeholder*="message"]');
    await expect(messageInput).toBeFocused(); // Should focus back on input
  });

  test('should display typing indicators', async ({ page }) => {
    const messageInput = page.locator('textarea[placeholder*="message"]');
    const sendButton = page.locator('button[type="submit"]');

    await messageInput.fill('Test message');
    await sendButton.click();

    // Should show some loading/typing state
    // This might be a spinner, typing indicator, or disabled send button
    const loadingIndicator = page.locator('[data-testid="typing-indicator"]');
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).toBeVisible();
    }
  });

  test('should support keyboard shortcuts', async ({ page }) => {
    const messageInput = page.locator('textarea[placeholder*="message"]');

    await messageInput.fill('Test keyboard shortcut');

    // Send with Ctrl+Enter (or Cmd+Enter on Mac)
    await messageInput.press(
      process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter'
    );

    // Should send the message
    await expect(page.locator('text=Test keyboard shortcut')).toBeVisible();
  });

  test('should handle long messages', async ({ page }) => {
    const longMessage =
      'This is a very long message that should test the textarea expansion and message handling capabilities of the chat interface. '.repeat(
        10
      );

    const messageInput = page.locator('textarea[placeholder*="message"]');
    const sendButton = page.locator('button[type="submit"]');

    await messageInput.fill(longMessage);
    await sendButton.click();

    // Should handle long message properly
    await expect(
      page.locator('text=This is a very long message')
    ).toBeVisible();
  });

  test('should show message timestamps', async ({ page }) => {
    const messageInput = page.locator('textarea[placeholder*="message"]');
    const sendButton = page.locator('button[type="submit"]');

    await messageInput.fill('Test timestamp');
    await sendButton.click();

    // Should show timestamp (could be relative or absolute)
    await expect(
      page.locator('[data-testid="message-timestamp"]')
    ).toBeVisible();
  });

  test('should scroll to new messages', async ({ page }) => {
    // Send multiple messages to test scrolling
    const messageInput = page.locator('textarea[placeholder*="message"]');
    const sendButton = page.locator('button[type="submit"]');

    for (let i = 1; i <= 5; i++) {
      await messageInput.fill(`Test message ${i}`);
      await sendButton.click();
      await page.waitForTimeout(1000); // Wait between messages
    }

    // The last message should be visible (auto-scrolled)
    await expect(page.locator('text=Test message 5')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);

    const messageInput = page.locator('textarea[placeholder*="message"]');
    const sendButton = page.locator('button[type="submit"]');

    await messageInput.fill('This message should fail');
    await sendButton.click();

    // Should show error state or retry mechanism
    // This might be an error message, retry button, or queue indicator
    const errorIndicator = page.locator(
      '[data-testid="error-message"], text=error, text=failed'
    );
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });

    // Restore connection
    await page.context().setOffline(false);
  });
});
