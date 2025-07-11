/*
 *  Copyright 2025 Collate.
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
import { expect, test } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
} from '../../utils/common';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('TestCase Version Page', () => {
  const table1 = new TableClass();

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await table1.create(apiContext);
    await table1.createTestCase(apiContext);

    await afterAction();
  });

  test('should show the test case version page', async ({ page }) => {
    const testCase = table1.testCasesResponseData[0];

    await redirectToHomePage(page);
    await page.goto(`/test-case/${testCase.fullyQualifiedName}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await test.step('Display name change', async () => {
      await expect(page.getByTestId('entity-header-name')).toHaveText(
        testCase.name
      );

      await expect(page.getByTestId('version-button')).toBeVisible();
      await expect(page.getByTestId('version-button')).toHaveText('0.1');

      await page.getByTestId('manage-button').click();
      await page.getByTestId('rename-button').click();

      await page.waitForSelector('#displayName');
      await page.fill('#displayName', 'test-case-version-changed');
      const updateNameRes = page.waitForResponse(
        '/api/v1/dataQuality/testCases/*'
      );
      await page.getByTestId('save-button').click();
      await updateNameRes;

      await expect(page.getByTestId('version-button')).toHaveText('0.2');

      await page.getByTestId('version-button').click();
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByTestId('entity-header-display-name').getByTestId('diff-added')
      ).toHaveText('test-case-version-changed');

      await page.getByTestId('version-button').click();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
    });

    await test.step('Description change', async () => {
      await page.getByTestId('edit-description').click();
      await page.waitForSelector('[data-testid="editor"]');

      await page.fill(descriptionBox, 'test case description changed');
      const updateDescriptionRes = page.waitForResponse(
        '/api/v1/dataQuality/testCases/*'
      );
      await page.getByTestId('save').click();
      await updateDescriptionRes;

      await expect(page.getByTestId('version-button')).toHaveText('0.3');

      await page.getByTestId('version-button').click();
      await page.waitForLoadState('networkidle');

      await expect(
        page
          .getByTestId('asset-description-container')
          .getByTestId('markdown-parser')
          .getByTestId('diff-added')
      ).toHaveText('test case description changed');

      await page.getByTestId('version-button').click();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
    });

    await test.step('Parameter change', async () => {
      await page.getByTestId('edit-parameter-icon').click();
      await page.waitForSelector('#tableTestForm');

      await page.locator('#tableTestForm_params_minValue').clear();
      await page.locator('#tableTestForm_params_minValue').fill('20');
      await page.locator('#tableTestForm_params_maxValue').clear();
      await page.locator('#tableTestForm_params_maxValue').fill('40');

      const updateParameterRes = page.waitForResponse(
        '/api/v1/dataQuality/testCases/*'
      );
      await page.getByRole('button', { name: 'Submit' }).click();
      await updateParameterRes;

      await expect(page.getByTestId('version-button')).toHaveText('0.4');

      await page.getByTestId('version-button').click();
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByTestId('minValue').getByTestId('diff-removed')
      ).toHaveText('12');
      await expect(
        page.getByTestId('minValue').getByTestId('diff-added')
      ).toHaveText('20');

      await expect(
        page.getByTestId('maxValue').getByTestId('diff-removed')
      ).toHaveText('34');
      await expect(
        page.getByTestId('maxValue').getByTestId('diff-added')
      ).toHaveText('40');
    });
  });
});
