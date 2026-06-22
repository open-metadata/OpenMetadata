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

import { RDG_ACTIVE_CELL_SELECTOR } from '../../constant/bulkImportExport';
import { SERVICE_TYPE } from '../../constant/service';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  fillTextInputDetails,
  pressKeyXTimes,
} from '../../utils/importUtils';
import { visitServiceDetailsPage } from '../../utils/service';

test.use({ storageState: 'playwright/.auth/admin.json' });

let opGlossary: Glossary;
let opGlossaryTerm: GlossaryTerm;
let opTable: TableClass;

test.describe('BulkEditEntity — OperationBadges and Search (all entity types)', () => {
  test.beforeAll(async ({ browser }) => {
    opGlossary = new Glossary();
    opGlossaryTerm = new GlossaryTerm(opGlossary);
    opTable = new TableClass();

    const { apiContext, afterAction } = await createNewPage(browser);
    await opGlossary.create(apiContext);
    await opGlossaryTerm.create(apiContext);
    await opTable.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await opGlossaryTerm.delete(apiContext);
    await opGlossary.delete(apiContext);
    await opTable.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Glossary bulk edit shows NO_CHANGE badge and OperationSummary on unmodified rows', async ({
    page,
  }) => {
    await opGlossary.visitEntityPage(page);
    await page.click('[data-testid="bulk-edit-table"]');
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.rdg-header-row')).toBeVisible();

    await expect(
      page.locator('.bulk-edit-operation-badge-no_change').first()
    ).toBeVisible();
    await expect(
      page.getByTestId('bulk-edit-operation-summary')
    ).toBeVisible();
    await expect(
      page.locator('.bulk-edit-operation-summary-count-no_change')
    ).toContainText('1');
    await expect(
      page.locator('.bulk-edit-operation-summary-count-update')
    ).toContainText('0');
  });

  test('Glossary bulk edit shows UPDATE badge and increments summary after editing a cell', async ({
    page,
  }) => {
    await opGlossary.visitEntityPage(page);
    await page.click('[data-testid="bulk-edit-table"]');
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.rdg-header-row')).toBeVisible();

    await expect(
      page.locator('.bulk-edit-operation-badge-no_change').first()
    ).toBeVisible();
    await expect(
      page.locator('.bulk-edit-operation-summary-count-update')
    ).toContainText('0');

    await page.click('.rdg-cell[role="gridcell"]');
    await pressKeyXTimes(page, 2, 'ArrowRight');
    await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();
    await fillTextInputDetails(page, 'PW Updated Glossary Term Display');

    await expect(
      page.locator('.bulk-edit-operation-badge-update').first()
    ).toBeVisible();
    await expect(
      page.locator('.bulk-edit-operation-summary-count-update')
    ).toContainText('1');
    await expect(
      page.locator('.bulk-edit-operation-summary-count-no_change')
    ).toContainText('0');
  });

  test('Glossary bulk edit Revert Changes restores all rows to NO_CHANGE', async ({
    page,
  }) => {
    await opGlossary.visitEntityPage(page);
    await page.click('[data-testid="bulk-edit-table"]');
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.rdg-header-row')).toBeVisible();

    // Make a change so at least one row becomes UPDATE
    await page.click('.rdg-cell[role="gridcell"]');
    await pressKeyXTimes(page, 2, 'ArrowRight');
    await page.locator(RDG_ACTIVE_CELL_SELECTOR).click();
    await fillTextInputDetails(page, 'PW Revert Test Display');

    await expect(
      page.locator('.bulk-edit-operation-badge-update').first()
    ).toBeVisible();
    await expect(
      page.locator('.bulk-edit-operation-summary-count-update')
    ).toContainText('1');

    // Revert restores all rows to NO_CHANGE
    await page.getByRole('button', { name: 'Revert Changes' }).click();

    await expect(
      page.locator('.bulk-edit-operation-badge-update')
    ).toHaveCount(0);
    await expect(
      page.locator('.bulk-edit-operation-badge-no_change').first()
    ).toBeVisible();
    await expect(
      page.locator('.bulk-edit-operation-summary-count-update')
    ).toContainText('0');
  });

  test('Glossary bulk edit search filters rows and clear restores them', async ({
    page,
  }) => {
    await opGlossary.visitEntityPage(page);
    await page.click('[data-testid="bulk-edit-table"]');
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.rdg-header-row')).toBeVisible();
    await expect(page.locator('.rdg-row').first()).toBeVisible();

    const termName = opGlossaryTerm.data.name;

    const searchInput = page.getByTestId('bulk-edit-search').locator('input');
    await searchInput.fill('zzz_no_match_pw_abc');
    await expect(page.locator('.rdg-row')).toHaveCount(0);

    await searchInput.fill('');
    await expect(page.getByText(termName)).toBeVisible();
  });

  test('Database service bulk edit shows NO_CHANGE badge and OperationSummary for all rows', async ({
    page,
  }) => {
    await visitServiceDetailsPage(
      page,
      { name: opTable.service.name, type: SERVICE_TYPE.Database },
      false
    );
    await page.click('[data-testid="bulk-edit-table"]');
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.rdg-header-row')).toBeVisible();

    await expect(
      page.getByTestId('bulk-edit-operation-summary')
    ).toBeVisible();
    await expect(
      page.locator('.bulk-edit-operation-badge-no_change').first()
    ).toBeVisible();
    await expect(
      page.locator('.bulk-edit-operation-summary-count-update')
    ).toContainText('0');
  });

  test('Database service bulk edit search filters rows and clear restores them', async ({
    page,
  }) => {
    await visitServiceDetailsPage(
      page,
      { name: opTable.service.name, type: SERVICE_TYPE.Database },
      false
    );
    await page.click('[data-testid="bulk-edit-table"]');
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.rdg-header-row')).toBeVisible();
    await expect(page.locator('.rdg-row').first()).toBeVisible();

    const databaseName = opTable.database.name;

    const searchInput = page.getByTestId('bulk-edit-search').locator('input');
    await searchInput.fill('zzz_no_match_pw_abc');
    await expect(page.locator('.rdg-row')).toHaveCount(0);

    await searchInput.fill('');
    await expect(page.getByText(databaseName)).toBeVisible();
  });
});
