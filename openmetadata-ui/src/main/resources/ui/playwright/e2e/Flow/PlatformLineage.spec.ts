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
  // Slow unconditionally: verifyExportLineagePNG waits up to 120s for the
  // download event, so the outer test timeout must exceed that. The base
  // 60s left PR runs (where PLAYWRIGHT_IS_OSS is set) unable to ever reach
  // the download event — the test timed out mid-render every time.
  test.slow();

  // Cap payload so the client-side toCanvas + PNG encode stays inside the
  // verifyExportLineagePNG 120s download-event budget. The dominant cost is
  // DOM cloning in html-to-image, which scales linearly with node count —
  // ~5000 inner DOM elements per 200 lineage nodes takes ~90s just to
  // clone on nightly CI runners, leaving no room for encoding. 100 nodes
  // is enough to prove the export path works end-to-end (verifies the
  // route intercept, PNG selection, and download event) without dictating
  // an unreliable rendering budget. Any real-user export of a much larger
  // graph is protected by the adaptive-pixelRatio cap in
  // openmetadata-ui/.../utils/Export/ExportUtils.ts.
  const MAX_NODES = 100;

  await page.route('**/api/v1/lineage/getPlatformLineage**', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const filteredData = {
      ...data,
      nodes: data.nodes
        ? Object.fromEntries(Object.entries(data.nodes).slice(0, MAX_NODES))
        : data.nodes,
    };

    // Use Playwright's { response, json } shortcut so headers stay valid
    // after the body change. The shortcut auto-strips Content-Encoding
    // (no longer gzip after our modification) and re-computes Content-
    // Length. Passing headers: response.headers() verbatim — which the
    // previous version did — keeps a stale Content-Encoding: gzip and
    // wrong Content-Length, both of which silently break body parsing.
    await route.fulfill({
      response,
      json: filteredData,
    });
  });

  await redirectToHomePage(page);
  const lineageRes = page.waitForResponse(
    '/api/v1/lineage/getPlatformLineage?view=service*'
  );
  await sidebarClick(page, SidebarItem.LINEAGE);
  await lineageRes;

  // Verify PNG export
  await verifyExportLineagePNG(page, true);

  await page.getByTestId('lineage-layer-btn').click();

  await page
    .locator('[data-testid="lineage-layer-domain-btn"]:not([data-selected])')
    .waitFor();

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
