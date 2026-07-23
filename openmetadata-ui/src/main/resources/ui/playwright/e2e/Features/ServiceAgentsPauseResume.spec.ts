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
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { getAgentCard } from '../../utils/serviceIngestion';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const service = new DatabaseServiceClass();
let pipelineName = '';

/**
 * Pause/resume is a single `toggleIngestion` endpoint that flips `enabled`
 * server-side, and the backend forwards the pause to Airflow. The tests below
 * mock both the pipeline listing and the toggle call so the menu's
 * enabled → pause / disabled → resume mapping can be asserted without an
 * ingestion container.
 */
const mockPipelineEnabledState = async (
  page: Page,
  initialEnabled: boolean
) => {
  let enabled = initialEnabled;

  await page.route('**/api/v1/services/ingestionPipelines?*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();

    await route.fulfill({
      response,
      json: {
        ...body,
        data: (body.data ?? []).map(
          (pipeline: { name: string; enabled?: boolean }) =>
            pipeline.name === pipelineName ? { ...pipeline, enabled } : pipeline
        ),
      },
    });
  });

  await page.route(
    '**/api/v1/services/ingestionPipelines/toggleIngestion/*',
    async (route) => {
      enabled = !enabled;

      await route.fulfill({ status: 200, json: { enabled } });
    }
  );
};

const openAgentActions = async (page: Page) => {
  const agentCard = getAgentCard(page, pipelineName);

  await agentCard.getByTestId('more-actions').click();
  await page.getByTestId('actions-dropdown').waitFor();
};

const visitAgentsTab = async (page: Page) => {
  await redirectToHomePage(page);
  await service.visitEntityPage(page);
  await page.getByTestId('data-assets-header').waitFor();
  await page.getByTestId('agents').click();

  const metadataSubTab = page.getByTestId('metadata-sub-tab');
  if (await metadataSubTab.isVisible()) {
    await metadataSubTab.click();
  }

  await expect(getAgentCard(page, pipelineName)).toBeVisible();
};

const clickAndAwaitToggle = async (page: Page, testId: string) => {
  const toggleResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes('/services/ingestionPipelines/toggleIngestion/') &&
      response.request().method() === 'POST'
  );

  await page.getByTestId(testId).click();

  await toggleResponse;
};

test.describe('Service Agents pause and resume', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await service.create(apiContext);

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

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await service.delete(apiContext);
    await afterAction();
  });

  test('should pause an enabled agent and offer resume afterwards', async ({
    page,
  }) => {
    await mockPipelineEnabledState(page, true);
    await visitAgentsTab(page);

    await openAgentActions(page);

    await expect(page.getByTestId('pause-button')).toBeVisible();
    await expect(page.getByTestId('resume-button')).toBeHidden();

    await clickAndAwaitToggle(page, 'pause-button');

    await openAgentActions(page);

    await expect(page.getByTestId('resume-button')).toBeVisible();
    await expect(page.getByTestId('pause-button')).toBeHidden();
  });

  test('should resume a paused agent and offer pause afterwards', async ({
    page,
  }) => {
    await mockPipelineEnabledState(page, false);
    await visitAgentsTab(page);

    await openAgentActions(page);

    await expect(page.getByTestId('resume-button')).toBeVisible();
    await expect(page.getByTestId('pause-button')).toBeHidden();

    await clickAndAwaitToggle(page, 'resume-button');

    await openAgentActions(page);

    await expect(page.getByTestId('pause-button')).toBeVisible();
    await expect(page.getByTestId('resume-button')).toBeHidden();
  });
});
