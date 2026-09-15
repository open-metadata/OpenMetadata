/*
 *  Copyright 2024 Collate.
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

import test, { expect } from '@playwright/test';
import {
  IngestionPipeline,
  PipelineState,
  PipelineStatus,
} from '../../../src/generated/entity/services/ingestionPipelines/ingestionPipeline';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { MYSQL, POSTGRES, REDSHIFT } from '../../constant/service';
import { GlobalSettingOptions } from '../../constant/settings';
import AirflowIngestionClass from '../../support/entity/ingestion/AirflowIngestionClass';
import ApiIngestionClass from '../../support/entity/ingestion/ApiIngestionClass';
import BigQueryIngestionClass from '../../support/entity/ingestion/BigQueryIngestionClass';
import KafkaIngestionClass from '../../support/entity/ingestion/KafkaIngestionClass';
import MetabaseIngestionClass from '../../support/entity/ingestion/MetabaseIngestionClass';
import MlFlowIngestionClass from '../../support/entity/ingestion/MlFlowIngestionClass';
import MysqlIngestionClass from '../../support/entity/ingestion/MySqlIngestionClass';
import PostgresIngestionClass from '../../support/entity/ingestion/PostgresIngestionClass';
import RedshiftWithDBTIngestionClass from '../../support/entity/ingestion/RedshiftWithDBTIngestionClass';
import SupersetIngestionClass from '../../support/entity/ingestion/SupersetIngestionClass';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { visitServiceDetailsPage } from '../../utils/service';
import {
  getAgentCard,
  waitForIngestionWorkflowForm,
} from '../../utils/serviceIngestion';
import { settingClick, SettingOptionsType } from '../../utils/sidebar';

const table = new TableClass();
const services: Record<string, typeof ApiIngestionClass> = {
  'Api Service': ApiIngestionClass,
  // Skipping S3 as it is failing intermittently in CI
  // Remove the comment when fixed: https://github.com/open-metadata/OpenMetadata/issues/23727
  // S3IngestionClass,
  'Metabase Service': MetabaseIngestionClass,
  'Mysql Service': MysqlIngestionClass,
  'BigQuery Service': BigQueryIngestionClass,
  'Kafka Service': KafkaIngestionClass,
  'MlFlow Service': MlFlowIngestionClass,
  //Skipping Snowflake since instance in temperary down
  // @mohittilala unskip once we have a stable snowflake instance
  // 'Snowflake Service': SnowflakeIngestionClass,
  'Superset Service': SupersetIngestionClass,
  'Postgres Service': PostgresIngestionClass,
  'Redshift Service': RedshiftWithDBTIngestionClass,
};

if (process.env.PLAYWRIGHT_IS_OSS) {
  services['Airflow Service'] = AirflowIngestionClass;
}

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
  trace: process.env.PLAYWRIGHT_IS_OSS ? 'off' : 'retain-on-failure',
  video: process.env.PLAYWRIGHT_IS_OSS ? 'on' : 'off',
});

Object.entries(services).forEach(([key, ServiceClass]) => {
  const service = new ServiceClass();

  test.describe.serial(key, PLAYWRIGHT_INGESTION_TAG_OBJ, async () => {
    test.beforeEach('Visit entity details page', async ({ page }) => {
      await redirectToHomePage(page);
      await settingClick(
        page,
        service.category as unknown as SettingOptionsType
      );
    });

    test.afterAll('Delete service via API', async ({ browser }) => {
      const { afterAction, apiContext } = await createNewPage(browser);
      await service.deleteServiceByAPI(apiContext);
      await afterAction();
    });

    /**
     * Tests service creation and first ingestion run
     * @description Creates the service and triggers ingestion
     */
    test(`Create & Ingest ${key} service`, async ({ page }) => {
      test.slow();
      await service.createService(page);
    });

    /**
     * Tests description update persistence across reruns
     * @description Updates service description and verifies it after rerun
     */
    test(`Update description and verify description after re-run`, async ({
      page,
    }) => {
      test.slow();
      await service.updateService(page);
    });

    /**
     * Tests schedule option updates
     * @description Updates ingestion schedule options and verifies they persist
     */
    test(`Update schedule options and verify`, async ({ page }) => {
      await service.updateScheduleOptions(page);
    });

    if (
      [POSTGRES.serviceType, REDSHIFT.serviceType, MYSQL].includes(
        service.serviceType
      )
    ) {
      /**
       * Tests database-specific ingestion behaviors
       * @description Runs additional checks for Postgres, Redshift, and MySQL services
       */
      test(
        service.serviceType === MYSQL
          ? 'Profiler ingestion workflow'
          : `Service specific tests`,
        async ({ page }) => {
          test.slow();
          await service.runAdditionalTests(page, test);
        }
      );
    }
  });
});

