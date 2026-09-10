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
import { Locator, Page } from '@playwright/test';
import { SORT_ORDER } from '../../../src/enums/common.enum';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { expect, test } from '../../support/fixtures/base';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

const service = new DatabaseServiceClass();

/**
 * Regression for collate#3919. The Name column renders `displayName ?? name`, so
 * it has to sort on that same value. Agents created from the UI get a
 * machine-generated `name` that carries no relation to the label the user typed
 * (Automations use `OpenMetadata_application_<random>`), so ordering by the raw
 * `name` looks arbitrary on screen.
 *
 * `name` ascending is deliberately the reverse of `displayName` ascending below,
 * which is what makes a raw-`name` sorter observably wrong.
 */
const token = uuid();
const firstByDisplayName = `aaa-sort-probe-${token}`;
const lastByDisplayName = `zzz-sort-probe-${token}`;
const agents = [
  { name: `pw-agent-a-${token}`, displayName: lastByDisplayName },
  { name: `pw-agent-z-${token}`, displayName: firstByDisplayName },
];

/**
 * The `chromium` lane has no Airflow/Argo container, so the real status endpoint
 * returns non-200 and the Pipelines tab renders "Ingestion Scheduler is unable to
 * respond" instead of the table. Stub that one boundary so `isAirflowAvailable`
 * is true; every other call the page makes stays real.
 */
const stubIngestionSchedulerStatus = (page: Page) =>
  page.route('**/api/v1/services/ingestionPipelines/status', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ code: 200, platform: 'airflow' }),
    })
  );

// Only the two agents this spec seeded — the tab lists every database agent.
const seededRowOrder = async (page: Page) => {
  const renderedNames = await page
    .getByTestId('pipeline-name')
    .allTextContents();

  return renderedNames
    .map((name) => name.trim())
    .filter((name) => name.endsWith(token));
};

// The Name column renders `displayName ?? name`, so the listing response is what the cells should
// show — and in the order the response returned them.
const renderedNames = (body: {
  data?: { displayName?: string; name: string }[];
}): string[] =>
  (body.data ?? []).map((pipeline) => pipeline.displayName ?? pipeline.name);

const waitForSortedListing = (page: Page, { cursored = false } = {}) =>
  page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/services/ingestionPipelines?') &&
      response.url().includes('sortField=displayName') &&
      (!cursored || response.url().includes('after=')) &&
      response.status() === 200
  );

/**
 * The Name column's job is to hand ordering to the server and render whatever comes back — sorting
 * in the browser can only ever reorder the loaded page. So assert both halves of that contract:
 * the click issues a request carrying the sort params, and the rendered rows mirror that response
 * in order. Whether the ordering itself is correct is the endpoint's contract, covered by
 * IngestionPipelineSortIT.
 */
const expectSortDelegatedToServer = async (
  page: Page,
  nameHeader: Locator,
  sortOrder: SORT_ORDER
) => {
  const sortedResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/services/ingestionPipelines?') &&
      response.url().includes(`sortField=displayName`) &&
      response.url().includes(`sortOrder=${sortOrder}`) &&
      response.status() === 200
  );

  await nameHeader.click();

  const serverOrder = renderedNames(await (await sortedResponse).json()).filter(
    (name) => name.endsWith(token)
  );

  expect(serverOrder).toHaveLength(agents.length);

  await waitForAllLoadersToDisappear(page);
  await expect.poll(() => seededRowOrder(page)).toEqual(serverOrder);
};

test.describe('Ingestion agent list Name column sorting', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await service.create(apiContext);

    await Promise.all(
      agents.map(async (agent) => {
        const response = await apiContext.post(
          '/api/v1/services/ingestionPipelines',
          {
            data: {
              airflowConfig: { scheduleInterval: '0 0 * * *' },
              displayName: agent.displayName,
              loggerLevel: 'INFO',
              name: agent.name,
              pipelineType: 'metadata',
              service: {
                id: service.entityResponseData.id,
                type: 'databaseService',
              },
              sourceConfig: { config: { type: 'DatabaseMetadata' } },
            },
          }
        );

        expect(response.status()).toBe(201);
      })
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await service.delete(apiContext);

    await afterAction();
  });

  test('should sort the Name column by the name shown in the cell', async ({
    page,
  }) => {
    test.slow();

    await stubIngestionSchedulerStatus(page);

    await test.step('Open the database agents list', async () => {
      await page.goto('/settings/services/databases?tab=pipelines');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page
          .getByTestId('pipeline-name')
          .filter({ hasText: firstByDisplayName })
      ).toBeVisible();
      await expect(
        page.getByTestId('pipeline-name').filter({ hasText: lastByDisplayName })
      ).toBeVisible();
    });

    const nameHeader = page.locator('th:has-text("Name")').first();

    await test.step('Sort ascending on Name', async () => {
      await expect(nameHeader).toBeVisible();

      await expectSortDelegatedToServer(page, nameHeader, SORT_ORDER.ASC);
    });

    await test.step('Sort descending on Name', async () => {
      await expectSortDelegatedToServer(page, nameHeader, SORT_ORDER.DESC);
    });
  });

  /**
   * A sorted cursor is a `(displayNameSort, id)` tuple that only the sorted listing can read, and
   * the cursor outlives a reload because usePaging keeps it in the URL. So the sort order has to
   * outlive the reload too — replaying that cursor down the default `name`-ordered path matches no
   * row and renders an empty page.
   *
   * `pageSize=1` rather than seeding a full page of agents: the tab lists every database agent, so
   * the number of rows is not this spec's to control, but the page size is.
   */
  test('should keep a sorted page addressable across a reload', async ({
    page,
  }) => {
    test.slow();

    await stubIngestionSchedulerStatus(page);

    await page.goto('/settings/services/databases?tab=pipelines&pageSize=1');
    await waitForAllLoadersToDisappear(page);

    const sortedFirstPage = waitForSortedListing(page);

    await page.locator('th:has-text("Name")').first().click();
    await sortedFirstPage;
    await waitForAllLoadersToDisappear(page);

    const secondPage = waitForSortedListing(page, { cursored: true });

    await page.getByTestId('next').click();
    await secondPage;
    await waitForAllLoadersToDisappear(page);

    // Deliberately not asserting *which* agent lands here. The tab lists every database agent, so a
    // spec running alongside this one can create a row that sorts into the cursor's gap; what the
    // bug broke is that the page came back at all.
    const restoredPage = waitForSortedListing(page, { cursored: true });

    await page.reload();
    await restoredPage;
    await waitForAllLoadersToDisappear(page);

    // Without the sort order in the URL the reload replayed a (displayNameSort, id) cursor against
    // the name-ordered listing, which matches no row: an empty table under a "page 2" paginator.
    await expect(page.getByTestId('pipeline-name')).toHaveCount(1);
  });
});
