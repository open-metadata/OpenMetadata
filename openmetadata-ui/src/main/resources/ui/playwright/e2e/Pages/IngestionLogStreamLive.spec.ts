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

import { APIRequestContext } from '@playwright/test';
import {
  DOMAIN_TAGS,
  PLAYWRIGHT_INGESTION_TAG_OBJ,
} from '../../constant/config';
import { LOGS_VIEWER_RUNNING_STATUS_ATTEMPTS } from '../../constant/logsViewer';
import { expect, test } from '../../support/fixtures/base';
import { createNewPage, uuid } from '../../utils/common';
import { getEncodedFqn } from '../../utils/entity';
import {
  getLogViewerLineCount,
  SchedulerDidNotStartError,
  waitForRunningPipelineStatus,
} from '../../utils/logsViewer';
import { getAgentCard } from '../../utils/serviceIngestion';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

/**
 * Watches a REAL ingestion run tail its logs over Server-Sent Events.
 *
 * Nothing about the log stream is mocked: the point is to prove that the backend
 * serves a growing log while the run is still in progress, and that the viewer
 * renders those frames instead of polling `/logs/{fqn}/last`. A mocked stream
 * can prove neither — the connection would already be closed by the time any
 * assertion ran.
 *
 * Kafka is used with NO topic filter so every topic, including Kafka's internal
 * ones, is ingested. That keeps the run alive long enough to observe the tail.
 * `KafkaIngestionClass` deliberately does the opposite (it narrows to a single
 * topic), which is why the pipeline here is built over the API rather than
 * through that class.
 *
 * The run is never waited out. Everything expensive happens in `beforeAll`; the
 * test body only opens the viewer and watches, so the whole spec stays inside
 * `test.slow()`.
 */

const KAFKA_BOOTSTRAP_SERVERS =
  process.env.PLAYWRIGHT_KAFKA_BOOTSTRAP_SERVERS ?? '';
const KAFKA_SCHEMA_REGISTRY_URL =
  process.env.PLAYWRIGHT_KAFKA_SCHEMA_REGISTRY_URL ?? '';

const PIPELINE_TRIGGER_ATTEMPTS = 3;
const PIPELINE_TRIGGER_RETRY_DELAY_MS = 5_000;
const DEPLOY_SETTLE_MS = 5_000;

const serviceName = `pw-kafka-live-logs-${uuid()}`;
const pipelineName = `pw-live-logs-agent-${uuid()}`;

let serviceId = '';
let serviceFqn = '';
let pipelineId = '';
let pipelineFqn = '';
let runId = '';

const triggerPipeline = async (
  apiContext: APIRequestContext,
  id: string
): Promise<void> => {
  let lastStatus: number | undefined;
  let lastBody = '';

  for (let attempt = 1; attempt <= PIPELINE_TRIGGER_ATTEMPTS; attempt++) {
    const triggerResponse = await apiContext.post(
      `/api/v1/services/ingestionPipelines/trigger/${id}`
    );
    lastStatus = triggerResponse.status();

    if (triggerResponse.ok()) {
      return;
    }

    lastBody = await triggerResponse.text();

    if (attempt < PIPELINE_TRIGGER_ATTEMPTS) {
      await new Promise((resolve) =>
        setTimeout(resolve, PIPELINE_TRIGGER_RETRY_DELAY_MS)
      );
    }
  }

  throw new Error(
    `Failed to trigger pipeline ${id} after ${PIPELINE_TRIGGER_ATTEMPTS} attempts: ${lastStatus} ${lastBody}`
  );
};

const deployAndTrigger = async (
  apiContext: APIRequestContext,
  id: string
): Promise<void> => {
  const deployResponse = await apiContext.post(
    `/api/v1/services/ingestionPipelines/deploy/${id}`
  );

  expect(
    deployResponse.ok(),
    `Deploying pipeline ${id} failed with ${deployResponse.status()}`
  ).toBeTruthy();

  // The DAG file is written by the deploy call but the scheduler needs a moment
  // to pick it up; triggering immediately returns a 404 for an unknown DAG.
  await new Promise((resolve) => setTimeout(resolve, DEPLOY_SETTLE_MS));

  await triggerPipeline(apiContext, id);
};

