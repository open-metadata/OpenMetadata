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
import { expect, Page, test } from '@playwright/test';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { createNewPage, uuid } from '../../utils/common';
import { getEncodedFqn } from '../../utils/entity';
import { getAgentCard } from '../../utils/serviceIngestion';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

let pipelineName = '';

/**
 * The real `toggleIngestion` flip lives behind Airflow: it only sets
 * `enabled=false` when Airflow's `disable` endpoint returns 200, which needs a
 * deployed DAG. This suite never deploys one (and `Features` CI has no Airflow),
 * so the live call returns 404 and leaves `enabled` untouched. We therefore mock
 * the Airflow boundary — the toggle call — as a stateful flip, and rewrite the
 * reads it feeds (list + single-agent refetch) so the UI's
 * enabled → pause / disabled → resume mapping is exercised end-to-end without an
 * ingestion container.
 */
const mockToggleFlow = async (page: Page, initialEnabled: boolean) => {
  let enabled = initialEnabled;

  const rewriteEnabled = (pipeline: { name: string; enabled?: boolean }) =>
    pipeline.name === pipelineName ? { ...pipeline, enabled } : pipeline;

  await page.route('**/api/v1/services/ingestionPipelines?*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();

    await route.fulfill({
      response,
      json: { ...body, data: (body.data ?? []).map(rewriteEnabled) },
    });
  });

  // Single-agent refetch after a terminal SSE progress event
  // (`/services/ingestionPipelines/name/{fqn}`) — left un-mocked it would return
  // the real `enabled` and clobber the flip.
  await page.route(
    '**/api/v1/services/ingestionPipelines/name/*',
    async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      await route.fulfill({ response, json: rewriteEnabled(body) });
    }
  );

  await page.route(
    '**/api/v1/services/ingestionPipelines/toggleIngestion/*',
    async (route) => {
      enabled = !enabled;

      await route.fulfill({ status: 200, json: { enabled } });
    }
  );

  await page.route(
    '**/api/v1/services/ingestionPipelines/progress/service/**',
    (route) => route.fulfill({ status: 204, body: '' })
  );
};

const openAgentActions = async (page: Page) => {
  const agentCard = getAgentCard(page, pipelineName);

  await agentCard.getByTestId('more-actions').click();
  await page.getByTestId('actions-dropdown').waitFor();
};

const visitAgentsTab = async (page: Page, serviceFQN: string) => {
  await page.goto(
    `/service/databaseServices/${getEncodedFqn(serviceFQN)}/agents/metadata`
  );
  await page.getByTestId('data-assets-header').waitFor();

  await expect(getAgentCard(page, pipelineName)).toBeVisible();
};

test.describe('Service Agents pause and resume', () => {
  const service = EntityDataClass.databaseService;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    pipelineName = `pw-pause-resume-${uuid()}`;
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

    await afterAction();
  });

  test('should offer pause for an enabled agent and resume in disabled state', async ({
    page,
  }) => {
    await mockToggleFlow(page, true);
    await visitAgentsTab(page, service.entityResponseData.fullyQualifiedName);

    await openAgentActions(page);

    await expect(page.getByTestId('pause-button')).toBeVisible();
    await expect(page.getByTestId('resume-button')).toBeHidden();

    const toggleResponse = page.waitForResponse(
      '/api/v1/services/ingestionPipelines/toggleIngestion/*'
    );
    const getPipelines = page.waitForResponse(
      '/api/v1/services/ingestionPipelines?fields=*'
    );

    await page.getByTestId('pause-button').click();

    await toggleResponse;
    await getPipelines;

    await page.getByTestId('actions-dropdown').waitFor({ state: 'hidden' });

    await openAgentActions(page);

    await expect(page.getByTestId('resume-button')).toBeVisible();
    await expect(page.getByTestId('pause-button')).toBeHidden();
  });
});
