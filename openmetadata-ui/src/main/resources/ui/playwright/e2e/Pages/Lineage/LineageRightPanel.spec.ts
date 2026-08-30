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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
} from '../../../utils/common';
import { visitLineageTab } from '../../../utils/lineage';
import { test } from '../../fixtures/pages';

test.describe(
  'Hierarchical lineage node details interaction',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    const table = new TableClass();

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );

      await table.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );

      await table.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('drills into asset details instead of opening the legacy right panel', async ({
      page,
    }) => {
      const tableFqn = table.entityResponseData.fullyQualifiedName;

      await table.visitEntityPage(page);
      await visitLineageTab(page);

      const tableNode = page.getByTestId(`lineage-node-${tableFqn}`);
      await expect(tableNode).toBeVisible();

      await page.getByTestId('lineage-layer-btn').click();
      const layerBandButton = page.getByTestId('lineage-layer-band-LAYER');
      const isLayerBandSelected = await layerBandButton.evaluate((element) =>
        element.hasAttribute('data-selected')
      );

      if (!isLayerBandSelected) {
        await layerBandButton.click();
      } else {
        await page.keyboard.press('Escape');
      }

      await expect(
        page
          .getByTestId('lineage-map-band-LAYER')
          .locator('.lineage-map-rail-dot.active')
      ).toBeVisible();

      await tableNode.getByRole('button', { name: 'Zoom In' }).click();

      await expect
        .poll(() => new URL(page.url()).searchParams.get('lineageBand'))
        .toBe('ASSET');
      await expect(page.getByTestId('lineage-map-band-ASSET')).toBeVisible();

      const lineagePanel = page.getByTestId('lineage-entity-panel');
      await expect(lineagePanel).not.toBeVisible();
      await expect(
        lineagePanel.getByTestId('custom-properties-tab')
      ).not.toBeVisible();
    });
  }
);
