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
import { SidebarItem } from '../../constant/sidebar';
import { redirectToHomePage } from '../../utils/common';
import { verifyExportLineagePNG } from '../../utils/lineage';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

test('Verify Platform Lineage View', async ({ page }) => {

  // Need to add more time for AUT and not for PR checks
  test.slow(process.env.PLAYWRIGHT_IS_OSS !== undefined);

  await redirectToHomePage(page);
  const lineageRes = page.waitForResponse(
    '/api/v1/lineage/getPlatformLineage?view=service*'
  );
  await sidebarClick(page, SidebarItem.LINEAGE);
  await lineageRes;

  // Verify PNG export
  await verifyExportLineagePNG(page, true);

  await page.getByTestId('lineage-layer-btn').click();

  await page.waitForSelector(
    '[data-testid="lineage-layer-domain-btn"]:not(.MUI-selected)'
  );

  const domainRes = page.waitForResponse(
    '/api/v1/lineage/getPlatformLineage?view=domain*'
  );
  await page.getByTestId('lineage-layer-domain-btn').click();
  await domainRes;

  await page.getByTestId('lineage-layer-btn').click();
  const dataProductRes = page.waitForResponse(
    '/api/v1/lineage/getPlatformLineage?view=dataProduct*'
  );
  await page.getByTestId('lineage-layer-data-product-btn').click();
  await dataProductRes;
});
