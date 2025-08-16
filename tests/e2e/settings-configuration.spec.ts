import { test, expect } from '@playwright/test';

test.describe('Settings Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('should display settings page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Settings');

    // Check for main settings sections
    await expect(page.locator('text=LLM Configuration')).toBeVisible();
    await expect(page.locator('text=RAG Settings')).toBeVisible();
    await expect(page.locator('text=System Settings')).toBeVisible();
  });

  test('should show LLM provider options', async ({ page }) => {
    const providerSelect = page.locator(
      'select[name="llmProvider"], [data-testid="llm-provider-select"]'
    );

    if (await providerSelect.isVisible()) {
      await expect(providerSelect).toBeVisible();

      // Should have provider options
      await providerSelect.click();
      await expect(
        page.locator('option:has-text("OpenAI"), text=OpenAI')
      ).toBeVisible();
      await expect(
        page.locator('option:has-text("Anthropic"), text=Anthropic')
      ).toBeVisible();
      await expect(
        page.locator('option:has-text("Google"), text=Google')
      ).toBeVisible();
    }
  });

  test('should handle API key configuration', async ({ page }) => {
    const apiKeyInput = page.locator(
      'input[type="password"][placeholder*="API"], input[data-testid="api-key-input"]'
    );

    if (await apiKeyInput.isVisible()) {
      // Should be able to enter API key
      await apiKeyInput.fill('test-api-key-12345');

      // Should mask the input
      await expect(apiKeyInput).toHaveAttribute('type', 'password');

      // Should have toggle to show/hide
      const toggleButton = page.locator(
        'button[data-testid="toggle-api-key-visibility"]'
      );
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        await expect(apiKeyInput).toHaveAttribute('type', 'text');
      }
    }
  });

  test('should configure model selection', async ({ page }) => {
    const modelSelect = page.locator(
      'select[name="model"], [data-testid="model-select"]'
    );

    if (await modelSelect.isVisible()) {
      await modelSelect.click();

      // Should have model options
      await expect(
        page.locator('option:has-text("gpt-4"), text=gpt-4')
      ).toBeVisible();
      await expect(
        page.locator('option:has-text("gpt-3.5"), text=gpt-3.5')
      ).toBeVisible();
    }
  });

  test('should adjust temperature setting', async ({ page }) => {
    const temperatureSlider = page.locator(
      'input[type="range"][name*="temperature"], [data-testid="temperature-slider"]'
    );
    const temperatureInput = page.locator(
      'input[type="number"][name*="temperature"], [data-testid="temperature-input"]'
    );

    if (await temperatureSlider.isVisible()) {
      // Should be able to adjust temperature
      await temperatureSlider.fill('0.8');

      // Value should update
      await expect(temperatureSlider).toHaveValue('0.8');
    }

    if (await temperatureInput.isVisible()) {
      await temperatureInput.fill('0.8');
      await expect(temperatureInput).toHaveValue('0.8');
    }
  });

  test('should configure system prompt', async ({ page }) => {
    const systemPromptTextarea = page.locator(
      'textarea[name*="system"], textarea[placeholder*="system"], [data-testid="system-prompt"]'
    );

    if (await systemPromptTextarea.isVisible()) {
      const customPrompt =
        'You are a helpful AI assistant specialized in document analysis.';

      await systemPromptTextarea.clear();
      await systemPromptTextarea.fill(customPrompt);

      await expect(systemPromptTextarea).toHaveValue(customPrompt);
    }
  });

  test('should handle RAG settings', async ({ page }) => {
    // Check for embedding model selection
    const embeddingSelect = page.locator(
      'select[name*="embedding"], [data-testid="embedding-select"]'
    );

    if (await embeddingSelect.isVisible()) {
      await embeddingSelect.click();
      await expect(
        page.locator('option:has-text("text-embedding"), text=embedding')
      ).toBeVisible();
    }

    // Check for context length setting
    const contextLengthInput = page.locator(
      'input[name*="context"], input[name*="length"], [data-testid="context-length"]'
    );

    if (await contextLengthInput.isVisible()) {
      await contextLengthInput.fill('8000');
      await expect(contextLengthInput).toHaveValue('8000');
    }
  });

  test('should toggle system settings', async ({ page }) => {
    // Check for various toggle switches
    const toggles = page.locator(
      'input[type="checkbox"], button[role="switch"]'
    );
    const toggleCount = await toggles.count();

    if (toggleCount > 0) {
      const firstToggle = toggles.first();

      // Get initial state
      const initialState = await firstToggle.isChecked();

      // Toggle the setting
      await firstToggle.click();

      // State should change
      const newState = await firstToggle.isChecked();
      expect(newState).toBe(!initialState);
    }
  });

  test('should save settings', async ({ page }) => {
    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    );

    if (await saveButton.isVisible()) {
      // Make a change first
      const temperatureSlider = page.locator(
        'input[type="range"][name*="temperature"]'
      );
      if (await temperatureSlider.isVisible()) {
        await temperatureSlider.fill('0.9');
      }

      // Save settings
      await saveButton.click();

      // Should show success message
      const successMessage = page.locator(
        'text=saved successfully, text=settings updated, [data-testid="success-message"]'
      );
      await expect(successMessage).toBeVisible({ timeout: 10000 });
    }
  });

  test('should validate required fields', async ({ page }) => {
    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    );

    if (await saveButton.isVisible()) {
      // Clear a required field
      const apiKeyInput = page.locator(
        'input[type="password"][placeholder*="API"]'
      );
      if (await apiKeyInput.isVisible()) {
        await apiKeyInput.clear();

        // Try to save
        await saveButton.click();

        // Should show validation error
        const errorMessage = page.locator(
          'text=required, text=cannot be empty, [data-testid="error-message"]'
        );
        await expect(errorMessage).toBeVisible();
      }
    }
  });

  test('should reset settings', async ({ page }) => {
    const resetButton = page.locator(
      'button:has-text("Reset"), button:has-text("Defaults")'
    );

    if (await resetButton.isVisible()) {
      // Make some changes first
      const temperatureSlider = page.locator(
        'input[type="range"][name*="temperature"]'
      );
      if (await temperatureSlider.isVisible()) {
        await temperatureSlider.fill('0.9');
      }

      // Reset to defaults
      await resetButton.click();

      // Should show confirmation
      const confirmDialog = page.locator(
        'text=Are you sure, text=reset to default'
      );
      if (await confirmDialog.isVisible()) {
        const confirmButton = page.locator(
          'button:has-text("Confirm"), button:has-text("Reset")'
        );
        await confirmButton.click();
      }

      // Temperature should be back to default
      if (await temperatureSlider.isVisible()) {
        const value = await temperatureSlider.getAttribute('value');
        expect(parseFloat(value || '0')).toBeLessThan(0.9);
      }
    }
  });

  test('should handle settings import/export', async ({ page }) => {
    const exportButton = page.locator(
      'button:has-text("Export"), button:has-text("Download")'
    );
    const importButton = page.locator(
      'button:has-text("Import"), input[type="file"]'
    );

    if (await exportButton.isVisible()) {
      // Test export
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/settings|config/);
    }

    if (await importButton.isVisible()) {
      // Test import (mock file)
      await importButton.setInputFiles({
        name: 'settings.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({ llmProvider: 'openai', temperature: 0.7 })
        ),
      });

      // Should process the import
      const successMessage = page.locator(
        'text=imported successfully, text=settings loaded'
      );
      await expect(successMessage).toBeVisible();
    }
  });
});
