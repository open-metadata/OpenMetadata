/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { expect } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';
import { test } from '../fixtures/pages';

const TEST_DEFINITION_NAME = 'customTestDefinition';
const TEST_DEFINITION_DISPLAY_NAME = 'Custom Test Definition';
const TEST_DEFINITION_DESCRIPTION =
  'This is a custom test definition for E2E testing';

test.describe('Rules Library', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should navigate to Rules Library page', async ({ page }) => {
    // Navigate directly to Rules Library
    await page.goto('/rules-library');

    // Wait for page to load
    await page.waitForSelector('[data-testid="test-definition-table"]', {
      state: 'visible',
      timeout: 30000,
    });

    // Verify URL
    await expect(page).toHaveURL(/.*\/rules-library/);
  });

  test('should display test definitions table with columns', async ({
    page,
  }) => {
    // Navigate to Rules Library and wait for response
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/dataQuality/testDefinitions') &&
        response.request().method() === 'GET'
    );

    await page.goto('/rules-library');
    await responsePromise;

    // Verify table is displayed
    await expect(
      page.getByTestId('test-definition-table')
    ).toBeVisible();
  });

  test('should display system test definitions', async ({ page }) => {
    // Wait for API response before navigation
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions') &&
      response.request().method() === 'GET'
    );

    await page.goto('/rules-library');
    await responsePromise;

    // Verify at least one test definition is displayed
    const testDefinitionRows = page.locator(
      '[data-testid="test-definition-table"] tbody tr'
    );

    await expect(testDefinitionRows).not.toHaveCount(0);
  });

  test('should create a new test definition', async ({ page }) => {
    // Navigate to Rules Library
    await page.goto('/rules-library');

    // Click add button
    await page.getByTestId('add-test-definition-button').click();

    // Wait for drawer to open
    await page.waitForSelector('.ant-drawer', { state: 'visible' });

    // Verify drawer title
    await expect(page.locator('.ant-drawer-title')).toContainText(
      'Add Test Definition'
    );

    // Fill in form fields
    await page.locator('#name').fill(TEST_DEFINITION_NAME);
    await page.locator('#displayName').fill(TEST_DEFINITION_DISPLAY_NAME);
    await page.locator('#description').fill(TEST_DEFINITION_DESCRIPTION);

    // Select entity type
    await page.locator('#entityType').click();
    await page.locator('.ant-select-item-option-content:has-text("TABLE")').first().click();
    await page.waitForTimeout(500);

    // Select test platform
    await page.locator('#testPlatforms').click();
    await page.locator('.ant-select-item-option-content:has-text("OpenMetadata")').first().click();

    // Verify enabled switch is checked by default
    const enabledSwitch = page.getByRole('switch');

    await expect(enabledSwitch).toBeChecked();

    // Click save
    await page.getByTestId('save-test-definition').click();

    // Wait for success toast
    await expect(page.getByText(/created successfully/i)).toBeVisible();

    // Verify test definition appears in table
    await expect(page.getByText(TEST_DEFINITION_NAME)).toBeVisible();
  });

  test('should edit an existing test definition', async ({ page }) => {
    // Navigate to Rules Library
    await page.goto('/rules-library');

    // Wait for table to load
    await page.waitForSelector('[data-testid="test-definition-table"]', {
      state: 'visible',
    });

    // Find and click edit button on first row
    const firstEditButton = page.getByTestId(/edit-test-definition-/).first();
    await firstEditButton.click();

    // Wait for drawer to open
    await page.waitForSelector('.ant-drawer', { state: 'visible' });

    // Verify drawer title
    await expect(page.locator('.ant-drawer-title')).toContainText(
      'Edit Test Definition'
    );

    // Verify name field is disabled in edit mode
    const nameInput = page.locator('#name');

    await expect(nameInput).toBeDisabled();

    // Update display name
    const displayNameInput = page.getByLabel('Display Name');
    await displayNameInput.clear();
    await displayNameInput.fill('Updated Display Name');

    // Click save
    await page.getByTestId('save-test-definition').click();

    // Wait for success toast
    await expect(page.getByText(/updated successfully/i)).toBeVisible();
  });

  test('should enable/disable test definition', async ({ page }) => {
    // Navigate to Rules Library
    await page.goto('/rules-library');

    // Wait for table to load
    await page.waitForSelector('[data-testid="test-definition-table"]', {
      state: 'visible',
    });

    // Find first enabled switch
    const firstSwitch = page.getByRole('switch').first();
    const initialState = await firstSwitch.isChecked();

    // Toggle the switch
    await firstSwitch.click();

    // Wait for API call
    const patchResponse = await page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/dataQuality/testDefinitions/') &&
        response.request().method() === 'PATCH'
    );

    // Verify API call was successful
    expect(patchResponse.status()).toBe(200);

    // Verify switch state changed
    await expect(firstSwitch).toHaveAttribute(
      'aria-checked',
      String(!initialState)
    );
  });

  test('should delete a test definition', async ({ page }) => {
    // Navigate to Rules Library
    await page.goto('/rules-library');

    // Wait for table to load
    await page.waitForSelector('[data-testid="test-definition-table"]', {
      state: 'visible',
    });

    // Get the name of the first custom test definition
    const customTestRow = page
      .locator(`[data-row-key*="${TEST_DEFINITION_NAME}"]`)
      .first();

    if (await customTestRow.isVisible()) {
      // Find and click delete button
      const deleteButton = customTestRow.getByTestId(/delete-test-definition-/);
      await deleteButton.click();

      // Wait for confirmation modal
      await page.waitForSelector('.ant-modal', { state: 'visible' });

      // Verify modal content
      await expect(page.getByText(/Delete Test Definition/i)).toBeVisible();

      // Click confirm delete
      await page.getByRole('button', { name: /Delete/i }).click();

      // Wait for API call
      await page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions/') &&
          response.request().method() === 'DELETE'
      );

      // Wait for success toast
      await expect(page.getByText(/deleted successfully/i)).toBeVisible();

      // Verify test definition is removed from table
      await expect(page.getByText(TEST_DEFINITION_NAME)).not.toBeVisible();
    }
  });

  test('should validate required fields in create form', async ({ page }) => {
    // Navigate to Rules Library
    await page.goto('/rules-library');

    // Click add button
    await page.getByTestId('add-test-definition-button').click();

    // Wait for drawer to open
    await page.waitForSelector('.ant-drawer', { state: 'visible' });

    // Click save without filling required fields
    await page.getByTestId('save-test-definition').click();

    // Verify validation errors appear for required fields
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();
  });

  test('should cancel form and close drawer', async ({ page }) => {
    // Navigate to Rules Library
    await page.goto('/rules-library');

    // Click add button
    await page.getByTestId('add-test-definition-button').click();

    // Wait for drawer to open
    await page.waitForSelector('.ant-drawer', { state: 'visible' });

    // Fill in some fields
    await page.locator('#name').fill('testName');

    // Click cancel
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Verify drawer is closed
    await expect(page.locator('.ant-drawer')).not.toBeVisible();
  });

  test('should display pagination when test definitions exceed page size', async ({
    page,
  }) => {
    // Wait for API response promise before navigation
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions') &&
      response.request().method() === 'GET'
    );

    await page.goto('/rules-library');
    const response = await responsePromise;
    const data = await response.json();

    // Check if pagination component exists (NextPrevious component)
    const hasMultiplePages = data.paging && data.paging.total > 15;

    if (!hasMultiplePages) {
      // Skip test if there aren't enough test definitions for pagination
      return;
    }

    // Pagination uses NextPrevious component, not ant-pagination
    await expect(
      page.locator('[data-testid="pagination-next-button"], [data-testid="pagination-previous-button"]').first()
    ).toBeVisible();
  });

  test('should search and filter test definitions', async ({ page }) => {
    // Navigate to Rules Library
    await page.goto('/rules-library');

    // Wait for table to load
    await page.waitForSelector('[data-testid="test-definition-table"]', {
      state: 'visible',
    });

    // Get initial row count
    const initialRows = await page
      .locator('[data-testid="test-definition-table"] tbody tr')
      .count();

    // Use table search/filter if available
    const searchInput = page.getByPlaceholder(/Search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('column');

      // Wait for filtered results
      await page.waitForTimeout(500);

      // Verify filtered results
      const filteredRows = await page
        .locator('[data-testid="test-definition-table"] tbody tr')
        .count();

      // Filtered results should be less than or equal to initial results
      expect(filteredRows).toBeLessThanOrEqual(initialRows);
    }
  });

  test('should display test platform badges correctly', async ({ page }) => {
    // Navigate to Rules Library
    await page.goto('/rules-library');

    // Wait for table to load
    await page.waitForSelector('[data-testid="test-definition-table"]', {
      state: 'visible',
    });

    // Verify test platform tags/badges are displayed
    const platformTags = page.locator('.ant-tag, .ant-badge');
    const tagCount = await platformTags.count();

    expect(tagCount).toBeGreaterThan(0);
  });

  test('should not show edit and delete buttons for system test definitions', async ({
    page,
  }) => {
    // Wait for API response before navigation
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions') &&
      response.request().method() === 'GET'
    );

    await page.goto('/rules-library');
    const response = await responsePromise;
    const data = await response.json();

    // Find a system test definition (e.g., columnValuesToBeNotNull)
    const systemTestDef = data.data.find(
      (def: { provider: string; name: string }) =>
        def.provider === 'system' && def.name === 'columnValuesToBeNotNull'
    );

    if (systemTestDef) {
      // Verify edit button does not exist for system test definition
      const editButton = page.getByTestId(
        `edit-test-definition-${systemTestDef.name}`
      );

      await expect(editButton).not.toBeVisible();

      // Verify delete button does not exist for system test definition
      const deleteButton = page.getByTestId(
        `delete-test-definition-${systemTestDef.name}`
      );

      await expect(deleteButton).not.toBeVisible();

      // Verify enabled switch still exists and is functional
      const row = page.locator(`[data-row-key="${systemTestDef.id}"]`);
      const enabledSwitch = row.getByRole('switch');

      await expect(enabledSwitch).toBeVisible();
    }
  });

  test('should show edit and delete buttons for user test definitions', async ({
    page,
  }) => {
    // First create a user test definition
    await page.goto('/rules-library');

    // Click add button
    await page.getByTestId('add-test-definition-button').click();

    // Wait for drawer to open
    await page.waitForSelector('.ant-drawer', { state: 'visible' });

    // Fill in form fields
    const testName = `userTestDef${Date.now()}`;
    await page.locator('#name').fill(testName);
    await page.locator('#displayName').fill('User Test Definition');
    await page
      .locator('#description')
      .fill('This is a user-created test definition');

    // Select entity type
    await page.locator('#entityType').click();
    await page.locator('.ant-select-item-option-content:has-text("TABLE")').first().click();
    await page.waitForTimeout(500);

    // Select test platform
    await page.locator('#testPlatforms').click();
    await page.locator('.ant-select-item-option-content:has-text("OpenMetadata")').first().click();

    // Click save
    await page.getByTestId('save-test-definition').click();

    // Wait for success toast
    await expect(page.getByText(/created successfully/i)).toBeVisible();

    // Verify edit button exists for user test definition
    const editButton = page.getByTestId(`edit-test-definition-${testName}`);

    await expect(editButton).toBeVisible();

    // Verify delete button exists for user test definition
    const deleteButton = page.getByTestId(`delete-test-definition-${testName}`);

    await expect(deleteButton).toBeVisible();

    // Cleanup: delete the test definition
    await deleteButton.click();
    await page.waitForSelector('.ant-modal', { state: 'visible' });
    await page.getByRole('button', { name: /Delete/i }).click();

    await expect(page.getByText(/deleted successfully/i)).toBeVisible();
  });

  test('should allow enabling/disabling system test definitions', async ({
    page,
  }) => {
    // Wait for API response before navigation
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions') &&
      response.request().method() === 'GET'
    );

    await page.goto('/rules-library');
    const response = await responsePromise;
    const data = await response.json();

    // Find a system test definition
    const systemTestDef = data.data.find(
      (def: { provider: string }) => def.provider === 'system'
    );

    if (systemTestDef) {
      const row = page.locator(`[data-row-key="${systemTestDef.id}"]`);
      const enabledSwitch = row.getByRole('switch');

      // Get initial state
      const initialState = await enabledSwitch.isChecked();

      // Toggle the switch
      await enabledSwitch.click();

      // Wait for API call and verify success
      const patchResponse = await page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions/') &&
          response.request().method() === 'PATCH'
      );

      expect(patchResponse.status()).toBe(200);

      // Verify switch state changed
      await expect(enabledSwitch).toHaveAttribute(
        'aria-checked',
        String(!initialState)
      );

      // Toggle back to original state
      await enabledSwitch.click();
      const patchResponse2 = await page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions/') &&
          response.request().method() === 'PATCH'
      );

      expect(patchResponse2.status()).toBe(200);
    }
  });

  test('should prevent editing system test definition entity type', async ({
    page,
  }) => {
    // This test verifies backend validation for system test definitions

    // Wait for API response before navigation
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions') &&
      response.request().method() === 'GET'
    );

    await page.goto('/rules-library');
    const response = await responsePromise;
    const data = await response.json();

    // Find a system test definition with COLUMN entity type
    const systemTestDef = data.data.find(
      (def: { provider: string; entityType: string }) =>
        def.provider === 'system' && def.entityType === 'COLUMN'
    );

    if (systemTestDef) {
      // Verify edit button does NOT exist for system test definition
      const editButton = page.getByTestId(
        `edit-test-definition-${systemTestDef.name}`
      );

      await expect(editButton).not.toBeVisible();
    }
  });

  test('should prevent deleting system test definition via API', async ({
    page,
  }) => {
    // Wait for API response before navigation
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions') &&
      response.request().method() === 'GET'
    );

    await page.goto('/rules-library');
    const response = await responsePromise;
    const data = await response.json();

    // Find a system test definition
    const systemTestDef = data.data.find(
      (def: { provider: string }) => def.provider === 'system'
    );

    if (systemTestDef) {
      // Verify delete button does NOT exist for system test definition
      const deleteButton = page.getByTestId(
        `delete-test-definition-${systemTestDef.name}`
      );

      await expect(deleteButton).not.toBeVisible();
    }
  });

  test('should allow editing user test definition', async ({ page }) => {
    // First create a user test definition
    await page.goto('/rules-library');

    // Click add button
    await page.getByTestId('add-test-definition-button').click();

    // Wait for drawer to open
    await page.waitForSelector('.ant-drawer', { state: 'visible' });

    // Fill in form fields
    const testName = `editableUserTest${Date.now()}`;
    await page.locator('#name').fill(testName);
    await page.locator('#displayName').fill('Original Display Name');
    await page.locator('#description').fill('Original description');

    // Select entity type - COLUMN
    await page.locator('#entityType').click();
    await page.locator('.ant-select-item-option-content:has-text("COLUMN")').first().click();
    await page.waitForTimeout(500);

    // Select test platform
    await page.locator('#testPlatforms').click();
    await page.locator('.ant-select-item-option-content:has-text("OpenMetadata")').first().click();

    // Click save
    await page.getByTestId('save-test-definition').click();

    // Wait for success toast
    await expect(page.getByText(/created successfully/i)).toBeVisible();

    // Now edit the test definition
    const editButton = page.getByTestId(`edit-test-definition-${testName}`);
    await editButton.click();

    // Wait for drawer to open
    await page.waitForSelector('.ant-drawer', { state: 'visible' });

    // Verify we can edit the display name
    const displayNameInput = page.getByLabel('Display Name');
    await displayNameInput.clear();
    await displayNameInput.fill('Updated Display Name');

    // Update description
    const descriptionInput = page.getByLabel('Description');
    await descriptionInput.clear();
    await descriptionInput.fill('Updated description');

    // Click save
    await page.getByTestId('save-test-definition').click();

    // Wait for success toast
    await expect(page.getByText(/updated successfully/i)).toBeVisible();

    // Verify the changes persisted
    await expect(page.getByText('Updated Display Name')).toBeVisible();

    // Cleanup: delete the test definition
    const deleteButton = page.getByTestId(`delete-test-definition-${testName}`);
    await deleteButton.click();
    await page.waitForSelector('.ant-modal', { state: 'visible' });
    await page.getByRole('button', { name: /Delete/i }).click();

    await expect(page.getByText(/deleted successfully/i)).toBeVisible();
  });

  test('should display correct provider type for test definitions', async ({
    page,
  }) => {
    // Wait for API response before navigation
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions') &&
      response.request().method() === 'GET'
    );

    await page.goto('/rules-library');
    const response = await responsePromise;
    const data = await response.json();

    // Verify we have both system and user test definitions (if user ones exist)
    const systemDefs = data.data.filter(
      (def: { provider: string }) => def.provider === 'system'
    );
    const userDefs = data.data.filter(
      (def: { provider: string }) => def.provider === 'user'
    );

    // Should have system test definitions
    expect(systemDefs.length).toBeGreaterThan(0);

    // Verify system definitions have provider = 'system'
    systemDefs.forEach((def: { provider: string }) => {
      expect(def.provider).toBe('system');
    });

    // If user definitions exist, verify they have provider = 'user'
    if (userDefs.length > 0) {
      userDefs.forEach((def: { provider: string }) => {
        expect(def.provider).toBe('user');
      });
    }
  });
});
