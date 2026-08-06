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
import { expect, Locator, Page, test } from '@playwright/test';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { SORT_ORDER } from '../../../src/enums/common.enum';
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

  const body = await (await sortedResponse).json();
  const serverOrder: string[] = (body.data ?? [])
    .map(
      (pipeline: { displayName?: string; name: string }) =>
        pipeline.displayName ?? pipeline.name
    )
    .filter((name: string) => name.endsWith(token));

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
});