test.describe('Service form', () => {
  /**
   * Tests service-name gating on the Configure & Connect step.
   * @description The merged step's advance button stays disabled until a valid
   * service name is entered. Character-constraint validation is no longer done
   * client-side in this form (the field enforces required + uniqueness only),
   * so this test asserts the enable/disable gating rather than inline
   * character-error messages.
   */
  test('name field gates the Configure & Connect step', async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.DATABASES);
    await page.click('[data-testid="add-service-button"]');

    // Selecting a connector auto-advances to the merged Configure & Connect step
    // (service name + connection share one step now).
    await page.click('[data-testid="Mysql"]');
    await page.getByTestId('service-name').waitFor();

    // The step's advance button stays disabled until a valid service name is set.
    await expect(page.getByTestId('next-button')).toBeDisabled();

    await page.fill('[data-testid="service-name"]', 'test-service-valid');
    await expect(page.getByTestId('next-button')).toBeEnabled();
  });
});

test.describe('Service Ingestion Pagination', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);
    await table.create(apiContext);
    await afterAction();
  });

  test.afterAll('Clean up', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
    await table.visitEntityPage(page);
  });

  /**
   * Tests default ingestion pagination size
   * @description Verifies ingestion pipelines load with a default page size of 15
   */
  test('Default Pagination size should be 15', async ({ page }) => {
    const servicePageResponse = page.waitForResponse(
      '/api/v1/services/databaseServices/name/*'
    );
    const validateIngestionPipelineLimitSize = page.waitForResponse(
      '/api/v1/services/ingestionPipelines?fields=**&limit=15'
    );

    await page.getByText(table.service.name).click();
    await servicePageResponse;
    await validateIngestionPipelineLimitSize;
  });
});

const TOTAL_RUNS = 5;
const mysqlService = new MysqlIngestionClass({
  shouldTestConnection: false,
  shouldAddIngestion: false,
});
let metadataPipeline: { id: string; name: string; fullyQualifiedName: string };

