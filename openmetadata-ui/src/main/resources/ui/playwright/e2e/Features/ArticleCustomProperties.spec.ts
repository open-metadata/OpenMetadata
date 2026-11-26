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
import { GlobalSettingOptions } from '../../constant/settings';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { KnowledgeCenterClass } from '../../support/entity/KnowledgeCenterClass';
import { expect, test } from '../../support/fixtures/base';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import {
  addCustomPropertiesForEntity,
  deleteCreatedProperty,
  getCustomPropertyCard,
  removeCustomPropertyViaApi,
  setValueForProperty,
  validateValueForProperty,
} from '../../utils/customProperty';
import { settingClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const ARTICLE_TYPE_NAME = 'page';
const ARTICLE_PROPERTY_DATA = {
  description: 'This is Article custom property',
};

test.describe(
  'Article custom properties',
  { tag: ['@Features', '@Governance'] },
  () => {
    test.describe.configure({ mode: 'default' });

    const article = new KnowledgeCenterClass();
    const propertyName = `cpArticle${uuid().replace(/-/g, '')}`;
    const propertyValue = `churn-playbook-${uuid()}`;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await article.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await removeCustomPropertyViaApi(
        apiContext,
        ARTICLE_TYPE_NAME,
        propertyName
      );
      await article.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('set and read a string custom property on an article', async ({
      page,
    }) => {
      test.slow();

      await test.step('Add a string property under Settings > Articles', async () => {
        await settingClick(page, GlobalSettingOptions.ARTICLES, true);
        await addCustomPropertiesForEntity({
          page,
          propertyName,
          customPropertyData: ARTICLE_PROPERTY_DATA,
          customType: 'String',
        });
      });

      await test.step('Custom Properties tab renders full width', async () => {
        await article.visitPage(page);
        await page.getByTestId('custom_properties').click();

        await expect(getCustomPropertyCard(page, propertyName)).toBeVisible();
        await expect(
          page.getByRole('treegrid', { name: 'Articles' })
        ).not.toBeVisible();
        await expect(
          page.getByTestId('right-panel-toggle-btn')
        ).not.toBeVisible();
      });

      await test.step('Value persists across a page load', async () => {
        await setValueForProperty({
          page,
          propertyName,
          value: propertyValue,
          propertyType: 'string',
          endpoint: EntityTypeEndpoint.KnowledgePage,
        });

        await article.visitPage(page);
        await validateValueForProperty({
          page,
          propertyName,
          value: propertyValue,
          propertyType: 'string',
        });
      });

      await test.step('Content tab keeps the page tree and properties panel', async () => {
        await page.getByTestId('overview').click();

        await expect(
          page.getByRole('treegrid', { name: 'Articles' })
        ).toBeVisible();
        await expect(page.getByTestId('right-panel-toggle-btn')).toBeVisible();
      });

      await test.step('Delete the property from settings', async () => {
        await settingClick(page, GlobalSettingOptions.ARTICLES, true);
        await deleteCreatedProperty(page, propertyName);
      });
    });
  }
);
