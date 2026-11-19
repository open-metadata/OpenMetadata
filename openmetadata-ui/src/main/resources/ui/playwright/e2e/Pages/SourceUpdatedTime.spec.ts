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
import { DashboardClass } from '../../support/entity/DashboardClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { test } from '../fixtures/pages';

const HOUR = 60 * 60 * 1000;
// Old enough to fall outside any relative-time rounding window, recent enough
// to read as hours rather than days.
const HOURS_SINCE_SOURCE_UPDATE = 2;

const table = new TableClass();
const dashboard = new DashboardClass();
const pipeline = new PipelineClass();
const tableWithoutSourceUpdate = new TableClass();

const assetsWithSourceUpdate = [
  { name: 'table', entity: table },
  { name: 'dashboard', entity: dashboard },
  { name: 'pipeline', entity: pipeline },
];

test.describe('Asset source update time in the entity header', () => {
  let sourceUpdatedAt: number;

  test.beforeAll('Create the assets under test', async ({ browser }) => {
    sourceUpdatedAt = Date.now() - HOURS_SINCE_SOURCE_UPDATE * HOUR;
    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Connectors read lifeCycle.updated from the source during metadata
    // ingestion; patch it directly here.
    for (const { entity } of assetsWithSourceUpdate) {
      await entity.create(apiContext);
      await entity.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/lifeCycle',
            value: { updated: { timestamp: sourceUpdatedAt } },
          },
        ],
      });
    }
    await tableWithoutSourceUpdate.create(apiContext);
    await afterAction();
  });

  test.afterAll('Remove the assets under test', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    for (const { entity } of assetsWithSourceUpdate) {
      await entity.delete(apiContext);
    }
    await tableWithoutSourceUpdate.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  for (const { name, entity } of assetsWithSourceUpdate) {
    test(`shows when the ${name} was last updated at its source`, async ({
      page,
    }) => {
      await entity.visitEntityPage(page);

      const header = page.getByTestId('data-assets-header');
      const sourceUpdated = header.getByTestId('source-updated-at');

      await expect(header.getByText('Updated at source')).toBeVisible();
      await expect(sourceUpdated).toHaveText(
        `${HOURS_SINCE_SOURCE_UPDATE} hours ago`
      );

      // React Aria opens a tooltip on hover only after a pointer press on the
      // page; keyboard focus on the trigger opens it regardless.
      await header
        .getByRole('button')
        .filter({ has: page.getByTestId('source-updated-at') })
        .focus();

      await expect(page.getByRole('tooltip')).toContainText(
        String(new Date(sourceUpdatedAt).getFullYear())
      );
    });
  }

  test('omits the source update time when the source reported none', async ({
    page,
  }) => {
    await tableWithoutSourceUpdate.visitEntityPage(page);

    const header = page.getByTestId('data-assets-header');

    await expect(header).toBeVisible();
    await expect(header.getByTestId('source-updated-at')).toHaveCount(0);
    await expect(header.getByText('Updated at source')).toHaveCount(0);
  });
});
