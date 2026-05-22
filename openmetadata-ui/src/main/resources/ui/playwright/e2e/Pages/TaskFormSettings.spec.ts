/*
 *  Copyright 2026 Collate.
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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import test, { expect, Page } from '@playwright/test';
import {
  authenticateAdminPage,
  createAdminApiContext,
} from '../../utils/admin';
import { toastNotification, uuid } from '../../utils/common';

const TASK_FORM_SETTINGS_ROUTE = '/settings/governance/task-forms';

const selectAntOption = async (page: Page, testId: string, option: string) => {
  await page.getByTestId(testId).click();
  await page
    .locator('.ant-select-dropdown .ant-select-item-option-content')
    .filter({ hasText: option })
    .first()
    .click();
};

test.describe.serial('Task Form Settings', () => {
  test('loads built-in tag suggestion schema in the visual designer', async ({
    page,
  }) => {
    await authenticateAdminPage(page);
    await page.goto(TASK_FORM_SETTINGS_ROUTE);

    await expect(page.getByTestId('task-form-settings-page')).toBeVisible();
    await page.getByTestId('task-form-list-item-TagSuggestion').click();

    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    await expect(page.getByTestId('task-form-name-input')).toHaveValue(
      'TagSuggestion'
    );
    await expect(page.getByText('Suggested Tags (JSON):')).toBeVisible();
  });

  test('creates and updates a task form schema from settings', async ({
    page,
  }) => {
    const schemaName = `PlaywrightTaskForm${uuid()}`;
    const taskType = `PlaywrightType${uuid()}`;
    const updatedDisplayName = `Playwright Display ${uuid()}`;
    let schemaId: string | undefined;

    try {
      await authenticateAdminPage(page);

      const listResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/taskFormSchemas') &&
          response.request().method() === 'GET'
      );

      await page.goto(TASK_FORM_SETTINGS_ROUTE);
      await listResponse;

      await expect(page.getByTestId('task-form-settings-page')).toBeVisible();

      await page.getByTestId('task-form-add-button').click();
      await page.getByTestId('task-form-name-input').fill(schemaName);
      await page.getByTestId('task-form-type-input').fill(taskType);
      await selectAntOption(page, 'task-form-category-input', 'Custom');

      await page.getByRole('tab', { name: 'Create Form' }).click();
      await page.getByTestId('task-form-create-builder-add-field').click();
      await page
        .getByTestId('task-form-create-builder-field-name-0')
        .fill('requestReason');
      await page
        .getByTestId('task-form-create-builder-field-label-0')
        .fill('Request Reason');
      await page
        .getByTestId('task-form-create-builder-field-required-0')
        .check();

      await page.getByRole('tab', { name: 'Transition Forms' }).click();
      await page.getByTestId('task-form-transition-add-button').click();
      await page.getByTestId('task-form-transition-id-0').fill('approve');
      await page
        .getByTestId('task-form-transition-builder-0-field-name-0')
        .fill('reviewerComment');
      await page
        .getByTestId('task-form-transition-builder-0-field-label-0')
        .fill('Reviewer Comment');

      await page.getByRole('tab', { name: 'Workflow Stages' }).click();
      await page.getByTestId('task-form-stage-mapping-add-button').click();
      await page.getByTestId('task-form-stage-id-0').fill('open');
      await selectAntOption(page, 'task-form-stage-status-0', 'Open');

      const createResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/taskFormSchemas') &&
          response.request().method() === 'POST' &&
          response.ok()
      );

      await page.getByTestId('task-form-save-button').click();

      const createdSchema = await (await createResponse).json();
      schemaId = createdSchema.id;

      expect(
        createdSchema.createFormSchema.properties.requestReason.title
      ).toBe('Request Reason');
      expect(createdSchema.createFormSchema.required).toContain(
        'requestReason'
      );
      expect(
        createdSchema.transitionForms.approve.formSchema.properties
          .reviewerComment.title
      ).toBe('Reviewer Comment');
      expect(createdSchema.defaultStageMappings.open).toBe('Open');

      await toastNotification(page, 'Task form saved successfully');
      await expect(
        page.getByTestId(`task-form-list-item-${schemaName}`)
      ).toBeVisible();
      await expect(page.getByTestId('task-form-name-input')).toHaveValue(
        schemaName
      );

      const updateResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/taskFormSchemas') &&
          response.request().method() === 'PUT' &&
          response.ok()
      );

      await page
        .getByTestId('task-form-display-name-input')
        .fill(updatedDisplayName);
      await page.getByTestId('task-form-save-button').click();
      await updateResponse;

      await toastNotification(page, 'Task form saved successfully');
      await expect(
        page.getByTestId('task-form-display-name-input')
      ).toHaveValue(updatedDisplayName);

      const reloadResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/taskFormSchemas') &&
          response.request().method() === 'GET'
      );

      await page.reload();
      await reloadResponse;

      await page.getByTestId(`task-form-list-item-${schemaName}`).click();
      await expect(
        page.getByTestId('task-form-display-name-input')
      ).toHaveValue(updatedDisplayName);
      await page.getByRole('tab', { name: 'Create Form' }).click();
      await expect(
        page.getByTestId('task-form-create-builder-field-name-0')
      ).toHaveValue('requestReason');
      await page.getByRole('tab', { name: 'Transition Forms' }).click();
      await expect(page.getByTestId('task-form-transition-id-0')).toHaveValue(
        'approve'
      );
    } finally {
      if (schemaId) {
        const { apiContext, afterAction } = await createAdminApiContext();

        try {
          await apiContext.delete(
            `/api/v1/taskFormSchemas/${schemaId}?hardDelete=true&recursive=true`
          );
        } finally {
          await afterAction();
        }
      }
    }
  });
});
