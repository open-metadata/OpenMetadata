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
import { expect } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { redirectToHomePage } from '../../utils/common';
import {
  dismissLineageMapOnboarding,
  verifyExportLineagePNG,
} from '../../utils/lineage';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

test('Verify Platform Lineage View', async ({ page }) => {
  // Slow unconditionally: verifyExportLineagePNG waits up to 120s for the
  // download event, so the outer test timeout must exceed that. The base
  // 60s left PR runs (where PLAYWRIGHT_IS_OSS is set) unable to ever reach
  // the download event — the test timed out mid-render every time.
  test.slow();

  // Keep PNG rendering within the download-event budget on CI runners.
  const MAX_NODES = 100;

  await page.route('**/api/v1/lineage/scene?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    requestUrl.searchParams.set('size', String(MAX_NODES));
    await route.continue({ url: requestUrl.toString() });
  });

  await redirectToHomePage(page);
  const lineageRes = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
      new URL(response.url()).searchParams.get('lens') === 'service'
  );
  await sidebarClick(page, SidebarItem.LINEAGE);
  expect((await lineageRes).ok()).toBeTruthy();
  await dismissLineageMapOnboarding(page);

  // Verify PNG export
  await verifyExportLineagePNG(page, true);

  await page.getByTestId('lineage-layer-btn').click();

  const domainButton = page.getByTestId('lineage-layer-lens-domain');
  await expect(domainButton).not.toHaveAttribute('data-selected');

  const domainRes = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
      new URL(response.url()).searchParams.get('lens') === 'domain'
  );
  await domainButton.click();
  expect((await domainRes).ok()).toBeTruthy();

  await page.getByTestId('lineage-layer-btn').click();
  const dataProductRes = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
      new URL(response.url()).searchParams.get('lens') === 'dataProduct'
  );
  await page.getByTestId('lineage-layer-lens-dataProduct').click();
  expect((await dataProductRes).ok()).toBeTruthy();
});
