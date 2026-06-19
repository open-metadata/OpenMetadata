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

/**
 * E2E verification suite for MUI styled() removal — Phase 1 Steps 7–8.
 *
 * Step 7: styled() in LineageLayers.tsx + LineageTable.styled.tsx replaced
 *   with plain wrapper components using static sx props (no theme callbacks).
 * Step 8: ThemeProvider + GlobalStyles removed from AuthenticatedApp.tsx;
 *   html { font-size: 14px } moved to app.less.
 *
 * These tests confirm:
 *   1. Global base font-size is still 14px after ThemeProvider removal
 *   2. Lineage layer toggle buttons render and respond without styled()
 *   3. LineageTable upstream/downstream toggle + impact-on menu work without styled()
 *   4. No MUI theme-related console errors anywhere after the refactor
 */
import { expect, Page, test } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import {
  clickOutside,
  getDefaultAdminAPIContext,
  redirectToHomePage,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  activateColumnLayer,
  connectEdgeBetweenNodesViaAPI,
  openImpactAnalysisTab,
  visitLineageTab,
} from '../../utils/lineage';

test.use({ storageState: 'playwright/.auth/admin.json' });

const collectMuiErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        text.toLowerCase().includes('mui') ||
        text.toLowerCase().includes('themeprovider') ||
        text.toLowerCase().includes('no theme') ||
        text.toLowerCase().includes('palette')
      ) {
        errors.push(text);
      }
    }
  });

  return errors;
};

test.describe(
  'MUI styled() Removal — Global styles (Step 8)',
  { tag: ['@Platform', '@MUIRefactor'] },
  () => {
    test('html base font-size should be 14px from app.less after ThemeProvider removal', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await waitForAllLoadersToDisappear(page);
      const fontSize = await page.evaluate(
        () => getComputedStyle(document.documentElement).fontSize
      );

      expect(fontSize).toBe('14px');
    });

    test('app should load with no MUI ThemeProvider console errors', async ({
      page,
    }) => {
      const muiErrors = collectMuiErrors(page);

      await redirectToHomePage(page);
      await waitForAllLoadersToDisappear(page);

      expect(muiErrors).toHaveLength(0);
    });
  }
);

test.describe(
  'MUI styled() Removal — LineageLayers toggle buttons (Step 7)',
  { tag: ['@Platform', '@MUIRefactor'] },
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
      await table.visitEntityPage(page);
      await visitLineageTab(page);
    });

    test('lineage layer trigger button is visible after styled() removal', async ({
      page,
    }) => {
      await expect(page.getByTestId('lineage-layer-btn')).toBeVisible();
    });

    test('lineage layer popover opens and shows layer option buttons', async ({
      page,
    }) => {
      await page.getByTestId('lineage-layer-btn').click();

      await expect(page.getByTestId('lineage-layer-column-btn')).toBeVisible();

      await clickOutside(page);
    });

    test('trigger button gets highlight class when popover is open', async ({
      page,
    }) => {
      await page.getByTestId('lineage-layer-btn').click();

      await expect(
        page.locator('[data-testid="lineage-layer-btn"].highlight')
      ).toBeVisible();

      await clickOutside(page);
    });

    test('column layer button becomes Mui-selected on activation', async ({
      page,
    }) => {
      await activateColumnLayer(page);
      await page.getByTestId('lineage-layer-btn').click();

      await expect(
        page.locator('[data-testid="lineage-layer-column-btn"].Mui-selected')
      ).toBeVisible();

      await clickOutside(page);
    });

    test('no MUI theme errors on lineage page after styled() removal', async ({
      page,
    }) => {
      const muiErrors = collectMuiErrors(page);

      await table.visitEntityPage(page);
      await visitLineageTab(page);
      await page.getByTestId('lineage-layer-btn').click();
      await clickOutside(page);

      expect(muiErrors).toHaveLength(0);
    });
  }
);

test.describe(
  'MUI styled() Removal — LineageTable styled components (Step 7)',
  { tag: ['@Platform', '@MUIRefactor'] },
  () => {
    const sourceTable = new TableClass();
    const targetTable = new TableClass();

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );
      await sourceTable.create(apiContext);
      await targetTable.create(apiContext);
      await connectEdgeBetweenNodesViaAPI(
        apiContext,
        { id: sourceTable.entityResponseData.id, type: 'table' },
        { id: targetTable.entityResponseData.id, type: 'table' },
        []
      );
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );
      await sourceTable.delete(apiContext);
      await targetTable.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await sourceTable.visitEntityPage(page);
      await visitLineageTab(page);
      const lineageCountResponse = page.waitForResponse(
        '/api/v1/lineage/getLineageByEntityCount?*'
      );
      await openImpactAnalysisTab(page);
      await lineageCountResponse;
      await waitForAllLoadersToDisappear(page);
    });

    test('upstream/downstream toggle group renders (StyledToggleButtonGroup)', async ({
      page,
    }) => {
      await expect(
        page.getByRole('button', { name: /Downstream/i })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /Upstream/i })
      ).toBeVisible();
    });

    test('switching to upstream mode works after StyledToggleButtonGroup sx migration', async ({
      page,
    }) => {
      const upstreamResponse = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/lineage/getLineageByEntityCount') &&
          r.request().method() === 'GET'
      );
      await page.getByRole('button', { name: /^Upstream/ }).click();
      await upstreamResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByRole('button', { name: /^Upstream/ })
      ).toBeVisible();
    });

    test('impact-on level menu opens and shows options (StyledMenu)', async ({
      page,
    }) => {
      const impactBtn = page.getByRole('button', { name: /Impact On:/i });

      await expect(impactBtn).toBeVisible();
      await impactBtn.click();

      await expect(page.getByText('Asset level')).toBeVisible();
      await expect(page.getByText('Column level')).toBeVisible();

      await page.keyboard.press('Escape');
    });

    test('switching impact level to Column works after StyledMenu sx migration', async ({
      page,
    }) => {
      await page.getByRole('button', { name: /Impact On:/i }).click();

      const columnLevelResponse = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/lineage/getLineage/Downstream') &&
          r.request().method() === 'GET'
      );
      await page.getByText('Column level').click();
      await columnLevelResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByRole('button', { name: /Impact On: Column/i })
      ).toBeVisible();
    });

    test('no MUI theme errors in Impact Analysis tab after styled() removal', async ({
      page,
    }) => {
      const muiErrors = collectMuiErrors(page);

      await sourceTable.visitEntityPage(page);
      await visitLineageTab(page);
      const lineageCountResponse = page.waitForResponse(
        '/api/v1/lineage/getLineageByEntityCount?*'
      );
      await openImpactAnalysisTab(page);
      await lineageCountResponse;
      await waitForAllLoadersToDisappear(page);

      expect(muiErrors).toHaveLength(0);
    });
  }
);