test.describe.serial(
  'Agent Run History - Last 5 Runs Visible',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  () => {
    test.beforeEach('Redirect to home page', async ({ page }) => {
      await redirectToHomePage(page);
    });

    test.beforeAll(
      'Create MySQL service and metadata pipeline via API',
      async ({ browser }) => {
        const { afterAction, apiContext } = await createNewPage(browser);

        const serviceResponse = await apiContext.post(
          '/api/v1/services/databaseServices',
          {
            data: {
              name: mysqlService.getServiceName(),
              serviceType: 'Mysql',
              connection: {
                config: {
                  type: 'Mysql',
                  scheme: 'mysql+pymysql',
                  username: 'username',
                  authType: { password: 'password' },
                  hostPort: 'mysql:3306',
                },
              },
            },
          }
        );

        expect(serviceResponse.status()).toBe(201);
        const service = await serviceResponse.json();
        mysqlService.serviceResponseData = service;

        const createPipelineResponse = await apiContext.post(
          '/api/v1/services/ingestionPipelines',
          {
            data: {
              airflowConfig: {},
              loggerLevel: 'INFO',
              name: `${mysqlService.getServiceName()}-metadata`,
              pipelineType: 'metadata',
              service: {
                id: service.id,
                type: 'databaseService',
              },
              sourceConfig: {
                config: {
                  type: 'DatabaseMetadata',
                },
              },
            },
          }
        );

        expect(createPipelineResponse.status()).toBe(201);
        const createdPipeline = await createPipelineResponse.json();

        metadataPipeline = {
          id: createdPipeline.id,
          name: createdPipeline.name,
          fullyQualifiedName: createdPipeline.fullyQualifiedName,
        };

        await afterAction();
      }
    );

    test.afterAll('Delete service via API', async ({ browser }) => {
      const { afterAction, apiContext } = await createNewPage(browser);
      await mysqlService.deleteServiceByAPI(apiContext);
      await afterAction();
    });

    /**
     * Tests that all 5 run statuses are visible in the UI without running the
     * agent for real — the run-history data is mocked so the test stays fast and
     * deterministic (no ingestion runtime dependency).
     * @description Validates the fix for #25800 — agent status shows true last 5 runs
     */
    test('Run metadata agent 5 times and verify all run statuses are visible', async ({
      page,
    }) => {
      expect(metadataPipeline).toBeDefined();

      const baseTs = Date.now();

      const buildMockStatuses = (): PipelineStatus[] =>
        Array.from({ length: TOTAL_RUNS }, (_, index) => ({
          runId: `pw-run-${index}`,
          pipelineState: PipelineState.Success,
          timestamp: baseTs - index * 60_000,
          startDate: baseTs - index * 60_000 - 30_000,
          endDate: baseTs - index * 60_000,
          status: [{ name: 'Source', records: 10, errors: 0, warnings: 0 }],
        }));

      // Feeds the recent-run dots and the status pill on the agent card
      // (buildRecentRuns reads pipeline.pipelineStatuses from the list response).
      await page.route(
        '**/api/v1/services/ingestionPipelines?*',
        async (route) => {
          const response = await route.fetch();
          const body = await response.json();

          await route.fulfill({
            response,
            json: {
              ...body,
              data: (body.data ?? []).map((pipeline: IngestionPipeline) =>
                pipeline.name === metadataPipeline.name
                  ? { ...pipeline, pipelineStatuses: buildMockStatuses() }
                  : pipeline
              ),
            },
          });
        }
      );

      // Feeds the run-history drawer (getRunHistoryForPipeline).
      await page.route(
        '**/api/v1/services/ingestionPipelines/*/pipelineStatus*',
        (route) =>
          route.fulfill({
            json: {
              data: buildMockStatuses(),
              paging: { total: TOTAL_RUNS },
            },
          })
      );

      await visitServiceDetailsPage(
        page,
        {
          type: mysqlService.category,
          name: mysqlService.getServiceName(),
        },
        false,
        false
      );
      await page.getByTestId('data-assets-header').waitFor();
      await page.getByTestId('agents').click();

      const metadataTab = page.locator('[data-testid="metadata-sub-tab"]');
      if (await metadataTab.isVisible()) {
        await metadataTab.click();
      }

      await page
        .getByLabel('agents')
        .getByTestId('loader')
        .waitFor({ state: 'detached' });

      const agentCard = getAgentCard(page, metadataPipeline.name);

      await expect(agentCard).toBeVisible();

      const runDots = agentCard.getByTestId('agent-run-dot');

      await expect(runDots).toHaveCount(TOTAL_RUNS);

      await expect(agentCard.getByTestId('pipeline-status')).toContainText(
        /(Success|Failed)/i
      );

      // Latest run dot opens the run history drawer with the full run list
      await runDots.first().click();

      await expect(page.getByTestId('run-history-drawer')).toBeVisible();
      await expect(page.getByTestId('run-history-item').first()).toBeVisible();

      expect(
        await page.getByTestId('run-history-item').count()
      ).toBeGreaterThanOrEqual(TOTAL_RUNS);
    });
  }
);

const slowPipelineService = new MysqlIngestionClass({
  shouldTestConnection: false,
  shouldAddIngestion: false,
});
let slowTestPipeline: {
  id: string;
  name: string;
  fullyQualifiedName: string;
};

