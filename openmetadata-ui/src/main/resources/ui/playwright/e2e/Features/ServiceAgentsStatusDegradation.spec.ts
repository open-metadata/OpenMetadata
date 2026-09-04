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
import { Page } from '@playwright/test';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { expect, test } from '../../support/fixtures/base';
import { createNewPage, uuid } from '../../utils/common';
import { getEncodedFqn } from '../../utils/entity';
import { getAgentCard } from '../../utils/serviceIngestion';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

let pipelineName = '';

/**
 * The pipeline-service status call decides whether agent *actions* are usable. It must not decide
 * whether agents can be listed: the list and the run history are OpenMetadata entities, so they
 * have to stay on screen while that call is slow or failing. Only a browser can show that — it is
 * a question of what paints before a specific in-flight request resolves.
 */
const STATUS_ROUTE = '**/api/v1/services/ingestionPipelines/status';

/** Kills the SSE progress stream so it cannot repaint cards mid-assertion. */
const stubProgressStream = (page: Page) =>
  page.route(
    '**/api/v1/services/ingestionPipelines/progress/service/**',
    (route) => route.fulfill({ status: 204, body: '' })
  );

const visitAgentsTab = async (page: Page, serviceFQN: string) => {
  await page.goto(
    `/service/databaseServices/${getEncodedFqn(serviceFQN)}/agents/metadata`
  );
  await page.getByTestId('data-assets-header').waitFor();
};

test.describe('Service agents when the pipeline-service status degrades', () => {
  const service = EntityDataClass.databaseService;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    pipelineName = `pw-status-degradation-${uuid()}`;
    const pipelineResponse = await apiContext.post(
      '/api/v1/services/ingestionPipelines',
      {
        data: {
          airflowConfig: { scheduleInterval: '0 0 * * *' },
          loggerLevel: 'INFO',
          name: pipelineName,
          pipelineType: 'metadata',
          service: {
            id: service.entityResponseData.id,
            type: 'databaseService',
          },
          sourceConfig: { config: { type: 'DatabaseMetadata' } },
        },
      }
    );

    expect(pipelineResponse.status()).toBe(201);

    const pipelineFqn = (await pipelineResponse.json()).fullyQualifiedName;
    const endDate = Date.now();
    const startDate = endDate - 60_000;

    // `View run history` only renders for an agent that has runs, and this suite's whole claim is
    // that the run history survives a failing status call — so seed one.
    const statusResponse = await apiContext.put(
      `/api/v1/services/ingestionPipelines/${getEncodedFqn(
        pipelineFqn
      )}/pipelineStatus`,
      {
        data: {
          runId: uuid(),
          pipelineState: 'success',
          startDate,
          timestamp: startDate,
          endDate,
        },
      }
    );

    expect(statusResponse.ok()).toBeTruthy();

    await afterAction();
  });

  test('should list the agents while the status call is still in flight', async ({
    page,
  }) => {
    let releaseStatus = (): void => undefined;
    const statusHeld = new Promise<void>((resolve) => {
      releaseStatus = resolve;
    });

    await stubProgressStream(page);
    await page.route(STATUS_ROUTE, async (route) => {
      await statusHeld;
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ code: 200, platform: 'airflow' }),
      });
    });

    await visitAgentsTab(page, service.entityResponseData.fullyQualifiedName);

    const agentCard = getAgentCard(page, pipelineName);

    // The whole point: the card is there before the status call has answered.
    await expect(agentCard).toBeVisible();
    await expect(
      agentCard.getByTestId('agent-card-actions-skeleton')
    ).toBeVisible();
    await expect(page.getByTestId('add-agent-skeleton')).toBeVisible();
    await expect(agentCard.getByTestId('logs-button')).toBeHidden();
    await expect(agentCard.getByTestId('more-actions')).toBeHidden();

    releaseStatus();

    await expect(agentCard.getByTestId('logs-button')).toBeEnabled();
    await expect(agentCard.getByTestId('more-actions')).toBeEnabled();
    await expect(page.getByTestId('add-new-ingestion-button')).toBeEnabled();
    await expect(
      agentCard.getByTestId('agent-card-actions-skeleton')
    ).toBeHidden();
  });

  test('should list the agents with disabled actions when the status call fails', async ({
    page,
  }) => {
    await stubProgressStream(page);
    await page.route(STATUS_ROUTE, (route) =>
      route.fulfill({
        status: 503,
        body: JSON.stringify({
          code: 503,
          reason: 'Airflow is not reachable from this deployment.',
        }),
      })
    );

    await visitAgentsTab(page, service.entityResponseData.fullyQualifiedName);

    const agentCard = getAgentCard(page, pipelineName);

    await expect(agentCard).toBeVisible();
    await expect(page.getByTestId('no-airflow-placeholder')).toBeVisible();
    await expect(agentCard.getByTestId('logs-button')).toBeDisabled();
    await expect(agentCard.getByTestId('more-actions')).toBeDisabled();
    await expect(page.getByTestId('add-new-ingestion-button')).toBeDisabled();
  });

  test('should still explain itself when the status call answers with no reason', async ({
    page,
  }) => {
    await stubProgressStream(page);
    await page.route(STATUS_ROUTE, (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ code: 500 }) })
    );

    await visitAgentsTab(page, service.entityResponseData.fullyQualifiedName);

    await expect(getAgentCard(page, pipelineName)).toBeVisible();
    await expect(page.getByTestId('no-airflow-placeholder')).toContainText(
      'pipeline service cannot be reached'
    );
  });

  test('should keep the run history reachable when the status call fails', async ({
    page,
  }) => {
    await stubProgressStream(page);
    await page.route(STATUS_ROUTE, (route) =>
      route.fulfill({ status: 503, body: JSON.stringify({ code: 503 }) })
    );

    await visitAgentsTab(page, service.entityResponseData.fullyQualifiedName);

    const agentCard = getAgentCard(page, pipelineName);

    await expect(agentCard).toBeVisible();

    // Run history is read from OpenMetadata's own tables, so it is exactly what stays usable when
    // the pipeline service is down.
    await agentCard.getByTestId('view-run-history-button').click();

    await expect(page.getByTestId('run-history-drawer')).toBeVisible();
    await expect(
      page.getByTestId('run-history-drawer').getByTestId('raw-logs-button')
    ).toBeDisabled();
  });
});
