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

test.describe(
  'Service Agents stream discovery (SSE)',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  () => {
    const discoveryService = new DatabaseServiceClass();

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await discoveryService.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await discoveryService.delete(apiContext);
      await afterAction();
    });

    test('agent discovered from the stream updates card and tab counts without reload', async ({
      page,
    }) => {
      test.slow();

      await redirectToHomePage(page);
      await discoveryService.visitEntityPage(page);
      await page.getByTestId('data-assets-header').waitFor();
      await page.getByTestId('agents').click();

      const metadataSubTab = page.getByTestId('metadata-sub-tab');
      const hasSubTabs = await metadataSubTab.isVisible();
      if (hasSubTabs) {
        await metadataSubTab.click();
      }

      const agentsTabCount = page
        .getByTestId('agents')
        .getByTestId('filter-count');
      const initialTabCount = Number(
        (await agentsTabCount.textContent()) ?? '0'
      );
      const initialSubTabCount = hasSubTabs
        ? Number((await metadataSubTab.textContent())?.match(/\d+/)?.[0] ?? '0')
        : 0;

      const { apiContext } = await getApiContext(page);

      // The pipeline is created only AFTER the page loaded its (empty) agent
      // list, so the card and counts below can only come from the stream.
      const discoveredPipelineName = `pw-discovered-agent-${uuid()}`;
      const pipelineResponse = await apiContext.post(
        '/api/v1/services/ingestionPipelines',
        {
          data: {
            airflowConfig: {},
            loggerLevel: 'INFO',
            name: discoveredPipelineName,
            pipelineType: 'metadata',
            service: {
              id: discoveryService.entityResponseData.id,
              type: 'databaseService',
            },
            sourceConfig: { config: { type: 'DatabaseMetadata' } },
          },
        }
      );

      expect(pipelineResponse.status()).toBe(201);

      const discoveredPipeline = await pipelineResponse.json();
      const runId = randomUUID();

      // The server attaches the pipeline entity to the DISCOVERY frame, which
      // is what lets the UI insert the agent it has never fetched.
      const discoveryResponse = await apiContext.put(
        `/api/v1/services/ingestionPipelines/progress/${encodeURIComponent(
          discoveredPipeline.fullyQualifiedName
        )}/${runId}`,
        {
          data: {
            runId,
            timestamp: Date.now(),
            updateType: 'DISCOVERY',
          },
        }
      );

      expect(discoveryResponse.status()).toBe(200);

      await test.step('Card appears live without a reload', async () => {
        const agentCard = getAgentCard(page, discoveredPipelineName);

        await expect(agentCard).toBeVisible();
        await expect(agentCard.getByTestId('pipeline-status')).toContainText(
          'Running'
        );
      });

      await test.step('Agents tab count includes the discovered agent', async () => {
        await expect(agentsTabCount).toHaveText(String(initialTabCount + 1));
      });

      if (hasSubTabs) {
        await test.step('Metadata sub-tab count includes the discovered agent', async () => {
          await expect(metadataSubTab).toContainText(
            String(initialSubTabCount + 1)
          );
        });
      }
    });
  }
);