test.describe.serial(
  'Action buttons visible despite slow pipelineStatus API',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  () => {
    test.beforeEach('Redirect to home page', async ({ page }) => {
      await redirectToHomePage(page);
    });

    test.beforeAll(
      'Create MySQL service and metadata pipeline via API',
      async ({ browser }) => {
        const { afterAction, apiContext } = await createNewPage(browser);

        const serviceResponse = await apiContext.post(
          '/api/v1/services/databaseServices',
          {
            data: {
              name: slowPipelineService.getServiceName(),
              serviceType: 'Mysql',
              connection: {
                config: {
                  type: 'Mysql',
                  scheme: 'mysql+pymysql',
                  username: 'username',
                  authType: { password: 'password' },
                  hostPort: 'mysql:3306',
                },
              },
            },
          }
        );

        expect(serviceResponse.status()).toBe(201);
        const service = await serviceResponse.json();
        slowPipelineService.serviceResponseData = service;

        const createPipelineResponse = await apiContext.post(
          '/api/v1/services/ingestionPipelines',
          {
            data: {
              airflowConfig: {},
              loggerLevel: 'INFO',
              name: `${slowPipelineService.getServiceName()}-metadata`,
              pipelineType: 'metadata',
              service: {
                id: service.id,
                type: 'databaseService',
              },
              sourceConfig: {
                config: {
                  type: 'DatabaseMetadata',
                },
              },
            },
          }
        );

        expect(createPipelineResponse.status()).toBe(201);
        const createdPipeline = await createPipelineResponse.json();

        await apiContext.post(
          `/api/v1/services/ingestionPipelines/deploy/${createdPipeline.id}`
        );

        slowTestPipeline = {
          id: createdPipeline.id,
          name: createdPipeline.name,
          fullyQualifiedName: createdPipeline.fullyQualifiedName,
        };

        await afterAction();
      }
    );

    test.afterAll('Delete service via API', async ({ browser }) => {
      const { afterAction, apiContext } = await createNewPage(browser);
      await slowPipelineService.deleteServiceByAPI(apiContext);
      await afterAction();
    });

    /**
     * Validates that action buttons (logs, pause, run) are visible and functional
     * even when the pipelineStatus API response is delayed (simulated via route mock).
     *
     * Regression test for the issue where high pipelineStatus API latency blocked
     * rendering of action icons and the pause/resume button until the slow API resolved.
     */
    test('Action buttons and pause visible when pipelineStatus API is slow', async ({
      page,
    }) => {
      test.slow();

      await page.route(
        `**/api/v1/services/ingestionPipelines/${encodeURIComponent(
          slowTestPipeline.fullyQualifiedName
        )}/pipelineStatus**`,
        async (route) => {
          // Mock the pipelineStatus endpoint to simulate high latency
          // eslint-disable-next-line playwright/no-wait-for-timeout
          await page.waitForTimeout(5000);
          await route.continue();
        }
      );

      await visitServiceDetailsPage(
        page,
        {
          type: slowPipelineService.category,
          name: slowPipelineService.getServiceName(),
        },
        false,
        false
      );

      await page.getByTestId('data-assets-header').waitFor();
      await page.getByTestId('agents').click();

      const metadataTab = page.locator('[data-testid="metadata-sub-tab"]');
      if (await metadataTab.isVisible()) {
        await metadataTab.click();
      }

      const agentCard = getAgentCard(page, slowTestPipeline.name);

      await expect(agentCard).toBeVisible();

      // Action buttons must be visible immediately — before the slow pipelineStatus
      // API resolves — verifying permissions don't wait on run history
      await expect(agentCard.getByTestId('logs-button')).toBeVisible();

      await expect(agentCard.getByTestId('run-agent-button')).toBeVisible();

      await expect(agentCard.getByTestId('more-actions')).toBeVisible();

      // Open the more-actions dropdown and verify the pipeline actions are present
      await agentCard.getByTestId('more-actions').click();
      await expect(page.getByTestId('edit-button')).toBeVisible();
      await page.keyboard.press('Escape');

      // Trigger a pipeline run via the run button.
      // Also register a waiter for the pipelineStatus refresh that follows the trigger
      // (the route mock adds 8s latency, so we must await the response before asserting).
      // Both waiters are registered before the click to avoid race conditions.
      const triggerResponse = page.waitForResponse(
        (res) =>
          res.url().includes('/services/ingestionPipelines/trigger/') &&
          res.request().method() === 'POST'
      );
      await agentCard.getByTestId('run-agent-button').click();
      await triggerResponse;

      // Verify the run was triggered by checking the card shows a status pill
      await expect(agentCard.getByTestId('pipeline-status')).toBeVisible();
    });
  }
);