test.describe(
  'Ingestion logs stream live for a running agent',
  {
    tag: [
      `${DOMAIN_TAGS.OBSERVABILITY}:Live_Logs`,
      PLAYWRIGHT_INGESTION_TAG_OBJ.tag,
    ],
  },
  () => {
    test.skip(
      !KAFKA_BOOTSTRAP_SERVERS,
      'PLAYWRIGHT_KAFKA_BOOTSTRAP_SERVERS is not set, so no real ingestion can be run'
    );

    test.beforeAll(async ({ browser }) => {
      // Hooks do not inherit test.slow(). Sized for the re-trigger loop:
      // LOGS_VIEWER_RUNNING_STATUS_ATTEMPTS x 45s plus deploy/settle and setup.
      test.setTimeout(240_000);

      const { apiContext, afterAction } = await createNewPage(browser);

      // Every failure path below (service/pipeline create, deploy, re-trigger)
      // must still release the page created above.
      try {
        const serviceResponse = await apiContext.post(
          '/api/v1/services/messagingServices',
          {
            data: {
              name: serviceName,
              serviceType: 'Kafka',
              connection: {
                config: {
                  type: 'Kafka',
                  bootstrapServers: KAFKA_BOOTSTRAP_SERVERS,
                  schemaRegistryURL: KAFKA_SCHEMA_REGISTRY_URL,
                },
              },
            },
          }
        );

        expect(
          serviceResponse.status(),
          `Creating Kafka service failed: ${await serviceResponse.text()}`
        ).toBe(201);

        const service = await serviceResponse.json();
        serviceId = service.id;
        serviceFqn = service.fullyQualifiedName;

        // No topicFilterPattern at all: every topic is ingested, including the
        // internal `__*` ones the connector otherwise skips. generateSampleData
        // makes the connector read messages per topic, which is what keeps the
        // run alive long enough to watch it tail.
        const pipelineResponse = await apiContext.post(
          '/api/v1/services/ingestionPipelines',
          {
            data: {
              airflowConfig: { scheduleInterval: '0 0 * * *' },
              loggerLevel: 'INFO',
              name: pipelineName,
              pipelineType: 'metadata',
              service: { id: serviceId, type: 'messagingService' },
              sourceConfig: {
                config: {
                  type: 'MessagingMetadata',
                  generateSampleData: true,
                },
              },
            },
          }
        );

        expect(
          pipelineResponse.status(),
          `Creating ingestion pipeline failed: ${await pipelineResponse.text()}`
        ).toBe(201);

        const pipeline = await pipelineResponse.json();
        pipelineId = pipeline.id;
        pipelineFqn = pipeline.fullyQualifiedName;

        await deployAndTrigger(apiContext, pipelineId);

        // A run still `queued` after the wait means the trigger raced the
        // scheduler serializing a freshly deployed DAG; re-triggering is what
        // unsticks it, the same way IncidentManager re-triggers. A terminal state
        // is a real signal and rethrows immediately.
        for (
          let attempt = 1;
          attempt <= LOGS_VIEWER_RUNNING_STATUS_ATTEMPTS;
          attempt++
        ) {
          try {
            ({ runId } = await waitForRunningPipelineStatus(
              apiContext,
              pipelineFqn
            ));

            break;
          } catch (error) {
            if (
              !(error instanceof SchedulerDidNotStartError) ||
              attempt === LOGS_VIEWER_RUNNING_STATUS_ATTEMPTS
            ) {
              throw error;
            }

            await triggerPipeline(apiContext, pipelineId);
          }
        }
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      if (pipelineId) {
        // The run is deliberately left in flight; killing it frees the Airflow
        // slot for the rest of this serial lane.
        await apiContext.post(
          `/api/v1/services/ingestionPipelines/kill/${pipelineId}`
        );
      }

      if (serviceId) {
        await apiContext.delete(
          `/api/v1/services/messagingServices/${serviceId}?hardDelete=true&recursive=true`
        );
      }

      await afterAction();
    });

    test('Live logs arrive over SSE while the agent runs, with no polling', async ({
      page,
    }) => {
      test.slow();

      const streamRequests: string[] = [];
      let paginatedLogCalls = 0;

      page.on('request', (request) => {
        const url = request.url();

        if (url.includes('/services/ingestionPipelines/logs/')) {
          if (url.includes('/stream/')) {
            streamRequests.push(url);
          } else if (url.includes('/last')) {
            paginatedLogCalls++;
          }
        }
      });

      await page.goto(
        `/service/messagingServices/${getEncodedFqn(
          serviceFqn
        )}/agents/metadata`
      );
      await page.getByTestId('data-assets-header').waitFor();

      const agentCard = getAgentCard(page, pipelineName);

      await test.step('The agent card reports the run as running', async () => {
        await expect(agentCard).toBeVisible();

        // Also guarantees the card renders `logs-button` rather than the
        // `diagnose-button` a failed agent shows in its place.
        await expect(agentCard.getByTestId('pipeline-status')).toContainText(
          'Running'
        );
      });

      const streamResponse = page.waitForResponse((response) =>
        response.url().includes(`/logs/${getEncodedFqn(pipelineFqn)}/stream/`)
      );

      await agentCard.getByTestId('logs-button').click();

      await test.step('The viewer opens an SSE stream for this run', async () => {
        const response = await streamResponse;

        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain(
          'text/event-stream'
        );
        expect(response.url()).toContain(encodeURIComponent(runId));
      });

      await test.step('The viewer reports the stream as live', async () => {
        await expect(
          page.getByTestId('log-viewer-live-indicator')
        ).toBeVisible();
        await expect(
          page.getByTestId('log-viewer-reconnecting-indicator')
        ).toBeHidden();
        await expect(page.getByTestId('log-viewer-stream-error')).toBeHidden();
      });

      await test.step('Log content keeps growing without a reload', async () => {
        await expect(page.getByTestId('log-viewer-total-lines')).toBeVisible();

        const initialLineCount = await getLogViewerLineCount(page);

        expect(
          initialLineCount,
          'the first streamed frame should already carry log lines'
        ).toBeGreaterThan(0);

        // The server reads the run's log every 2s (LogStreamSettings.pollSeconds),
        // but the connector does not write at a steady rate: it logs a burst, then
        // goes quiet for however long its next phase takes. The longest gap is
        // between the connection test and the first topic being ingested, where the
        // Kafka consumer joins its group and blocks on an empty poll — nothing is
        // logged for the whole of it. A measured CI run sat silent for 29.8s there
        // and this assertion, then budgeted 30s, gave up 0.2s before the next burst
        // landed. The window has to clear that gap with margin rather than race it;
        // `test.slow()` above leaves ample room (the whole test ran in 33s).
        //
        // A stream that connects but delivers nothing still fails here — 90s of
        // silence is not something a healthy run produces.
        await expect
          .poll(() => getLogViewerLineCount(page), {
            message:
              'the log viewer should keep receiving lines while the run is live',
            timeout: 90_000,
            intervals: [2_000],
          })
          .toBeGreaterThan(initialLineCount);
      });

      await test.step('The paginated log endpoint is never polled while streaming', async () => {
        await expect(
          page.getByTestId('log-viewer-live-indicator')
        ).toBeVisible();

        expect(
          paginatedLogCalls,
          `expected no /logs/{fqn}/last requests while streaming, saw ${paginatedLogCalls}`
        ).toBe(0);
      });

      await test.step('A reconnect resumes from the last cursor', async () => {
        // The stream may or may not drop inside the test window. If it did, the
        // reconnect must carry the cursor rather than re-reading from zero.
        streamRequests.slice(1).forEach((url) => {
          expect(
            url,
            'a resumed stream request must carry the `after` cursor'
          ).toContain('after=');
        });
      });

      await page.getByTestId('log-viewer-close').click();

      await expect(page.getByTestId('log-viewer-title')).toBeHidden();
    });
  }
);
