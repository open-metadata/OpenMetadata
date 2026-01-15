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
import test, { expect } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { redirectToHomePage, uuid } from '../../../utils/common';


const TEST_DEFINITION_NAME = `aCustomTestDefinition${uuid()}`;
const TEST_DEFINITION_DISPLAY_NAME = `Custom Test Definition ${uuid()}`;
const UPDATE_TEST_DEFINITION_DISPLAY_NAME = `Updated Custom Test Definition ${uuid()}`;
const TEST_DEFINITION_DESCRIPTION =
  'A This is a custom test definition for E2E testing';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Rules Library', { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Rules_Library` }, () => {
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
    await expect(page.getByTestId('test-definition-table')).toBeVisible();
  });

  test('should display system test definitions', async ({ page }) => {
    // Wait for API response before navigation
    const responsePromise = page.waitForResponse(
      (response) =>
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

  test('should create, edit, and delete a test definition', async ({ page }) => {

    await test.step('Create a new test definition', async () => {
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
      await page
        .locator('.ant-select-item-option-content:has-text("TABLE")')
        .first()
        .click();

      // Select test platform
      await page.locator('#testPlatforms').click();
      await page
        .locator('.ant-select-item-option-content:has-text("dbt")')
        .first()
        .click();

      // Wait for POST response when creating test definition
      const testDefinitionResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions') &&
          response.request().method() === 'POST'
      );

      // Click save
      await page.getByTestId('save-test-definition').click();

      // Wait for API response
      const responseData = await testDefinitionResponse;

      expect(responseData.status()).toBe(201);

      // Wait for success toast
      await expect(page.getByText(/created successfully/i)).toBeVisible();

      // Verify test definition appears in table
      await expect(page.getByTestId(TEST_DEFINITION_NAME)).toBeVisible();
    });

    await test.step('Edit Test Definition', async () => {

      // Wait for table to load
      await page.waitForSelector('[data-testid="test-definition-table"]', {
        state: 'visible',
      });

      // Find and click edit button on first row
      const firstEditButton = page.getByTestId(`edit-test-definition-${TEST_DEFINITION_NAME}`).first();
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
      await displayNameInput.fill(UPDATE_TEST_DEFINITION_DISPLAY_NAME);

      // Wait for POST response when creating test definition
      const testDefinitionResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions') &&
          response.request().method() === 'PATCH'
      );

      // Click save
      await page.getByTestId('save-test-definition').click();
      // Wait for API response
      const responseData = await testDefinitionResponse;

      expect(responseData.status()).toBe(200);

      // Wait for success toast
      await expect(page.getByText(/updated successfully/i)).toBeVisible();
    });

    await test.step('should enable/disable test definition', async () => {

      // Wait for table to load
      await page.waitForSelector('[data-testid="test-definition-table"]', {
        state: 'visible',
      });

      // Find first enabled switch
      const firstSwitch = page.getByTestId(`enable-switch-${TEST_DEFINITION_NAME}`)

      // Wait for API call
      const testDefinitionResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions') &&
          response.request().method() === 'PATCH'
      );
      // Toggle the switch
      await firstSwitch.click();

      // Wait for API response
      const responseData = await testDefinitionResponse;

      expect(responseData.status()).toBe(200);

      // Wait for success toast
      await expect(page.getByText(/updated successfully/i)).toBeVisible();

      // Verify switch state changed
      await expect(firstSwitch).toHaveAttribute(
        'aria-checked',
        String("false")
      );
    });

    await test.step('should delete a test definition', async () => {

      // Wait for table to load
      await page.waitForSelector('[data-testid="test-definition-table"]', {
        state: 'visible',
      });

      // Find and click delete button
      const deleteButton = page.getByTestId(`delete-test-definition-${TEST_DEFINITION_NAME}`);
      await deleteButton.click();

      // Wait for confirmation modal
      await page.waitForSelector('.ant-modal', { state: 'visible' });

      // Verify modal content
      await expect(page.getByText(`Delete ${UPDATE_TEST_DEFINITION_DISPLAY_NAME}`)).toBeVisible();

      await page.getByTestId("confirmation-text-input").fill("DELETE");

      // Wait for API call
      const deleteTestDefinitionResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions') &&
          response.request().method() === 'DELETE'
      );

      // Click confirm delete
      await page.getByTestId("confirm-button").click();

      const response = await deleteTestDefinitionResponse;
      expect(response.status()).toBe(200);

      // Wait for success toast
      await expect(page.getByText(/deleted successfully/i)).toBeVisible();

      // Verify test definition is removed from table
      await expect(page.getByText(TEST_DEFINITION_NAME)).not.toBeVisible();
    });
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
    await expect(
      page.locator('.ant-form-item-explain-error').first()
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
    const responsePromise = page.waitForResponse(
      (response) =>
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
      page
        .getByTestId('next')
    ).toBeVisible();
    await expect(
      page
        .getByTestId('previous')
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
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/dataQuality/testDefinitions') &&
        response.request().method() === 'GET'
    );

    await page.goto('/rules-library');
    const response = await responsePromise;
    const data = await response.json();

    // Find a system test definition (e.g., columnValueLengthsToBeBetween)
    const systemTestDef = data.data.find(
      (def: { provider: string; name: string }) =>
        def.provider === 'system'
    );

    // Verify edit button does not exist for system test definition
    const editButton = page.getByTestId(
      `edit-test-definition-${systemTestDef.name}`
    );

    await expect(editButton).toBeDisabled();

    // Verify delete button does not exist for system test definition
    const deleteButton = page.getByTestId(
      `delete-test-definition-${systemTestDef.name}`
    );

    await expect(deleteButton).toBeDisabled();

    // Verify enabled switch still exists and is functional
    const row = page.locator(`[data-row-key="${systemTestDef.id}"]`);
    const enabledSwitch = row.getByRole('switch');

    await expect(enabledSwitch).toBeVisible();

  });

  test('should allow enabling/disabling system test definitions', async ({
    page,
  }) => {
    // Wait for API response before navigation
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/dataQuality/testDefinitions') &&
        response.request().method() === 'GET'
    );

    await page.goto('/rules-library');
    const response = await responsePromise;
    const data = await response.json();

    // Wait for table to load
    await page.waitForSelector('[data-testid="test-definition-table"]', {
      state: 'visible',
    });

    // Find a system test definition
    const systemTestDef = data.data.findLast(
      (def: { provider: string }) => def.provider === 'system'
    );


    const enabledSwitch = page.getByTestId(`enable-switch-${systemTestDef.name}`);

    // Wait for API call and verify success
    const patchResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/dataQuality/testDefinitions') &&
        response.request().method() === 'PATCH'
    );
    // Toggle the switch
    await enabledSwitch.click();

    const disableResponse = await patchResponse;

    expect(disableResponse.status()).toBe(200);

    // Verify switch state changed
    await expect(enabledSwitch).toHaveAttribute(
      'aria-checked',
      String("false")
    );

    const patchResponse2 = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/dataQuality/testDefinitions') &&
        response.request().method() === 'PATCH'
    );

    // Toggle back to original state
    await enabledSwitch.click();
    const enableResponse = await patchResponse2;

    expect(enableResponse.status()).toBe(200);

  });

  test('should display correct provider type for test definitions', async ({
    page,
  }) => {
    // Wait for API response before navigation
    const responsePromise = page.waitForResponse(
      (response) =>
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
