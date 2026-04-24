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
import { DOMAIN_TAGS } from '../../constant/config';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { navigateToExploreAndSelectEntity } from '../../utils/explore';
import { test } from '../fixtures/pages';

test.describe(
  'ChangeSummary DescriptionSourceBadge',
  { tag: [DOMAIN_TAGS.DISCOVERY] },
  () => {
    let table: TableClass;

    test.beforeAll('Setup test entities', async ({ browser }) => {
      table = new TableClass();
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await table.create(apiContext);

      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/description',
            value: 'AI-generated entity description for badge test',
          },
        ],
        queryParams: { changeSource: 'Suggested' },
      });

      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: `/columns/0/description`,
            value: 'AI-generated column description for badge test',
          },
        ],
        queryParams: { changeSource: 'Suggested' },
      });

      await afterAction();
    });

    test('AI badge should appear on entity description with Suggested source', async ({
      page,
    }) => {
      await redirectToHomePage(page);

      await test.step('Navigate to entity page and verify AI badge', async () => {
        const changeSummaryResponse = page.waitForResponse((response) =>
          response.url().includes('/api/v1/changeSummary/')
        );

        await table.visitEntityPage(page);
        await changeSummaryResponse;
        await waitForAllLoadersToDisappear(page);

        const descriptionContainer = page.getByTestId(
          'asset-description-container'
        );

        await expect(descriptionContainer).toBeVisible();

        const badge = descriptionContainer
          .getByTestId('ai-suggested-badge')
          .first();

        await expect(badge).toBeVisible();
      });

      await test.step('Verify badge tooltip shows metadata', async () => {
        const badge = page
          .getByTestId('asset-description-container')
          .getByTestId('ai-suggested-badge')
          .first();

        await badge.hover();

        const tooltip = page.locator('.ant-tooltip:visible');

        await expect(tooltip).toBeVisible();
      });

      await test.step('Verify AI badge on table description in Explore summary panel', async () => {
        const changeSummaryResponse = page.waitForResponse((response) =>
          response.url().includes('/api/v1/changeSummary/table/')
        );

        await navigateToExploreAndSelectEntity({
          page,
          entityName: table.entity.name,
          fullyQualifiedName: table.entityResponseData?.fullyQualifiedName,
        });

        await changeSummaryResponse;
        await waitForAllLoadersToDisappear(page);

        const badge = page
          .locator('.entity-summary-panel-container')
          .getByTestId('ai-suggested-badge')
          .first();

        await expect(badge).toBeVisible();
      });
    });

    test('AI badge should appear on column description with Suggested source', async ({
      page,
    }) => {
      await redirectToHomePage(page);

      await test.step('Navigate to entity page and verify column badge', async () => {
        const changeSummaryResponse = page.waitForResponse((response) =>
          response.url().includes('/api/v1/changeSummary/')
        );

        await table.visitEntityPage(page);
        await changeSummaryResponse;
        await waitForAllLoadersToDisappear(page);

        const descriptionCells = page
          .getByTestId('description')
          .getByTestId('ai-suggested-badge');

        await expect(descriptionCells.first()).toBeVisible();
      });

      await test.step('Verify AI badge on column description in Explore summary panel', async () => {
        const column = table.entityResponseData?.columns?.[0];

        const changeSummaryResponse = page.waitForResponse((response) =>
          response.url().includes('/api/v1/changeSummary/table/')
        );

        await navigateToExploreAndSelectEntity({
          page,
          entityName: column?.name ?? '',
          exploreTab: 'Column',
        });

        await page
          .getByTestId(`table-data-card_${column?.fullyQualifiedName}`)
          .click();

        await changeSummaryResponse;
        await waitForAllLoadersToDisappear(page);

        const badge = page
          .locator('.entity-summary-panel-container')
          .getByTestId('ai-suggested-badge')
          .first();

        await expect(badge).toBeVisible();
      });
    });

    test('Automated badge should appear on entity description with Automated source', async ({
      browser,
      page,
    }) => {
      const automatedTable = new TableClass();

      await test.step('Create table with Automated description', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        await automatedTable.create(apiContext);

        await automatedTable.patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: '/description',
              value: 'Automated description for badge test',
            },
          ],
          queryParams: { changeSource: 'Automated' },
        });

        await automatedTable.patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: '/columns/0/description',
              value: 'AI-generated column description for automated badge test',
            },
          ],
          queryParams: { changeSource: 'Automated' },
        });

        await afterAction();
      });

      await test.step('Navigate and verify Automated badge on entity description', async () => {
        await redirectToHomePage(page);

        const changeSummaryResponse = page.waitForResponse((response) =>
          response.url().includes('/api/v1/changeSummary/')
        );

        await automatedTable.visitEntityPage(page);
        await changeSummaryResponse;
        await waitForAllLoadersToDisappear(page);

        const descriptionContainer = page.getByTestId(
          'asset-description-container'
        );

        await expect(descriptionContainer).toBeVisible();

        const badge = descriptionContainer
          .getByTestId('automated-badge')
          .first();

        await expect(badge).toBeVisible();
      });

      await test.step('Verify AI badge on column description with Suggested source', async () => {
        const columnBadge = page
          .getByTestId('description')
          .getByTestId('automated-badge');

        await expect(columnBadge.first()).toBeVisible();
      });
    });

    test('Propagated badge should appear on entity description with Propagated source', async ({
      browser,
      page,
    }) => {
      const propagatedTable = new TableClass();

      await test.step('Create table with Propagated description', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        await propagatedTable.create(apiContext);

        await propagatedTable.patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: '/description',
              value: 'Propagated description for badge test',
            },
          ],
          queryParams: { changeSource: 'Propagated' },
        });

        await afterAction();
      });

      await test.step('Navigate and verify Propagated badge', async () => {
        await redirectToHomePage(page);

        const changeSummaryResponse = page.waitForResponse((response) =>
          response.url().includes('/api/v1/changeSummary/')
        );

        await propagatedTable.visitEntityPage(page);
        await changeSummaryResponse;
        await waitForAllLoadersToDisappear(page);

        const descriptionContainer = page.getByTestId(
          'asset-description-container'
        );

        await expect(descriptionContainer).toBeVisible();

        const badge = descriptionContainer
          .getByTestId('propagated-badge')
          .first();

        await expect(badge).toBeVisible();
      });
    });

    test('AI badge should NOT appear for manually-edited descriptions', async ({
      browser,
      page,
    }) => {
      const manualTable = new TableClass();

      await test.step('Create table with manual description', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        await manualTable.create(apiContext);

        await manualTable.patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: '/description',
              value: 'Manually written description',
            },
          ],
        });
        await afterAction();
      });

      await test.step('Navigate and verify no AI badge', async () => {
        await redirectToHomePage(page);

        const changeSummaryResponse = page.waitForResponse((response) =>
          response.url().includes('/api/v1/changeSummary/')
        );

        await manualTable.visitEntityPage(page);
        await changeSummaryResponse;
        await waitForAllLoadersToDisappear(page);

        const descriptionContainer = page.getByTestId(
          'asset-description-container'
        );

        await expect(descriptionContainer).toBeVisible();

        const badge = descriptionContainer.getByTestId('ai-suggested-badge');

        await expect(badge).not.toBeVisible();
      });
    });
  }
);