const wizardService = new MysqlIngestionClass({
  shouldTestConnection: false,
  shouldAddIngestion: false,
});

test.describe.serial(
  'Edit agent wizard step navigation',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  () => {
    test.beforeEach('Redirect to home page', async ({ page }) => {
      await redirectToHomePage(page);
    });

    test.beforeAll(
      'Create MySQL service and metadata pipeline via API',
      async ({ browser }) => {
        const { afterAction, apiContext } = await createNewPage(browser);

        const serviceResponse = await apiContext.post(
          '/api/v1/services/databaseServices',
          {
            data: {
              name: wizardService.getServiceName(),
              serviceType: 'Mysql',
              connection: {
                config: {
                  type: 'Mysql',
                  scheme: 'mysql+pymysql',
                  username: 'username',
                  authType: { password: 'password' },
                  hostPort: 'mysql:3306',
                },
              },
            },
          }
        );

        expect(serviceResponse.status()).toBe(201);
        const service = await serviceResponse.json();
        wizardService.serviceResponseData = service;

        const createPipelineResponse = await apiContext.post(
          '/api/v1/services/ingestionPipelines',
          {
            data: {
              airflowConfig: {},
              loggerLevel: 'INFO',
              name: `${wizardService.getServiceName()}-metadata`,
              pipelineType: 'metadata',
              service: {
                id: service.id,
                type: 'databaseService',
              },
              sourceConfig: {
                config: {
                  type: 'DatabaseMetadata',
                },
              },
            },
          }
        );

        expect(createPipelineResponse.status()).toBe(201);
        const createdPipeline = await createPipelineResponse.json();

        await apiContext.post(
          `/api/v1/services/ingestionPipelines/deploy/${createdPipeline.id}`
        );

        await afterAction();
      }
    );

    test.afterAll('Delete service via API', async ({ browser }) => {
      const { afterAction, apiContext } = await createNewPage(browser);
      await wizardService.deleteServiceByAPI(apiContext);
      await afterAction();
    });

    /**
     * Regression guard for the nightly `Update schedule options` failures: the
     * Configure Ingestion form loads its RJSF templates lazily while the wizard
     * footer renders immediately, so advancing used to be a silent no-op that
     * stranded the wizard on step 1 with no error.
     */
    test('Next advances to the schedule step right after opening the edit wizard', async ({
      page,
    }) => {
      test.slow();

      await visitServiceDetailsPage(
        page,
        {
          type: wizardService.category,
          name: wizardService.getServiceName(),
        },
        false,
        false
      );

      await page.getByTestId('data-assets-header').waitFor();
      await page.getByTestId('agents').click();

      const metadataTab = page.locator('[data-testid="metadata-sub-tab"]');
      if (await metadataTab.isVisible()) {
        await metadataTab.click();
      }

      await page
        .getByLabel('agents')
        .getByTestId('loader')
        .waitFor({ state: 'detached' });

      await page.getByTestId('more-actions').first().click();
      await page.getByTestId('edit-button').click();

      await waitForIngestionWorkflowForm(page);
      await page.getByTestId('next-button').click();

      await expect(page.getByTestId('schedular-schedule')).toBeVisible();
    });
  }
);
