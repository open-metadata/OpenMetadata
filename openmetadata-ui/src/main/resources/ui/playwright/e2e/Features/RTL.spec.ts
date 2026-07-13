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

import { expect } from '@playwright/test';
import { toLower } from 'lodash';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { clickOutside, redirectToHomePage } from '../../utils/common';
import {
  followEntity,
  validateFollowedEntityToWidget,
} from '../../utils/entity';
import { test } from './../../e2e/fixtures/pages';

test.describe('Verify RTL Layout for landing page', () => {
  const table = EntityDataClass.table1;

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);

    await page.getByTestId('language-selector-button').click();
    await Promise.all([
      page.waitForEvent('load'),
      page.locator('.ant-dropdown:visible [data-menu-id*="-he-HE"]').click(),
    ]);
    await expect(page.getByTestId('domain-selector')).toBeVisible();
    // wait for translation to reflect in the UI
    await expect(page.getByTestId('domain-selector')).toHaveText(
      'כל הדומיינים',
      { timeout: 30_000 }
    );
  });

  test('Verify DataAssets widget functionality', async ({ page }) => {
    test.slow();
    const serviceType = toLower(table.service.serviceType);

    await clickOutside(page);
    const quickFilterResponse = page.waitForResponse(
      `/api/v1/search/query?q=&index=dataAsset*${serviceType}*`
    );

    await page
      .locator(`[data-testid="data-asset-service-${serviceType}"]`)
      .click();

    await quickFilterResponse;

    await expect(
      page.getByRole('button', { name: 'סוג השירות : (1)' })
    ).toBeAttached();

    await expect(
      page
        .getByTestId('explore-tree')
        .locator('span')
        .filter({ hasText: serviceType })
        .first()
    ).toHaveClass(/ant-tree-node-selected/);
  });

  test('Verify Following widget functionality', async ({ page }) => {
    test.slow();
    await table.visitEntityPage(page);

    const entityName = table.entityResponseData?.['displayName'];

    await followEntity(page, table.endpoint, 'בטל מעקב');
    await validateFollowedEntityToWidget(page, entityName ?? '', true);
  });
});
