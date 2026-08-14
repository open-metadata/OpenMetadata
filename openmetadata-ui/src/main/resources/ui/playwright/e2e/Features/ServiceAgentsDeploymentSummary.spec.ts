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
import { getEncodedFqn } from '../../utils/entity';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

/**
 * The deployment summary card's numbers are derived entirely in the browser from
 * `pipelineStatuses`, and the shapes that break them — two Metadata agents whose runs differ in age, a
 * run whose Source and Sink both report the same rows, a queued run — cannot be produced on demand by
 * a real ingestion container (the `chromium` lane has none). So the pipeline reads are fabricated and
 * only the service is real.
 */
interface MockStep {
  name: string;
  records?: number;
  errors?: number;
  warnings?: number;
}

interface MockPipeline {
  name: string;
  pipelineType?: 'metadata' | 'profiler';
  pipelineState?: 'success' | 'queued' | 'running';
  /** Epoch ms of the run — this is what "latest run" is decided on. */
  timestamp?: number;
  steps?: MockStep[];
}

const buildPipeline = (serviceFqn: string, pipeline: MockPipeline) => {
  const fullyQualifiedName = `${serviceFqn}.${pipeline.name}`;
  const hasRun = Boolean(pipeline.pipelineState);

  return {
    airflowConfig: { scheduleInterval: '0 0 * * *' },
    deployed: true,
    enabled: true,
    fullyQualifiedName,
    id: `00000000-0000-0000-0000-${pipeline.name.slice(-12).padStart(12, '0')}`,
    name: pipeline.name,
    pipelineStatuses: hasRun
      ? [
          {
            endDate: pipeline.timestamp,
            pipelineState: pipeline.pipelineState,
            runId: `${pipeline.name}-run`,
            startDate: (pipeline.timestamp ?? 0) - 60_000,
            status: pipeline.steps ?? [],
            timestamp: pipeline.timestamp,
          },
        ]
      : [],
    pipelineType: pipeline.pipelineType ?? 'metadata',
    service: { name: serviceFqn, type: 'databaseService' },
    sourceConfig: { config: { type: 'DatabaseMetadata' } },
  };
};

const mockAgentsTab = async (
  page: Page,
  serviceFqn: string,
  pipelines: MockPipeline[]
) => {
  const data = pipelines.map((pipeline) => buildPipeline(serviceFqn, pipeline));

  // Without Airflow the tab renders "Ingestion Scheduler is unable to respond" instead of the cards.
  await page.route('**/api/v1/services/ingestionPipelines/status', (route) =>
    route.fulfill({ json: { code: 200, platform: 'airflow' } })
  );

  await page.route('**/api/v1/services/ingestionPipelines?*', (route) =>
    route.fulfill({ json: { data, paging: { total: data.length } } })
  );

  // Single-agent refetch after a terminal progress event; left live it would return the real pipeline
  // and clobber the fabricated statuses.
  await page.route('**/api/v1/services/ingestionPipelines/name/*', (route) => {
    const requested = decodeURIComponent(
      route.request().url().split('/name/')[1].split('?')[0]
    );
    const match = data.find(
      (pipeline) => pipeline.fullyQualifiedName === requested
    );

    return match
      ? route.fulfill({ json: match })
      : route.fulfill({ status: 404, body: '' });
  });

  // Kill the SSE stream: live snapshots would overwrite everything above.
  await page.route(
    '**/api/v1/services/ingestionPipelines/progress/service/**',
    (route) => route.fulfill({ status: 204, body: '' })
  );
};

const visitAgentsTab = async (page: Page, serviceFqn: string) => {
  await page.goto(
    `/service/databaseServices/${getEncodedFqn(serviceFqn)}/agents/metadata`
  );
  await page.getByTestId('data-assets-header').waitFor();

  await expect(page.getByTestId('deployment-summary-card')).toBeVisible();
};

test.describe('Service Agents deployment summary', () => {
  const service = EntityDataClass.databaseService;
  let serviceFqn = '';

  test.beforeAll(() => {
    serviceFqn = service.entityResponseData.fullyQualifiedName;
  });

  test('should report the newest Metadata run rather than the sum of both agents', async ({
    page,
  }) => {
    // The older run carries the bigger number on purpose: summing reads 930 and a max reads 900, so
    // only "newest run wins" produces 30.
    await mockAgentsTab(page, serviceFqn, [
      {
        name: 'pw-summary-metadata-old',
        pipelineState: 'success',
        steps: [{ name: 'Source', records: 900 }],
        timestamp: 1_700_000_000_000,
      },
      {
        name: 'pw-summary-metadata-new',
        pipelineState: 'success',
        steps: [{ name: 'Source', records: 30 }],
        timestamp: 1_700_000_500_000,
      },
    ]);
    await visitAgentsTab(page, serviceFqn);

    await expect(page.getByTestId('summary-assets-ingested')).toContainText(
      '30'
    );
    await expect(page.getByTestId('summary-assets-ingested')).not.toContainText(
      '930'
    );
  });

  test('should count a run once when every step reports the same rows', async ({
    page,
  }) => {
    await mockAgentsTab(page, serviceFqn, [
      {
        name: 'pw-summary-two-steps',
        pipelineState: 'success',
        steps: [
          { errors: 0, name: 'Source', records: 120, warnings: 1 },
          { errors: 2, name: 'Sink', records: 120, warnings: 0 },
        ],
        timestamp: 1_700_000_000_000,
      },
    ]);
    await visitAgentsTab(page, serviceFqn);

    // 120 rows seen by both steps, not 240; the two failures are per step, so they still add up.
    await expect(page.getByTestId('summary-assets-ingested')).toContainText(
      '120'
    );
    await expect(page.getByTestId('summary-errors')).toContainText('2');
  });

  test('should not treat a queued agent as complete', async ({ page }) => {
    await mockAgentsTab(page, serviceFqn, [
      {
        name: 'pw-summary-done',
        pipelineState: 'success',
        steps: [{ name: 'Source', records: 50 }],
        timestamp: 1_700_000_000_000,
      },
      {
        name: 'pw-summary-queued',
        pipelineState: 'queued',
        timestamp: 1_700_000_400_000,
      },
    ]);
    await visitAgentsTab(page, serviceFqn);

    // A queued agent used to report pct 100, which both completed the deployment and pulled the
    // average to 100%.
    await expect(page.getByTestId('deployment-progress-bar')).toBeVisible();
    await expect(
      page.getByTestId('deployment-summary-title')
    ).not.toContainText('Deployment complete');
    await expect(page.getByTestId('deployment-progress-bar')).toContainText(
      '50% complete'
    );
    // The queued agent has no assets of its own, and the finished Metadata run is still the newest
    // Metadata run.
    await expect(page.getByTestId('summary-assets-ingested')).toContainText(
      '50'
    );
  });
});
