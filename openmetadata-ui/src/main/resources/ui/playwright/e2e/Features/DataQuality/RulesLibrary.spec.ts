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
import { getApiContext, redirectToHomePage, uuid } from '../../../utils/common';
import { findSystemTestDefinition } from '../../../utils/testCases';

const TEST_DEFINITION_NAME = `AaroCustomTestDefinition${uuid()}`;
const TEST_DEFINITION_DISPLAY_NAME = `Aaro Custom Test Definition ${uuid()}`;
const UPDATE_TEST_DEFINITION_DISPLAY_NAME = `Aaro Updated Custom Test Definition ${uuid()}`;
const TEST_DEFINITION_DESCRIPTION =
  'Aaro This is a custom test definition for E2E testing';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe(
  'Rules Library',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Rules_Library` },
  () => {
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

    test('should create, edit, and delete a test definition', async ({
      page,
    }) => {
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
        const firstEditButton = page
          .getByTestId(`edit-test-definition-${TEST_DEFINITION_NAME}`)
          .first();
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
        const firstSwitch = page.getByTestId(
          `enable-switch-${TEST_DEFINITION_NAME}`
        );

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
          String('false')
        );
      });

      await test.step('should delete a test definition', async () => {
        // Wait for table to load
        await page.waitForSelector('[data-testid="test-definition-table"]', {
          state: 'visible',
        });

        // Find and click delete button
        const deleteButton = page.getByTestId(
          `delete-test-definition-${TEST_DEFINITION_NAME}`
        );
        await deleteButton.click();

        // Wait for confirmation modal
        await page.waitForSelector('.ant-modal', { state: 'visible' });

        // Verify modal content
        await expect(
          page.getByText(`Delete ${UPDATE_TEST_DEFINITION_DISPLAY_NAME}`)
        ).toBeVisible();

        await page.getByTestId('confirmation-text-input').fill('DELETE');

        // Wait for API call
        const deleteTestDefinitionResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.request().method() === 'DELETE'
        );

        // Click confirm delete
        await page.getByTestId('confirm-button').click();

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
      await expect(page.getByTestId('next')).toBeVisible();
      await expect(page.getByTestId('previous')).toBeVisible();
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
      const systemTestDef = await findSystemTestDefinition(page);

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
      const systemTestDef = await findSystemTestDefinition(page);

      const enabledSwitch = page.getByTestId(
        `enable-switch-${systemTestDef.name}`
      );

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
        String('false')
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

    test('should disable toggle for external test definitions', async ({
      page,
    }) => {
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions') &&
          response.request().method() === 'GET'
      );
      await page.goto('/rules-library');
      const response = await responsePromise;
      const data = await response.json();

      const externalTest = data.data.find(
        (def: { testPlatforms: string[] }) =>
          !def.testPlatforms.includes('OpenMetadata')
      );

      if (externalTest) {
        const enableSwitch = page.getByTestId(
          `enable-switch-${externalTest.name}`
        );

        await expect(enableSwitch).toBeDisabled();

        const switchParent = enableSwitch.locator('..');
        await switchParent.hover();

        await expect(
          page.getByText(/external test definitions are managed outside/i)
        ).toBeVisible();
      }
    });

    test('should handle external test definitions with read-only fields', async ({
      page,
    }) => {
      const EXTERNAL_TEST_NAME = `AaaaExternalTest${uuid()}`;
      const EXTERNAL_TEST_DISPLAY_NAME = `Aaaa External DBT Test ${uuid()}`;
      let createdTestDisplayName = EXTERNAL_TEST_DISPLAY_NAME;

      await test.step('Create external test definition', async () => {
        await page.goto('/rules-library');

        await page.getByTestId('add-test-definition-button').click();

        await expect(page.locator('.ant-drawer')).toBeVisible();

        await page.locator('#name').fill(EXTERNAL_TEST_NAME);
        await page.locator('#displayName').fill(EXTERNAL_TEST_DISPLAY_NAME);
        await page
          .locator('#description')
          .fill('External test for read-only validation');

        await page.locator('#entityType').click();
        const tableOption = page
          .locator('.ant-select-dropdown:visible')
          .getByTitle('TABLE');
        await expect(tableOption).toBeVisible();
        await tableOption.click();
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.locator('#testPlatforms').click();
        const openMetadataOption = page
          .locator('.ant-select-dropdown:visible')
          .getByTitle('OpenMetadata');
        await expect(openMetadataOption).toBeVisible();
        await openMetadataOption.click();

        const dbtOption = page
          .locator('.ant-select-dropdown:visible')
          .getByTitle('dbt');
        await expect(dbtOption).toBeVisible();
        await dbtOption.click();

        await page.getByRole('dialog').getByText('Add Test Definition').click();
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        const createResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.request().method() === 'POST'
        );

        await page.getByTestId('save-test-definition').click();

        const responseData = await createResponse;
        expect(responseData.status()).toBe(201);

        await expect(page.getByText(/created successfully/i)).toBeVisible();
        await expect(page.getByTestId(EXTERNAL_TEST_NAME)).toBeVisible();
      });

      await test.step('Verify fields are read-only in edit mode', async () => {
        await expect(page.getByTestId('test-definition-table')).toBeVisible();

        const editButton = page.getByTestId(
          `edit-test-definition-${EXTERNAL_TEST_NAME}`
        );
        await editButton.click();

        await expect(page.locator('.ant-drawer')).toBeVisible();

        await expect(page.getByLabel('Entity Type')).toBeDisabled();
        await expect(page.getByLabel('Test Platforms')).toBeDisabled();
        await expect(page.getByLabel('SQL Query')).toBeDisabled();
        await expect(page.getByLabel('Supported Data Types')).toBeDisabled();
        await expect(
          page.getByLabel('Supported Service', { exact: false })
        ).toBeDisabled();

        await expect(page.getByLabel('Display Name')).not.toBeDisabled();
        await expect(page.getByLabel('Description')).not.toBeDisabled();
      });

      await test.step('Verify allowed fields can be edited', async () => {
        const displayNameField = page.getByLabel('Display Name');
        await displayNameField.clear();
        const updatedDisplayName = `Updated ${EXTERNAL_TEST_DISPLAY_NAME}`;
        await displayNameField.fill(updatedDisplayName);
        createdTestDisplayName = updatedDisplayName;

        const descriptionField = page.getByLabel('Description');
        await descriptionField.clear();
        await descriptionField.fill('Updated description for external test');

        const patchResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.request().method() === 'PATCH'
        );

        await page.getByTestId('save-test-definition').click();

        const updateResponse = await patchResponse;
        expect(updateResponse.status()).toBe(200);

        await expect(page.getByText(/updated successfully/i)).toBeVisible();
      });

      await test.step('Delete external test definition', async () => {
        await expect(page.getByTestId('test-definition-table')).toBeVisible();

        const deleteButton = page.getByTestId(
          `delete-test-definition-${EXTERNAL_TEST_NAME}`
        );
        await deleteButton.click();

        await expect(page.locator('.ant-modal')).toBeVisible();

        await expect(
          page.getByText(`Delete ${createdTestDisplayName}`)
        ).toBeVisible();

        await page.getByTestId('confirmation-text-input').fill('DELETE');

        const deleteResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.request().method() === 'DELETE'
        );

        await page.getByTestId('confirm-button').click();

        const response = await deleteResponse;
        expect(response.status()).toBe(200);

        await expect(page.getByText(/deleted successfully/i)).toBeVisible();
        await expect(page.getByTestId(EXTERNAL_TEST_NAME)).not.toBeVisible();
      });
    });

    test('should handle supported services field correctly', async ({
      page,
    }) => {
      const SUPPORTED_SERVICES_TEST_NAME = `AaaaServiceFilterTest${uuid()}`;
      const SUPPORTED_SERVICES_DISPLAY_NAME = `Aaaa Service Filter Test ${uuid()}`;
      let createdTestId: string;

      await test.step(
        'Create test definition with specific supported services',
        async () => {
          await page.goto('/rules-library');

          await page.getByTestId('add-test-definition-button').click();

          await expect(page.locator('.ant-drawer')).toBeVisible();

          await page.locator('#name').fill(SUPPORTED_SERVICES_TEST_NAME);
          await page
            .locator('#displayName')
            .fill(SUPPORTED_SERVICES_DISPLAY_NAME);
          await page
            .locator('#description')
            .fill('Test definition to validate supported services filtering');

          await page.locator('#entityType').click();
          const entityTypeOption = page
            .locator('.ant-select-dropdown:visible')
            .getByTitle('TABLE');
          await expect(entityTypeOption).toBeVisible();
          await entityTypeOption.click();
          await expect(
            page.locator('.ant-select-dropdown:visible')
          ).not.toBeVisible();

          await page.locator('#supportedServices').click();
          await page.locator('#supportedServices').fill('Mysql');
          const mysqlOption = page
            .locator('.ant-select-dropdown:visible')
            .getByTitle('Mysql');
          await expect(mysqlOption).toBeVisible();
          await mysqlOption.click();
          await page.locator('#supportedServices').clear();
          await page.locator('#supportedServices').fill('Postgres');

          const postgresOption = page
            .locator('.ant-select-dropdown:visible')
            .getByTitle('Postgres');
          await expect(postgresOption).toBeVisible();
          await postgresOption.click();

          await page
            .getByRole('dialog')
            .getByText('Add Test Definition')
            .click();
          await expect(
            page.locator('.ant-select-dropdown:visible')
          ).not.toBeVisible();

          const createResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/dataQuality/testDefinitions') &&
              response.request().method() === 'POST'
          );

          await page.getByTestId('save-test-definition').click();

          const responseData = await createResponse;
          expect(responseData.status()).toBe(201);

          const createdData = await responseData.json();
          createdTestId = createdData.id;

          await expect(page.getByText(/created successfully/i)).toBeVisible();
          await expect(
            page.getByTestId(SUPPORTED_SERVICES_TEST_NAME)
          ).toBeVisible();
        }
      );

      await test.step(
        'Verify supported services are saved correctly',
        async () => {
          await expect(page.getByTestId('test-definition-table')).toBeVisible();

          const editButton = page.getByTestId(
            `edit-test-definition-${SUPPORTED_SERVICES_TEST_NAME}`
          );
          await editButton.click();

          await expect(page.locator('.ant-drawer')).toBeVisible();

          const supportedServicesField = page.locator('#supportedServices');
          await expect(supportedServicesField).toBeVisible();

          await expect(
            page.locator('.ant-select-selection-item[title="Mysql"]')
          ).toBeVisible();
          await expect(
            page.locator('.ant-select-selection-item[title="Postgres"]')
          ).toBeVisible();

          await page.getByRole('button', { name: /Cancel/i }).click();
          await expect(page.locator('.ant-drawer')).not.toBeVisible();
        }
      );

      await test.step(
        'Verify test definition appears when filtering by supported services',
        async () => {
          const { apiContext } = await getApiContext(page);
          const mysqlFilterResponse = await apiContext.get(
            '/api/v1/dataQuality/testDefinitions?limit=50&entityType=TABLE&testPlatform=OpenMetadata&supportedService=Mysql'
          );
          expect(mysqlFilterResponse.status()).toBe(200);

          const mysqlData = await mysqlFilterResponse.json();
          const foundInMySql = mysqlData.data.find(
            (def: { id: string }) => def.id === createdTestId
          );
          expect(foundInMySql).toBeDefined();
          expect(foundInMySql.supportedServices).toContain('Mysql');

          const postgresFilterResponse = await apiContext.get(
            '/api/v1/dataQuality/testDefinitions?limit=50&entityType=TABLE&testPlatform=OpenMetadata&supportedService=Postgres'
          );
          expect(postgresFilterResponse.status()).toBe(200);

          const postgresData = await postgresFilterResponse.json();
          const foundInPostgres = postgresData.data.find(
            (def: { id: string }) => def.id === createdTestId
          );
          expect(foundInPostgres).toBeDefined();
          expect(foundInPostgres.supportedServices).toContain('Postgres');

          const bigQueryFilterResponse = await apiContext.get(
            '/api/v1/dataQuality/testDefinitions?limit=50&entityType=TABLE&testPlatform=OpenMetadata&supportedService=BigQuery'
          );
          expect(bigQueryFilterResponse.status()).toBe(200);

          const bigQueryData = await bigQueryFilterResponse.json();
          const foundInBigQuery = bigQueryData.data.find(
            (def: { id: string }) => def.id === createdTestId
          );
          expect(foundInBigQuery).toBeUndefined();
        }
      );

      await test.step('Edit and change supported services', async () => {
        await expect(page.getByTestId('test-definition-table')).toBeVisible();

        const editButton = page.getByTestId(
          `edit-test-definition-${SUPPORTED_SERVICES_TEST_NAME}`
        );
        await editButton.click();

        await expect(page.locator('.ant-drawer')).toBeVisible();

        const mysqlTag = page.locator(
          '.ant-select-selection-item[title="Mysql"]'
        );
        await expect(mysqlTag).toBeVisible();

        const mysqlRemove = mysqlTag.locator(
          '.ant-select-selection-item-remove'
        );
        await mysqlRemove.click();

        await expect(mysqlTag).not.toBeVisible();

        await page.locator('#supportedServices').click();
        await page.locator('#supportedServices').fill('BigQuery');
        const bigQueryOption = page
          .locator('.ant-select-dropdown:visible')
          .getByTitle('BigQuery');
        await expect(bigQueryOption).toBeVisible();
        await bigQueryOption.click();

        await page
          .getByRole('dialog')
          .getByText('Edit Test Definition')
          .click();
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        const patchResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.request().method() === 'PATCH'
        );

        await page.getByTestId('save-test-definition').click();

        const updateResponse = await patchResponse;
        expect(updateResponse.status()).toBe(200);

        const updatedData = await updateResponse.json();
        expect(updatedData.supportedServices).toContain('Postgres');
        expect(updatedData.supportedServices).toContain('BigQuery');
        expect(updatedData.supportedServices).not.toContain('MySql');

        await expect(page.getByText(/updated successfully/i)).toBeVisible();
      });

      await test.step(
        'Verify updated supported services are persisted',
        async () => {
          await expect(page.getByTestId('test-definition-table')).toBeVisible();

          const editButton = page.getByTestId(
            `edit-test-definition-${SUPPORTED_SERVICES_TEST_NAME}`
          );
          await editButton.click();

          await expect(page.locator('.ant-drawer')).toBeVisible();

          await expect(
            page.locator('.ant-select-selection-item[title="Postgres"]')
          ).toBeVisible();

          await expect(
            page.locator('.ant-select-selection-item[title="BigQuery"]')
          ).toBeVisible();

          await expect(
            page.locator('.ant-select-selection-item[title="Mysql"]')
          ).not.toBeVisible();

          await page.getByRole('button', { name: /Cancel/i }).click();
          await expect(page.locator('.ant-drawer')).not.toBeVisible();
        }
      );

      await test.step(
        'Clear all supported services (should apply to all services)',
        async () => {
          await expect(page.getByTestId('test-definition-table')).toBeVisible();

          const editButton = page.getByTestId(
            `edit-test-definition-${SUPPORTED_SERVICES_TEST_NAME}`
          );
          await editButton.click();

          await expect(page.locator('.ant-drawer')).toBeVisible();

          const postgresTag = page.locator(
            '.ant-select-selection-item[title="Postgres"]'
          );
          await expect(postgresTag).toBeVisible();

          const postgresRemove = postgresTag.locator(
            '.ant-select-selection-item-remove'
          );
          await postgresRemove.click();

          await expect(postgresTag).not.toBeVisible();

          const bigQueryTag = page.locator(
            '.ant-select-selection-item[title="BigQuery"]'
          );
          await expect(bigQueryTag).toBeVisible();

          const bigQueryRemove = bigQueryTag.locator(
            '.ant-select-selection-item-remove'
          );
          await bigQueryRemove.click();

          await expect(bigQueryTag).not.toBeVisible();

          const patchResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/dataQuality/testDefinitions') &&
              response.request().method() === 'PATCH'
          );

          await page.getByTestId('save-test-definition').click();

          const updateResponse = await patchResponse;
          expect(updateResponse.status()).toBe(200);

          const updatedData = await updateResponse.json();
          expect(
            updatedData.supportedServices === null ||
              updatedData.supportedServices === undefined ||
              updatedData.supportedServices.length === 0
          ).toBeTruthy();

          await expect(page.getByText(/updated successfully/i)).toBeVisible();
        }
      );

      await test.step('Delete test definition', async () => {
        await expect(page.getByTestId('test-definition-table')).toBeVisible();

        const deleteButton = page.getByTestId(
          `delete-test-definition-${SUPPORTED_SERVICES_TEST_NAME}`
        );
        await deleteButton.click();

        await expect(page.locator('.ant-modal')).toBeVisible();

        await page.getByTestId('confirmation-text-input').fill('DELETE');

        const deleteResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.request().method() === 'DELETE'
        );

        await page.getByTestId('confirm-button').click();

        const response = await deleteResponse;
        expect(response.status()).toBe(200);

        await expect(page.getByText(/deleted successfully/i)).toBeVisible();
        await expect(
          page.getByTestId(SUPPORTED_SERVICES_TEST_NAME)
        ).not.toBeVisible();
      });
    });

    test('should maintain page on edit and reset to first page on delete', async ({
      page,
    }) => {
      const PAGINATION_TEST_NAME = `zzzzPaginationTest${uuid()}`;
      const PAGINATION_TEST_DISPLAY_NAME = `Zzzz Pagination Test ${uuid()}`;
      const UPDATED_DISPLAY_NAME = `Updated ${PAGINATION_TEST_DISPLAY_NAME}`;

      await test.step(
        'Create a test definition starting with "z"',
        async () => {
          await page.goto('/rules-library');
          await page.getByTestId('add-test-definition-button').click();
          await expect(page.locator('.ant-drawer')).toBeVisible();

          await page.locator('#name').fill(PAGINATION_TEST_NAME);
          await page.locator('#displayName').fill(PAGINATION_TEST_DISPLAY_NAME);
          await page
            .locator('#description')
            .fill('Test definition for pagination behavior testing');

          await page.locator('#entityType').click();
          await page
            .locator('.ant-select-dropdown:visible')
            .getByTitle('TABLE')
            .click();
          await expect(
            page.locator('.ant-select-dropdown:visible')
          ).not.toBeVisible();

          const createResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/dataQuality/testDefinitions') &&
              response.request().method() === 'POST'
          );

          await page.getByTestId('save-test-definition').click();

          const responseData = await createResponse;
          expect(responseData.status()).toBe(201);
          await expect(page.getByText(/created successfully/i)).toBeVisible();
        }
      );

      await test.step('Change page size to 25', async () => {
        const pageSizeDropdown = page.getByTestId(
          'page-size-selection-dropdown'
        );
        await expect(pageSizeDropdown).toBeVisible();
        await pageSizeDropdown.click();

        const pageChangeResponse = page.waitForResponse(
          // Wait for pagination response
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.request().method() === 'GET'
        );
        // Wait for dropdown to open and select 25
        await page.locator('.ant-dropdown:visible').getByText('25').click();
        await pageChangeResponse;
      });

      await test.step(
        'Navigate until we find our test definition or reach last page',
        async () => {
          const nextButton = page.getByTestId('next');
          const testDefLocator = page.getByTestId(PAGINATION_TEST_NAME);

          // Check if item is already visible on current page
          let isItemVisible = await testDefLocator.isVisible();

          // Navigate until we find our test definition or reach the last page
          while (!isItemVisible && (await nextButton.isEnabled())) {
            const fetchResponse = page.waitForResponse(
              (response) =>
                response
                  .url()
                  .includes('/api/v1/dataQuality/testDefinitions') &&
                response.request().method() === 'GET'
            );
            await nextButton.click();
            await fetchResponse;

            // Check again after page load
            isItemVisible = await testDefLocator.isVisible();
          }

          // Verify our test definition is now visible
          await expect(testDefLocator).toBeVisible({
            timeout: 10000,
          });
        }
      );

      await test.step(
        'Edit the test definition and verify we stay on the same page',
        async () => {
          // Verify our test definition is visible on this page
          await expect(page.getByTestId(PAGINATION_TEST_NAME)).toBeVisible();

          // Get current page indicator before edit
          const previousButton = page.getByTestId('previous');
          const prevDisabledBefore = await previousButton.isDisabled();

          // Edit the test definition
          await page
            .getByTestId(`edit-test-definition-${PAGINATION_TEST_NAME}`)
            .click();
          await expect(page.locator('.ant-drawer')).toBeVisible();

          const displayNameInput = page.getByLabel('Display Name');
          await displayNameInput.clear();
          await displayNameInput.fill(UPDATED_DISPLAY_NAME);

          const patchResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/dataQuality/testDefinitions') &&
              response.request().method() === 'PATCH'
          );

          await page.getByTestId('save-test-definition').click();
          const updateResponse = await patchResponse;
          expect(updateResponse.status()).toBe(200);

          await expect(page.getByText(/updated successfully/i)).toBeVisible();

          // Verify we stayed on the same page (previous button state should be unchanged)
          const prevDisabledAfter = await previousButton.isDisabled();
          expect(prevDisabledAfter).toBe(prevDisabledBefore);

          // Verify the updated test definition is still visible
          await expect(page.getByTestId(PAGINATION_TEST_NAME)).toBeVisible();
        }
      );

      await test.step(
        'Delete the test definition and verify redirect to first page',
        async () => {
          await page
            .getByTestId(`delete-test-definition-${PAGINATION_TEST_NAME}`)
            .click();

          await expect(page.locator('.ant-modal')).toBeVisible();
          await page.getByTestId('confirmation-text-input').fill('DELETE');

          // Set up both DELETE and the subsequent GET response waits BEFORE clicking
          const deleteResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/dataQuality/testDefinitions') &&
              response.request().method() === 'DELETE'
          );

          const getResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/dataQuality/testDefinitions') &&
              response.request().method() === 'GET'
          );

          await page.getByTestId('confirm-button').click();

          const deleteResult = await deleteResponse;
          expect(deleteResult.status()).toBe(200);

          // Wait for the GET that happens after delete (page reset + fetch)
          await getResponse;

          await expect(page.getByText(/deleted successfully/i)).toBeVisible();

          // Previous button should be disabled on first page
          const previousButton = page.getByTestId('previous');
          await expect(previousButton).toBeDisabled();

          // Verify the deleted test definition is no longer visible
          await expect(
            page.getByTestId(PAGINATION_TEST_NAME)
          ).not.toBeVisible();
        }
      );
    });
  }
);
