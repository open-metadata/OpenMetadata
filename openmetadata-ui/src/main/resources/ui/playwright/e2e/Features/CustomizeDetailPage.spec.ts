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
import test, { expect } from '@playwright/test';
import { ECustomizedDataAssets } from '../../constant/customizeDetail';
import { GlobalSettingOptions } from '../../constant/settings';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { EntityDataClassCreationConfig } from '../../support/entity/EntityDataClass.interface';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  getCustomizeDetailsDefaultTabs,
  getCustomizeDetailsEntity,
} from '../../utils/customizeDetails';
import { settingClick } from '../../utils/sidebar';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
});

const persona = new PersonaClass();

const creationConfig: EntityDataClassCreationConfig = {
  table: true,
  topic: true,
  dashboard: true,
  mlModel: true,
  pipeline: true,
  dashboardDataModel: true,
  apiCollection: true,
  searchIndex: true,
  container: true,
  storedProcedure: true,
  apiEndpoint: true,
  database: true,
  databaseSchema: true,
};

test.describe('Customize Detail Page', async () => {
  test.beforeAll('Setup Customize tests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await EntityDataClass.preRequisitesForTests(apiContext, creationConfig);
    await persona.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup Customize tests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await persona.delete(apiContext);
    await EntityDataClass.postRequisitesForTests(apiContext, creationConfig);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    // await settingClick(page, GlobalSettingOptions.PERSONA);
    // await page.waitForLoadState('networkidle');
    // await page.getByTestId(`persona-details-card-${persona.data.name}`).click();

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  });

  test('should show all the customize options', async ({ page }) => {
    await page.getByRole('tab', { name: 'Customize UI' }).click();

    await expect(page.getByText('Navigation')).toBeVisible();
    await expect(page.getByText('Homepage')).toBeVisible();
    await expect(page.getByText('Governance')).toBeVisible();
    await expect(page.getByText('Data Assets')).toBeVisible();
  });

  Object.values(ECustomizedDataAssets).forEach(async (type) => {
    test(`${type} - should show default tabs`, async ({ page }) => {
      test.step(
        'should show all the tabs & widget as default when no customization is done',
        async () => {
          const entity = getCustomizeDetailsEntity(type);
          await entity.visitEntityPage(page);
          await page.waitForLoadState('networkidle');
          const expectedTabs = getCustomizeDetailsDefaultTabs(type);

          const tabs = page.getByRole('tab');

          await expect(tabs).toHaveCount(expectedTabs.length);

          for (const tabName of expectedTabs) {
            await expect(
              page.getByRole('tab', {
                name: tabName,
                exact: true,
              })
            ).toBeVisible();
          }
        }
      );

      test.step(
        `${type} - should show all the tabs & widget as default when no customization is done`,
        async () => {
          await settingClick(page, GlobalSettingOptions.PERSONA);
          await page.waitForLoadState('networkidle');
          await page
            .getByTestId(`persona-details-card-${persona.data.name}`)
            .click();
          await page.getByRole('tab', { name: 'Customize UI' }).click();
          await page.waitForLoadState('networkidle');
          await page.getByText('Data Assets').click();
          await page.getByText(type).click();

          await page.waitForURL(
            `**/customize-page/${persona.data.name}/${type}`
          );

          const expectedTabs = getCustomizeDetailsDefaultTabs(type);

          const tabs = page.getByRole('tab');

          await expect(tabs).toHaveCount(expectedTabs.length);

          for (const tabName of expectedTabs) {
            await expect(
              page.getByRole('tab', {
                name: tabName,
                exact: true,
              })
            ).toBeVisible();
          }
        }
      );
    });
  });
});
