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
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../../utils/common';
import { findSystemTestDefinition } from '../../../utils/testCases';

const TEST_DEFINITION_NAME = `AaroCustomTestDefinition${uuid()}`;
const TEST_DEFINITION_DISPLAY_NAME = `Aaro Custom Test Definition ${uuid()}`;
const UPDATE_TEST_DEFINITION_DISPLAY_NAME = `Aaro Updated Custom Test Definition ${uuid()}`;
const TEST_DEFINITION_DESCRIPTION =
  'Aaro This is a custom test definition for E2E testing';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe(
  'Test Library',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Test_Library` },
  () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('should navigate to Test Library page', async ({ page }) => {
      // Navigate directly to Test Library
      await page.goto('/test-library');

      // Wait for page to load
      await page.getByTestId('test-definition-table').waitFor({
        state: 'visible',
        timeout: 30000,
      });

      // Verify URL
      await expect(page).toHaveURL(/.*\/test-library/);
    });

    test('should display test definitions table with columns', async ({
      page,
    }) => {
      // Navigate to Test Library and wait for response
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions') &&
          response.request().method() === 'GET'
      );

      await page.goto('/test-library');
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

      await page.goto('/test-library');
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
        // Navigate to Test Library
        await page.goto('/test-library');

        const testDefinitionFormDoc = page.waitForResponse(
          '/locales/en-US/OpenMetadata/TestDefinitionForm.md'
        );

        // Click add button
        await page.getByTestId('add-test-definition-button').click();

        // Wait for drawer to open
        await page
          .getByTestId('test-definition-form-body')
          .waitFor({ state: 'visible' });
        await testDefinitionFormDoc;

        // The form body + doc panel confirm the drawer opened. We don't assert
        // the "Add Test Definition" title text because it also matches the list
        // page's Add button (strict-mode ambiguity).
        await expect(
          page.locator('.drawer-doc-panel.service-doc-panel')
        ).toBeVisible();

        // Fill in form fields
        await page
          .getByTestId('test-definition-name')
          .locator('input')
          .fill(TEST_DEFINITION_NAME);
        await expect(
          page.locator('.drawer-doc-panel.service-doc-panel')
        ).toContainText('Name');
        await page
          .getByTestId('display-name')
          .locator('input')
          .fill(TEST_DEFINITION_DISPLAY_NAME);
        await page
          .getByTestId('description')
          .locator('textarea')
          .fill(TEST_DEFINITION_DESCRIPTION);

        // Select entity type (react-aria Select: click the field, pick option)
        await page.locator('[id="root/entityType"]').click();
        await page.getByRole('option', { name: 'TABLE', exact: true }).click();

        // Supported data types (multi-select combobox: type to populate the
        // options, then pick — required while the OpenMetadata platform is set).
        // The combobox closes on selection, so no Escape (Escape closes the drawer).
        await page.locator('[id="root/supportedDataTypes"]').fill('NUMBER');
        await page.getByRole('option', { name: 'NUMBER', exact: true }).click();

        // Add a test platform (multi-select combobox)
        await page.locator('[id="root/testPlatforms"]').fill('dbt');
        await page.getByRole('option', { name: 'dbt', exact: true }).click();

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
        await toastNotification(page, /created successfully/i);

        // Verify test definition appears in table
        await expect(page.getByTestId(TEST_DEFINITION_NAME)).toBeVisible();
      });

      await test.step('Edit Test Definition', async () => {
        // Wait for table to load
        await page.getByTestId('test-definition-table').waitFor({
          state: 'visible',
        });

        // Find and click edit button on first row
        const firstEditButton = page
          .getByTestId(`edit-test-definition-${TEST_DEFINITION_NAME}`)
          .first();
        await firstEditButton.click();

        // Wait for drawer to open (form body confirms the edit drawer opened).
        await page
          .getByTestId('test-definition-form-body')
          .waitFor({ state: 'visible' });

        // Verify name field is disabled in edit mode
        const nameInput = page
          .getByTestId('test-definition-name')
          .locator('input');

        await expect(nameInput).toBeDisabled();

        // Update display name
        const displayNameInput = page
          .getByTestId('display-name')
          .locator('input');
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
        await toastNotification(page, /updated successfully/i);
      });

      await test.step('should enable/disable test definition', async () => {
        // Wait for table to load
        await page.getByTestId('test-definition-table').waitFor({
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
        await toastNotification(page, /updated successfully/i);

        // Verify switch state changed
        await expect(firstSwitch).toHaveAttribute(
          'aria-checked',
          String('false')
        );
      });

      await test.step('should delete a test definition', async () => {
        // Wait for table to load
        await page.getByTestId('test-definition-table').waitFor({
          state: 'visible',
        });

        // Find and click delete button
        const deleteButton = page.getByTestId(
          `delete-test-definition-${TEST_DEFINITION_NAME}`
        );
        await deleteButton.click();

        // Wait for confirmation modal
        await page.locator('.ant-modal').waitFor({ state: 'visible' });

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
        await toastNotification(page, /deleted successfully/i);

        // Verify test definition is removed from table
        await expect(page.getByText(TEST_DEFINITION_NAME)).not.toBeVisible();
      });
    });

    test('should validate required fields in create form', async ({ page }) => {
      // Navigate to Test Library
      await page.goto('/test-library');

      // Click add button
      await page.getByTestId('add-test-definition-button').click();

      // Wait for drawer to open
      await page
        .getByTestId('test-definition-form-body')
        .waitFor({ state: 'visible' });

      // Click save without filling required fields
      await page.getByTestId('save-test-definition').click();

      // Verify drawer remains open with validation errors blocking submission
      await expect(page.getByTestId('test-definition-form-body')).toBeVisible();
    });

    test('should require supported data types only when OpenMetadata platform is selected', async ({
      page,
    }) => {
      test.slow();
      let createdTestDefinitionId: string | undefined;

      try {
        await test.step('Open create form', async () => {
          await page.goto('/test-library');
          await page.getByTestId('add-test-definition-button').click();
          await page
            .getByTestId('test-definition-form-body')
            .waitFor({ state: 'visible' });
        });

        await test.step('Verify supported data types is required with default OpenMetadata platform', async () => {
          // Fill required fields except supportedDataTypes
          await page
            .getByTestId('test-definition-name')
            .locator('input')
            .fill(`validation-test-${uuid()}`);
          await page.getByTestId('entity-type').click();
          await page
            .getByRole('option', { name: 'TABLE', exact: true })
            .click();

          // Submit the form
          await page.getByTestId('save-test-definition').click();

          // Expect validation error on supportedDataTypes
          await expect(page.getByTestId('supported-data-types')).toBeVisible();
        });

        await test.step('Remove OpenMetadata and select only dbt — field should not be required', async () => {
          // Remove OpenMetadata from testPlatforms
          // TODO(live): multi-select tag remove has no testid/aria-label in core-components;
          // verify this selector against a live run.
          await page
            .getByTestId('test-platforms')
            .locator('div')
            .filter({ hasText: 'OpenMetadata' })
            .getByRole('button')
            .first()
            .click();

          // Add dbt
          await page.getByTestId('test-platforms').click();
          await page.getByRole('option', { name: 'dbt', exact: true }).click();

          // Close dropdown
          await page.keyboard.press('Escape');

          // Submit the form — supportedDataTypes should no longer block submission
          const testDefinitionResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/dataQuality/testDefinitions') &&
              response.request().method() === 'POST'
          );
          await page.getByTestId('save-test-definition').click();

          const responseData = await testDefinitionResponse;
          expect(responseData.status()).toBe(201);

          const responseBody = await responseData.json();
          createdTestDefinitionId = responseBody.id;

          await toastNotification(page, /created successfully/i);
        });
      } finally {
        if (createdTestDefinitionId) {
          const { apiContext } = await getApiContext(page);
          const deleteResponse = await apiContext.delete(
            `/api/v1/dataQuality/testDefinitions/${createdTestDefinitionId}`
          );

          expect(deleteResponse.ok()).toBeTruthy();
        }
      }
    });

    test('should cancel form and close drawer', async ({ page }) => {
      // Navigate to Test Library
      await page.goto('/test-library');

      // Click add button
      await page.getByTestId('add-test-definition-button').click();

      // Wait for drawer to open
      await page
        .getByTestId('test-definition-form-body')
        .waitFor({ state: 'visible' });

      // Fill in some fields
      await page
        .getByTestId('test-definition-name')
        .locator('input')
        .fill('testName');

      // Click cancel
      await page.getByRole('button', { name: /Cancel/i }).click();

      // Verify drawer is closed
      await expect(
        page.getByTestId('test-definition-form-body')
      ).not.toBeVisible();
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

      await page.goto('/test-library');
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
      // Navigate to Test Library
      await page.goto('/test-library');

      // Wait for table to load
      await page.getByTestId('test-definition-table').waitFor({
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
      const enabledSwitch = page.getByTestId(
        `enable-switch-${systemTestDef.name}`
      );

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
      await page.goto('/test-library');
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
        await page.goto('/test-library');

        await page.getByTestId('add-test-definition-button').click();

        await expect(
          page.getByTestId('test-definition-form-body')
        ).toBeVisible();

        await page
          .getByTestId('test-definition-name')
          .locator('input')
          .fill(EXTERNAL_TEST_NAME);
        await page
          .getByTestId('display-name')
          .locator('input')
          .fill(EXTERNAL_TEST_DISPLAY_NAME);
        await page
          .getByTestId('description')
          .locator('textarea')
          .fill('External test for read-only validation');

        await page.getByTestId('entity-type').click();
        const tableOption = page.getByRole('option', {
          name: 'TABLE',
          exact: true,
        });
        await expect(tableOption).toBeVisible();
        await tableOption.click();

        await page.getByTestId('test-platforms').click();
        const openMetadataOption = page.getByRole('option', {
          name: 'OpenMetadata',
          exact: true,
        });
        await expect(openMetadataOption).toBeVisible();
        await openMetadataOption.click();

        const dbtOption = page.getByRole('option', {
          name: 'dbt',
          exact: true,
        });
        await expect(dbtOption).toBeVisible();
        await dbtOption.click();
        await page.keyboard.press('Escape');

        // Add a parameter to verify DQ Dimension can still be set on a subsequent edit
        await page.getByRole('button', { name: 'Add Parameter' }).click();
        await page.getByPlaceholder('Parameter Name').fill('threshold');

        const createResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.request().method() === 'POST'
        );

        await page.getByTestId('save-test-definition').click();

        const responseData = await createResponse;
        expect(responseData.status()).toBe(201);

        await toastNotification(page, /created successfully/i);
        await expect(page.getByTestId(EXTERNAL_TEST_NAME)).toBeVisible();
      });

      await test.step('Verify fields are read-only in edit mode', async () => {
        await expect(page.getByTestId('test-definition-table')).toBeVisible();

        const editButton = page.getByTestId(
          `edit-test-definition-${EXTERNAL_TEST_NAME}`
        );
        await editButton.click();

        await expect(
          page.getByTestId('test-definition-form-body')
        ).toBeVisible();

        await expect(
          page.getByTestId('entity-type').locator('input')
        ).toBeDisabled();
        await expect(
          page.getByTestId('test-platforms').locator('input')
        ).toBeDisabled();
        await expect(page.getByTestId('sql-expression')).toBeDisabled();
        await expect(
          page.getByTestId('supported-data-types').locator('input')
        ).toBeDisabled();
        await expect(
          page.getByTestId('supported-services').locator('input')
        ).toBeDisabled();

        await expect(
          page.getByTestId('display-name').locator('input')
        ).not.toBeDisabled();
        await expect(
          page.getByTestId('description').locator('textarea')
        ).not.toBeDisabled();

        await expect(
          page.getByTestId('data-quality-dimension')
        ).not.toBeDisabled();
      });

      await test.step('Verify allowed fields can be edited and DQ Dimension can be added', async () => {
        const displayNameField = page
          .getByTestId('display-name')
          .locator('input');
        await displayNameField.clear();
        const updatedDisplayName = `Updated ${EXTERNAL_TEST_DISPLAY_NAME}`;
        await displayNameField.fill(updatedDisplayName);
        createdTestDisplayName = updatedDisplayName;
        const drawer = page.getByTestId('test-definition-form-body');

        const descriptionField = drawer
          .getByTestId('description')
          .locator('textarea');
        await expect(descriptionField).not.toBeDisabled();
        await descriptionField.clear();
        await descriptionField.fill('Updated description for external test');

        const parameterDataType = drawer.getByTestId('parameter-data-type-0');
        await expect(parameterDataType).toBeVisible();

        // Add a DQ Dimension — verifies that editing a test definition with existing
        // parameters does not prevent the dimension from being saved correctly.
        await page.getByTestId('data-quality-dimension').click();
        const accuracyOption = page.getByRole('option', {
          name: 'Accuracy',
          exact: true,
        });
        await expect(accuracyOption).toBeVisible();
        await accuracyOption.click();

        // Save without providing parameter dataType or description — both are optional.
        const patchResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.request().method() === 'PATCH'
        );

        await page.getByTestId('save-test-definition').click();

        const updateResponse = await patchResponse;
        expect(updateResponse.status()).toBe(200);

        const updatedBody = await updateResponse.json();
        expect(updatedBody.dataQualityDimension).toBe('Accuracy');
        // Verify the parameter is preserved with only the name set
        expect(updatedBody.parameterDefinition[0].name).toBe('threshold');
        expect(updatedBody.parameterDefinition[0].dataType).toBeUndefined();
        expect(updatedBody.parameterDefinition[0].description).toBeUndefined();

        await toastNotification(page, /updated successfully/i);
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

        await toastNotification(page, /deleted successfully/i);
        await expect(page.getByTestId(EXTERNAL_TEST_NAME)).not.toBeVisible();
      });
    });

    test('should handle supported services field correctly', async ({
      page,
    }) => {
      const SUPPORTED_SERVICES_TEST_NAME = `AaaaServiceFilterTest${uuid()}`;
      const SUPPORTED_SERVICES_DISPLAY_NAME = `Aaaa Service Filter Test ${uuid()}`;
      let createdTestId: string;

      await test.step('Create test definition with specific supported services', async () => {
        await page.goto('/test-library');

        await page.getByTestId('add-test-definition-button').click();

        await expect(
          page.getByTestId('test-definition-form-body')
        ).toBeVisible();

        await page
          .getByTestId('test-definition-name')
          .locator('input')
          .fill(SUPPORTED_SERVICES_TEST_NAME);
        await page
          .getByTestId('display-name')
          .locator('input')
          .fill(SUPPORTED_SERVICES_DISPLAY_NAME);
        await page
          .getByTestId('description')
          .locator('textarea')
          .fill('Test definition to validate supported services filtering');

        await page.getByTestId('entity-type').click();
        const entityTypeOption = page.getByRole('option', {
          name: 'TABLE',
          exact: true,
        });
        await expect(entityTypeOption).toBeVisible();
        await entityTypeOption.click();

        // Select supported data types (required when OpenMetadata platform is selected)
        await page.getByTestId('supported-data-types').click();
        await page
          .getByTestId('supported-data-types')
          .locator('input')
          .fill('NUMBER');
        await page.getByRole('option', { name: 'NUMBER', exact: true }).click();
        await page.keyboard.press('Escape');

        await page.getByTestId('supported-services').click();
        await page
          .getByTestId('supported-services')
          .locator('input')
          .fill('Mysql');
        const mysqlOption = page.getByRole('option', {
          name: 'Mysql',
          exact: true,
        });
        await expect(mysqlOption).toBeVisible();
        await mysqlOption.click();
        await page.getByTestId('supported-services').locator('input').clear();
        await page
          .getByTestId('supported-services')
          .locator('input')
          .fill('Postgres');

        const postgresOption = page.getByRole('option', {
          name: 'Postgres',
          exact: true,
        });
        await expect(postgresOption).toBeVisible();
        await postgresOption.click();
        await page.keyboard.press('Escape');

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

        await toastNotification(page, /created successfully/i);
        await expect(
          page.getByTestId(SUPPORTED_SERVICES_TEST_NAME)
        ).toBeVisible();
      });

      await test.step('Verify supported services are saved correctly', async () => {
        await expect(page.getByTestId('test-definition-table')).toBeVisible();

        const editButton = page.getByTestId(
          `edit-test-definition-${SUPPORTED_SERVICES_TEST_NAME}`
        );
        await editButton.click();

        await expect(
          page.getByTestId('test-definition-form-body')
        ).toBeVisible();

        const supportedServicesField = page.getByTestId('supported-services');
        await expect(supportedServicesField).toBeVisible();

        await expect(
          page
            .getByTestId('supported-services')
            .getByText('Mysql', { exact: true })
        ).toBeVisible();
        await expect(
          page
            .getByTestId('supported-services')
            .getByText('Postgres', { exact: true })
        ).toBeVisible();

        await page.getByRole('button', { name: /Cancel/i }).click();
        await expect(
          page.getByTestId('test-definition-form-body')
        ).not.toBeVisible();
      });

      await test.step('Verify test definition appears when filtering by supported services', async () => {
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
      });

      await test.step('Edit and change supported services', async () => {
        await expect(page.getByTestId('test-definition-table')).toBeVisible();

        const editButton = page.getByTestId(
          `edit-test-definition-${SUPPORTED_SERVICES_TEST_NAME}`
        );
        await editButton.click();

        await expect(
          page.getByTestId('test-definition-form-body')
        ).toBeVisible();

        // TODO(live): multi-select tag remove has no testid/aria-label in core-components;
        // verify this selector against a live run.
        await page
          .getByTestId('supported-services')
          .locator('div')
          .filter({ hasText: 'Mysql' })
          .getByRole('button')
          .first()
          .click();

        await expect(
          page
            .getByTestId('supported-services')
            .getByText('Mysql', { exact: true })
        ).toHaveCount(0);

        await page.getByTestId('supported-services').click();
        await page
          .getByTestId('supported-services')
          .locator('input')
          .fill('BigQuery');
        const bigQueryOption = page.getByRole('option', {
          name: 'BigQuery',
          exact: true,
        });
        await expect(bigQueryOption).toBeVisible();
        await bigQueryOption.click();
        await page.keyboard.press('Escape');

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

        await toastNotification(page, /updated successfully/i);
      });

      await test.step('Verify updated supported services are persisted', async () => {
        await expect(page.getByTestId('test-definition-table')).toBeVisible();

        const editButton = page.getByTestId(
          `edit-test-definition-${SUPPORTED_SERVICES_TEST_NAME}`
        );
        await editButton.click();

        await expect(
          page.getByTestId('test-definition-form-body')
        ).toBeVisible();

        await expect(
          page
            .getByTestId('supported-services')
            .getByText('Postgres', { exact: true })
        ).toBeVisible();

        await expect(
          page
            .getByTestId('supported-services')
            .getByText('BigQuery', { exact: true })
        ).toBeVisible();

        await expect(
          page
            .getByTestId('supported-services')
            .getByText('Mysql', { exact: true })
        ).toHaveCount(0);

        await page.getByRole('button', { name: /Cancel/i }).click();
        await expect(
          page.getByTestId('test-definition-form-body')
        ).not.toBeVisible();
      });

      await test.step('Clear all supported services (should apply to all services)', async () => {
        await expect(page.getByTestId('test-definition-table')).toBeVisible();

        const editButton = page.getByTestId(
          `edit-test-definition-${SUPPORTED_SERVICES_TEST_NAME}`
        );
        await editButton.click();

        await expect(
          page.getByTestId('test-definition-form-body')
        ).toBeVisible();

        // TODO(live): multi-select tag remove has no testid/aria-label in core-components;
        // verify this selector against a live run.
        await page
          .getByTestId('supported-services')
          .locator('div')
          .filter({ hasText: 'Postgres' })
          .getByRole('button')
          .first()
          .click();

        await expect(
          page
            .getByTestId('supported-services')
            .getByText('Postgres', { exact: true })
        ).toHaveCount(0);

        // TODO(live): multi-select tag remove has no testid/aria-label in core-components;
        // verify this selector against a live run.
        await page
          .getByTestId('supported-services')
          .locator('div')
          .filter({ hasText: 'BigQuery' })
          .getByRole('button')
          .first()
          .click();

        await expect(
          page
            .getByTestId('supported-services')
            .getByText('BigQuery', { exact: true })
        ).toHaveCount(0);

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

        await toastNotification(page, /updated successfully/i);
      });

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

        await toastNotification(page, /deleted successfully/i);
        await expect(
          page.getByTestId(SUPPORTED_SERVICES_TEST_NAME)
        ).not.toBeVisible();
      });
    });

    test('should maintain page on edit and reset to first page on delete', async ({
      page,
    }) => {
      test.slow();
      const PAGINATION_TEST_NAME = `zzzzPaginationTest${uuid()}`;
      const PAGINATION_TEST_DISPLAY_NAME = `Zzzz Pagination Test ${uuid()}`;
      const UPDATED_DISPLAY_NAME = `Updated ${PAGINATION_TEST_DISPLAY_NAME}`;

      await test.step('Create a test definition starting with "z"', async () => {
        await page.goto('/test-library');
        await page.getByTestId('add-test-definition-button').click();
        await expect(
          page.getByTestId('test-definition-form-body')
        ).toBeVisible();

        await page
          .getByTestId('test-definition-name')
          .locator('input')
          .fill(PAGINATION_TEST_NAME);
        await page
          .getByTestId('display-name')
          .locator('input')
          .fill(PAGINATION_TEST_DISPLAY_NAME);
        await page
          .getByTestId('description')
          .locator('textarea')
          .fill('Test definition for pagination behavior testing');

        await page.getByTestId('entity-type').click();
        await page.getByRole('option', { name: 'TABLE', exact: true }).click();

        // Select supported data types (required when OpenMetadata platform is selected)
        await page.getByTestId('supported-data-types').click();
        await page
          .getByTestId('supported-data-types')
          .locator('input')
          .fill('NUMBER');
        await page.getByRole('option', { name: 'NUMBER', exact: true }).click();
        await page.keyboard.press('Escape');

        const createResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.request().method() === 'POST'
        );

        await page.getByTestId('save-test-definition').click();

        const responseData = await createResponse;
        expect(responseData.status()).toBe(201);
        await toastNotification(page, /created successfully/i);
      });

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

      await test.step('Navigate until we find our test definition or reach last page', async () => {
        const nextButton = page.getByTestId('next');
        const testDefLocator = page.getByTestId(PAGINATION_TEST_NAME);

        // Check if item is already visible on current page
        let isItemVisible = await testDefLocator.isVisible();

        // Navigate until we find our test definition or reach the last page
        while (!isItemVisible && (await nextButton.isEnabled())) {
          const fetchResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/dataQuality/testDefinitions') &&
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
      });

      await test.step('Edit the test definition and verify we stay on the same page', async () => {
        // Verify our test definition is visible on this page
        await expect(page.getByTestId(PAGINATION_TEST_NAME)).toBeVisible();

        // Get current page indicator before edit
        const previousButton = page.getByTestId('previous');
        const prevDisabledBefore = await previousButton.isDisabled();

        // Edit the test definition
        await page
          .getByTestId(`edit-test-definition-${PAGINATION_TEST_NAME}`)
          .click();
        await expect(
          page.getByTestId('test-definition-form-body')
        ).toBeVisible();

        const displayNameInput = page
          .getByTestId('display-name')
          .locator('input');
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

        await toastNotification(page, /updated successfully/i);

        // Verify we stayed on the same page (previous button state should be unchanged)
        if (prevDisabledBefore) {
          await expect(previousButton).toBeDisabled();
        } else {
          await expect(previousButton).toBeEnabled();
        }

        // Verify the updated test definition is still visible
        await expect(page.getByTestId(PAGINATION_TEST_NAME)).toBeVisible();
      });

      await test.step('Delete the test definition and verify redirect to first page', async () => {
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

        await toastNotification(page, /deleted successfully/i);

        // Previous button should be disabled on first page
        const previousButton = page.getByTestId('previous');
        await expect(previousButton).toBeDisabled();

        // Verify the deleted test definition is no longer visible
        await expect(page.getByTestId(PAGINATION_TEST_NAME)).not.toBeVisible();
      });
    });
  }
);
