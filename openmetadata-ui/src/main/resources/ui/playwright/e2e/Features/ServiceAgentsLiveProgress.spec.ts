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
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { getAgentCard } from '../../utils/serviceIngestion';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const service = new DatabaseServiceClass();
let pipelineFqn = '';
let pipelineName = '';

/**
 * End-to-end without mocks: the browser holds a real SSE connection to
 * `GET /progress/service/{serviceType}/{serviceFqn}/stream` while the test
 * publishes real ProgressUpdate frames through
 * `PUT /progress/{fqn}/{runId}` — the exact endpoint the Python ingestion
 * workflow uses (OMetaProgressMixin). Events flow through the real
 * IngestionProgressTracker and SSE broadcaster.
 */
const publishProgress = async (
  apiContext: APIRequestContext,
  runId: string,
  updateType: 'PROCESSING' | 'PIPELINE_COMPLETE',
  done: number,
  estimatedSecondsRemaining: number
) => {
  const response = await apiContext.put(
    `/api/v1/services/ingestionPipelines/progress/${encodeURIComponent(
      pipelineFqn
    )}/${runId}`,
    {
      data: {
        runId,
        timestamp: Date.now(),
        updateType,
        globalCounters: [{ entityType: 'Table', done, total: 1000 }],
        estimatedSecondsRemaining,
      },
    }
  );

  expect(response.status()).toBe(200);
};

const openAgentsTab = async (page: Page) => {
  await redirectToHomePage(page);
  await service.visitEntityPage(page);
  await page.getByTestId('data-assets-header').waitFor();
  await page.getByTestId('agents').click();

  const metadataSubTab = page.getByTestId('metadata-sub-tab');
  if (await metadataSubTab.isVisible()) {
    await metadataSubTab.click();
  }
};

test.describe(
  'Service Agents live progress (SSE)',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await service.create(apiContext);

      pipelineName = `pw-live-progress-${uuid()}`;
      const pipelineResponse = await apiContext.post(
        '/api/v1/services/ingestionPipelines',
        {
          data: {
            airflowConfig: {},
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

      const pipeline = await pipelineResponse.json();
      pipelineFqn = pipeline.fullyQualifiedName;

      // Seed one finished run so the terminal reconcile refetch has real
      // pipelineStatuses to map and the card renders run history entry points
      const now = Date.now();
      const statusResponse = await apiContext.put(
        `/api/v1/services/ingestionPipelines/${encodeURIComponent(
          pipelineFqn
        )}/pipelineStatus`,
        {
          data: {
            runId: randomUUID(),
            pipelineState: 'success',
            startDate: now - 120000,
            timestamp: now - 120000,
            endDate: now - 60000,
          },
        }
      );

      expect(statusResponse.ok()).toBeTruthy();

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await service.delete(apiContext);
      await afterAction();
    });

    test('agent card and summary update live from the progress stream', async ({
      page,
    }) => {
      test.slow();

      const runId = randomUUID();

      await openAgentsTab(page);

      const { apiContext } = await getApiContext(page);

      const agentCard = getAgentCard(page, pipelineName);

      await expect(agentCard).toBeVisible();

      await test.step('Seeded run renders before any live event', async () => {
        await expect(agentCard.getByTestId('pipeline-status')).toContainText(
          'Success'
        );
        await expect(
          agentCard.getByTestId('agent-run-dot').first()
        ).toBeVisible();
      });

      await test.step('First progress frame flips the card to running', async () => {
        await publishProgress(apiContext, runId, 'PROCESSING', 350, 120);

        await expect(agentCard.getByTestId('pipeline-status')).toContainText(
          'Running'
        );
        await expect(agentCard.getByTestId('agent-progress-bar')).toBeVisible();
        await expect(
          agentCard.getByTestId('agent-assets-metric')
        ).toContainText('350');
        await expect(agentCard.getByTestId('agent-eta-metric')).toBeVisible();

        await expect(page.getByTestId('deployment-summary-card')).toBeVisible();
        await expect(page.getByTestId('summary-assets-ingested')).toContainText(
          '350'
        );
        await expect(page.getByTestId('deployment-progress-bar')).toBeVisible();
      });

      await test.step('Next frame advances the counters', async () => {
        await publishProgress(apiContext, runId, 'PROCESSING', 700, 45);

        await expect(
          agentCard.getByTestId('agent-assets-metric')
        ).toContainText('700');
        await expect(page.getByTestId('summary-assets-ingested')).toContainText(
          '700'
        );
      });

      await test.step('Terminal frame completes the run', async () => {
        await publishProgress(apiContext, runId, 'PIPELINE_COMPLETE', 1000, 0);

        await expect(agentCard.getByTestId('pipeline-status')).toContainText(
          'Success'
        );
        await expect(agentCard.getByTestId('agent-progress-bar')).toBeHidden();
        await expect(
          page.getByTestId('deployment-summary-title')
        ).toContainText('Deployment complete');
      });
    });
  }
);
