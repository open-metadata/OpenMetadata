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
import { redirectToHomePage } from '../../../utils/common';
import { test } from '../../fixtures/pages';

const TEST_DEFINITION_NAME = 'customTestDefinition';
const TEST_DEFINITION_DISPLAY_NAME = 'Custom Test Definition';
const TEST_DEFINITION_DESCRIPTION =
  'This is a custom test definition for E2E testing';

test.describe('Rules Library', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should navigate to Rules Library page', async ({ page }) => {
    // Click on Data Quality menu item
    await page.getByTestId('app-bar-item-data-quality').click();

    // Wait for dropdown menu
    await page.waitForSelector('[data-testid="app-bar-item-rules-library"]', {
      state: 'visible',
    });

    // Click on Rules Library
    await page.getByTestId('app-bar-item-rules-library').click();

    // Verify URL
    await expect(page).toHaveURL(/.*\/rules-library/);

    // Verify page title
    await expect(page.getByText('Rules Library')).toBeVisible();
  });

  test('should display test definitions table with columns', async ({
    page,
  }) => {
    // Navigate to Rules Library
    await page.goto('/rules-library');

    // Wait for table to load
    await page.waitForSelector('[data-testid="test-definition-table"]', {
      state: 'visible',
    });

    // Verify table columns
    await expect(
      page.getByRole('columnheader', { name: 'Name' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Description' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Entity Type' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Test Platform' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Enabled' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Actions' })
    ).toBeVisible();
  });

  test('should display system test definitions', async ({ page }) => {
    // Navigate to Rules Library
    await page.goto('/rules-library');

    // Wait for API response
    await page.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions')
    );

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
    await expect(page.getByText(/Add Test Definition/)).toBeVisible();

    // Fill in form fields
    await page.getByLabel('Name').fill(TEST_DEFINITION_NAME);
    await page.getByLabel('Display Name').fill(TEST_DEFINITION_DISPLAY_NAME);
    await page.getByLabel('Description').fill(TEST_DEFINITION_DESCRIPTION);

    // Select entity type
    await page.getByLabel('Entity Type').click();
    await page.getByText('COLUMN').first().click();

    // Select test platform
    await page.getByLabel('Test Platform').click();
    await page.getByText('OpenMetadata').first().click();

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
    await expect(page.getByText(/Edit Test Definition/)).toBeVisible();

    // Verify name field is disabled in edit mode
    const nameInput = page.getByLabel('Name');

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
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/dataQuality/testDefinitions/') &&
        response.request().method() === 'PATCH'
    );

    // Wait for success toast
    await expect(page.getByText(/updated successfully/i)).toBeVisible();

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

    // Verify validation errors
    await expect(page.getByText(/field is required.*Name/i)).toBeVisible();
    await expect(
      page.getByText(/field is required.*Description/i)
    ).toBeVisible();
    await expect(
      page.getByText(/field is required.*Entity Type/i)
    ).toBeVisible();
    await expect(
      page.getByText(/field is required.*Test Platform/i)
    ).toBeVisible();
  });

  test('should cancel form and close drawer', async ({ page }) => {
    // Navigate to Rules Library
    await page.goto('/rules-library');

    // Click add button
    await page.getByTestId('add-test-definition-button').click();

    // Wait for drawer to open
    await page.waitForSelector('.ant-drawer', { state: 'visible' });

    // Fill in some fields
    await page.getByLabel('Name').fill('testName');

    // Click cancel
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Verify drawer is closed
    await expect(page.locator('.ant-drawer')).not.toBeVisible();
  });

  test('should display pagination when test definitions exceed page size', async ({
    page,
  }) => {
    // Navigate to Rules Library
    await page.goto('/rules-library');

    // Wait for API response
    const response = await page.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions')
    );

    const data = await response.json();

    // If total is greater than page size, pagination should be visible
    if (data.paging && data.paging.total > 15) {
      await expect(page.locator('.ant-pagination')).toBeVisible();
    }
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
});
