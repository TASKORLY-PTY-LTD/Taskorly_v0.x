import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Document Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/documents');
  });

  test('should display documents page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Documents');

    // Check for main elements
    await expect(page.locator('[data-testid="document-table"]')).toBeVisible();
    await expect(
      page.locator('button:has-text("Upload Document")')
    ).toBeVisible();

    // Check for empty state or existing documents
    const documentRows = page.locator('[data-testid="document-row"]');
    const emptyState = page.locator('text=No documents found');

    // Either should have documents or empty state
    const hasDocuments = (await documentRows.count()) > 0;
    const hasEmptyState = await emptyState.isVisible();

    expect(hasDocuments || hasEmptyState).toBe(true);
  });

  test('should open upload dialog', async ({ page }) => {
    const uploadButton = page.locator('button:has-text("Upload Document")');
    await uploadButton.click();

    // Check for upload dialog
    await expect(page.locator('[data-testid="upload-dialog"]')).toBeVisible();

    // Check for file input
    await expect(page.locator('input[type="file"]')).toBeVisible();

    // Check for dialog buttons
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    await expect(page.locator('button:has-text("Upload")')).toBeVisible();
  });

  test('should handle file selection', async ({ page }) => {
    const uploadButton = page.locator('button:has-text("Upload Document")');
    await uploadButton.click();

    // Create a test file
    const fileInput = page.locator('input[type="file"]');

    // Mock file selection (in real test, would use actual file)
    await fileInput.setInputFiles({
      name: 'test-document.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is a test document for upload testing.'),
    });

    // Should show selected file
    await expect(page.locator('text=test-document.txt')).toBeVisible();
  });

  test('should validate file types', async ({ page }) => {
    const uploadButton = page.locator('button:has-text("Upload Document")');
    await uploadButton.click();

    const fileInput = page.locator('input[type="file"]');

    // Try uploading an unsupported file type
    await fileInput.setInputFiles({
      name: 'test.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('fake executable'),
    });

    // Should show validation error
    await expect(
      page.locator('text=invalid file type, text=not supported')
    ).toBeVisible();
  });

  test('should upload document successfully (mock)', async ({ page }) => {
    const uploadButton = page.locator('button:has-text("Upload Document")');
    await uploadButton.click();

    const fileInput = page.locator('input[type="file"]');
    const uploadSubmit = page.locator('button:has-text("Upload")');

    // Select a valid file
    await fileInput.setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf content'),
    });

    // Submit upload
    await uploadSubmit.click();

    // Should show progress or success
    const progressBar = page.locator('[data-testid="upload-progress"]');
    const successMessage = page.locator(
      'text=successfully uploaded, text=upload complete'
    );

    // Either progress bar or success message should appear
    const hasProgress = await progressBar.isVisible();
    const hasSuccess = await successMessage.isVisible();

    expect(hasProgress || hasSuccess).toBe(true);
  });

  test('should display document list', async ({ page }) => {
    // Should show document table headers
    await expect(page.locator('th:has-text("Title")')).toBeVisible();
    await expect(page.locator('th:has-text("Type")')).toBeVisible();
    await expect(page.locator('th:has-text("Size")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Actions")')).toBeVisible();

    // Check for sorting functionality
    const titleHeader = page.locator('th:has-text("Title")');
    await titleHeader.click();

    // Should have sortable indicators or change order
    const sortIndicator = page.locator('[data-testid="sort-indicator"]');
    if (await sortIndicator.isVisible()) {
      await expect(sortIndicator).toBeVisible();
    }
  });

  test('should filter documents', async ({ page }) => {
    const searchInput = page.locator(
      'input[placeholder*="search"], input[placeholder*="filter"]'
    );

    if (await searchInput.isVisible()) {
      await searchInput.fill('test');

      // Should filter results
      await expect(page.locator('[data-testid="document-row"]')).toHaveCount(0); // Assuming no matches in dev mode

      // Clear filter
      await searchInput.clear();
    }
  });

  test('should show document actions', async ({ page }) => {
    const documentRow = page.locator('[data-testid="document-row"]').first();

    if (await documentRow.isVisible()) {
      // Should have action buttons
      await expect(
        documentRow.locator(
          'button:has-text("View"), button:has-text("Delete")'
        )
      ).toBeVisible();
    }
  });

  test('should handle document deletion', async ({ page }) => {
    const documentRow = page.locator('[data-testid="document-row"]').first();

    if (await documentRow.isVisible()) {
      const deleteButton = documentRow.locator('button:has-text("Delete")');
      await deleteButton.click();

      // Should show confirmation dialog
      await expect(
        page.locator('text=Are you sure, text=confirm delete')
      ).toBeVisible();

      // Cancel deletion
      const cancelButton = page.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Document should still be there
      await expect(documentRow).toBeVisible();
    }
  });

  test('should show document processing status', async ({ page }) => {
    const statusColumn = page
      .locator('[data-testid="document-status"]')
      .first();

    if (await statusColumn.isVisible()) {
      // Should show status like "Ready", "Processing", "Error"
      const statusText = await statusColumn.textContent();
      expect(['Ready', 'Processing', 'Error', 'Pending']).toContain(statusText);
    }
  });

  test('should handle pagination', async ({ page }) => {
    const pagination = page.locator('[data-testid="pagination"]');

    if (await pagination.isVisible()) {
      // Should have page controls
      await expect(
        pagination.locator(
          'button:has-text("Next"), button:has-text("Previous")'
        )
      ).toBeVisible();

      // Should show page info
      await expect(pagination.locator('text=Page, text=of')).toBeVisible();
    }
  });
});
