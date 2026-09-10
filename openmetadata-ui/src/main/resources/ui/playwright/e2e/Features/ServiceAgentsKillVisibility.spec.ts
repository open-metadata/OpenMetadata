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
import { APIRequestContext, expect, Page, test } from '@playwright/test';
import { randomUUID } from 'crypto';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { createNewPage, uuid } from '../../utils/common';
import { getEncodedFqn } from '../../utils/entity';
import { getAgentCard } from '../../utils/serviceIngestion';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const service = new DatabaseServiceClass();

let runningAgentName = '';
let idleAgentName = '';

// Long enough that the assertions below all run while the refetch is still open, so what they
// measure is the list's state *during* the request.
const REFETCH_HOLD_MS = 5000;

const createAgent = async (apiContext: APIRequestContext, name: string) => {
  const response = await apiContext.post(
    '/api/v1/services/ingestionPipelines',
    {
      data: {
        airflowConfig: { scheduleInterval: '0 0 * * *' },
        loggerLevel: 'INFO',
        name,
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
};

/**
 * The kill lives behind Airflow, which the `Features` lane has no container for, so only that
 * boundary is stubbed: the status probe (else the cards render unavailable and the overflow menu
 * is disabled) and `kill/{id}` itself. Everything the assertions read — the list, the cards, the
 * loading state — stays real.
 *
 * `refetchStarted` resolves once the list refetch that follows the kill has reached the route
 * handler, and that one request is then held open for `REFETCH_HOLD_MS`. That window is the bug:
 * the list is in flight, and the agents have to still be on screen.
 */
const mockKillFlow = async (page: Page) => {
  let isKilled = false;
  let isRefetchHeld = false;
  let signalRefetch: () => void = () => undefined;
  const refetchStarted = new Promise<void>((resolve) => {
    signalRefetch = resolve;
  });

  await page.route('**/api/v1/services/ingestionPipelines/status', (route) =>
    route.fulfill({ json: { code: 200, platform: 'airflow' } })
  );

  // A run has to be in flight for the card to offer "Kill run", and none can be started without
  // Airflow — so the list response is rewritten to report one.
  const markRunning = (pipeline: { name: string }) =>
    pipeline.name === runningAgentName
      ? {
          ...pipeline,
          pipelineStatuses: [
            {
              runId: randomUUID(),
              pipelineState: 'running',
              startDate: Date.now(),
              timestamp: Date.now(),
            },
          ],
        }
      : pipeline;

  await page.route('**/api/v1/services/ingestionPipelines?*', async (route) => {
    // Keyed off the kill rather than a call counter: the page issues this request on load and on
    // any filter change too, and only the post-kill one is the refetch under test.
    const shouldHold = isKilled && !isRefetchHeld;

    if (shouldHold) {
      isRefetchHeld = true;
      signalRefetch();
    }

    const response = await route.fetch();
    const body = await response.json();

    if (shouldHold) {
      await new Promise((resolve) => setTimeout(resolve, REFETCH_HOLD_MS));
    }

    await route.fulfill({
      response,
      json: { ...body, data: (body.data ?? []).map(markRunning) },
    });
  });

  await page.route('**/api/v1/services/ingestionPipelines/kill/*', (route) => {
    isKilled = true;

    return route.fulfill({ json: {} });
  });

  // Left live it holds the response open, and its overrides would compete with the list rewrite
  // above for the running agent's status.
  await page.route(
    '**/api/v1/services/ingestionPipelines/progress/service/**',
    (route) => route.fulfill({ status: 204, body: '' })
  );

  return { refetchStarted };
};

test.describe('Service Agents visibility after a run is killed', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await service.create(apiContext);

    runningAgentName = `pw-kill-running-${uuid()}`;
    idleAgentName = `pw-kill-idle-${uuid()}`;

    await createAgent(apiContext, runningAgentName);
    await createAgent(apiContext, idleAgentName);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await service.delete(apiContext);
    await afterAction();
  });

  test('agents stay listed while the list refetches after a run is killed', async ({
    page,
  }) => {
    test.slow();

    const { refetchStarted } = await mockKillFlow(page);

    await page.goto(
      `/service/databaseServices/${getEncodedFqn(
        service.entityResponseData.fullyQualifiedName
      )}/agents/metadata`
    );
    await page.getByTestId('data-assets-header').waitFor();

    const runningCard = getAgentCard(page, runningAgentName);
    const idleCard = getAgentCard(page, idleAgentName);

    await expect(runningCard).toBeVisible();
    await expect(idleCard).toBeVisible();
    await expect(runningCard.getByTestId('pipeline-status')).toContainText(
      'Running'
    );

    await test.step('Kill the run from the agent card', async () => {
      await runningCard.getByTestId('more-actions').click();
      await page.getByTestId('actions-dropdown').waitFor();
      await page.getByTestId('kill-button').click();
    });

    await refetchStarted;
    // The refetch is held open for REFETCH_HOLD_MS from here. Give React a beat to paint whatever
    // it renders for a loading list before sampling it — there is no event to wait on, because
    // the assertion is about what does *not* happen.
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(500);

    await test.step('Both agents are still listed while the refetch is in flight', async () => {
      // `isVisible()` deliberately does not retry, and the web-first matchers are wrong here: they
      // would wait the held request out and pass on a list that had been blanked for the whole
      // window — which is the defect itself. These read the DOM as it stands right now, mid-refetch.
      /* eslint-disable playwright/prefer-web-first-assertions */
      expect(await page.getByTestId('agent-group-skeleton').isVisible()).toBe(
        false
      );
      expect(await runningCard.isVisible()).toBe(true);
      expect(await idleCard.isVisible()).toBe(true);
      /* eslint-enable playwright/prefer-web-first-assertions */
    });

    await test.step('Both agents survive the refetch landing', async () => {
      await expect(runningCard).toBeVisible();
      await expect(idleCard).toBeVisible();
    });
  });
});
