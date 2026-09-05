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
import { expect, test } from '../../support/fixtures/base';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const userClassification = new ClassificationClass();
const systemClassification = new ClassificationClass({
  provider: 'system',
});

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await userClassification.create(apiContext);
  await systemClassification.create(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await userClassification.delete(apiContext);
  await systemClassification.delete(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test('Edit a user classification from the manage button', async ({ page }) => {
  test.slow();

  await userClassification.visitPage(page);

  await page.click('[data-testid="manage-button"]');

  await expect(page.getByTestId('edit-classification')).toBeVisible();

  await page.click('[data-testid="edit-classification"]');

  // The same drawer used for "Add" opens in edit mode and pre-filled
  await expect(page.getByTestId('tags-form')).toBeVisible();
  await expect(page.getByTestId('drawer-heading')).toContainText(
    'Edit Classification'
  );

  const nameField = page.getByTestId('name').getByRole('textbox');

  await expect(nameField).toHaveValue(userClassification.responseData.name);
  // Name is editable for a user (non-system) classification
  await expect(nameField).toBeEnabled();

  const updatedDisplayName = `Edited-${uuid()}`;
  await page
    .getByTestId('displayName')
    .getByRole('textbox')
    .fill(updatedDisplayName);

  const patchResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().includes('/api/v1/classifications/')
  );
  await page.click('[data-testid="save-button"]');
  await patchResponse;

  await expect(page.getByTestId('tags-form')).not.toBeVisible();
  await expect(page.getByTestId('entity-header-display-name')).toContainText(
    updatedDisplayName
  );
});

test('System classification name is disabled in the edit drawer', async ({
  page,
}) => {
  await systemClassification.visitPage(page);

  await page.click('[data-testid="manage-button"]');

  await expect(page.getByTestId('edit-classification')).toBeVisible();

  await page.click('[data-testid="edit-classification"]');

  await expect(page.getByTestId('tags-form')).toBeVisible();
  // System-provided classification name must not be editable
  await expect(page.getByTestId('name').getByRole('textbox')).toBeDisabled();

  await page.click('[data-testid="cancel-button"]');

  await expect(page.getByTestId('tags-form')).not.toBeVisible();
});
