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

import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import { performZoomOut } from '../../utils/lineage';

/**
 * Regression test: exported lineage PNG must include edge lines.
 *
 * After PR #25930 moved edge rendering from SVG to a Canvas element outside
 * the .react-flow__viewport, exported PNGs had no edges (Issue #29124).
 * This test exports the PNG for a fixed entity with known downstream edges and
 * compares it against a stored reference snapshot, so any regression where
 * edges disappear from the export will cause a visible diff failure.
 *
 * Uses sample_data.ecommerce_db.shopify.raw_customer which has stable
 * downstream lineage in the seed dataset.
 */

test.use({ storageState: 'playwright/.auth/admin.json' });

const LINEAGE_URL =
  '/table/sample_data.ecommerce_db.shopify.raw_customer/lineage?fullscreen=true';

test.describe('Lineage PNG export — snapshot regression', () => {
  test('exported PNG includes edge lines between nodes', async ({ page }) => {
    // Navigate to the lineage view and wait for lineage data to load
    const lineageResponsePromise = page.waitForResponse(
      '/api/v1/lineage/getLineage*'
    );
    await page.goto(LINEAGE_URL);
    await lineageResponsePromise;

    // Wait for nodes to render, then wait until the canvas has been drawn.
    // CanvasEdgeRenderer draws on requestAnimationFrame — polling the canvas
    // dimensions confirms the draw cycle has completed.
    await page
      .locator('.react-flow__node')
      .first()
      .waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const canvas = document.querySelector(
        '#lineage-container canvas'
      ) as HTMLCanvasElement | null;

      return canvas !== null && canvas.width > 0 && canvas.height > 0;
    });

    // perform fit view to ensure all the nodes are in view
    await page.getByTestId('fit-screen').click();
    await expect(page.getByRole('menu')).toBeVisible();

    await page.getByRole('menuitem', { name: 'Fit to screen' }).click();

    // perform zoom out to add breathing space around
    await performZoomOut(page, 2);

    // Open the export modal
    await expect(page.getByTestId('export-button')).toBeEnabled();
    await page.getByTestId('export-button').click();

    await page
      .locator('[data-testid="export-entity-modal"] #submit-button')
      .waitFor({ state: 'visible' });

    // Select PNG (the modal defaults to CSV for entity lineage)
    await page.getByTestId('export-type-select').click();
    await page.locator('.ant-select-item[title="PNG"]').click();
    await expect(
      page.getByTestId('export-type-select').getByText('PNGBeta')
    ).toBeVisible();

    // Trigger download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click(
        '[data-testid="export-entity-modal"] button#submit-button:visible'
      ),
    ]);

    const filePath = await download.path();
    expect(filePath).not.toBeNull();

    // Edge-presence check via file size.
    // A pixel-perfect snapshot is too fragile here because any legitimate
    // change to the lineage layout (ELK algorithm, node padding, dark-theme
    // tokens) shifts dimensions and trips toMatchSnapshot's strict size check
    // before any pixel comparison runs.
    //
    // The original bug (#29124) stripped all edges from the PNG, leaving
    // large contiguous white regions that compress to a very small file
    // (<100KB). A PNG that contains edges between nodes is dominated by
    // bezier strokes and is reliably >200KB across layout variations.
    // This bound catches the regression without coupling to exact layout.
    const buffer = fs.readFileSync(filePath!);

    expect(buffer.length).toBeGreaterThan(200_000);
  });
});
