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
import {
  APIRequestContext,
  expect,
  Page,
  PlaywrightTestArgs,
  PlaywrightWorkerArgs,
  TestType,
} from '@playwright/test';
import { startCase } from 'lodash';
import { okJson } from '../../../utils/apiResponse';
import { descriptionBox, getApiContext } from '../../../utils/common';
import {
  visitEntityPage,
  waitForAllLoadersToDisappear,
} from '../../../utils/entity';
import { waitForIngestionResult } from '../../../utils/ingestionExecution';
import {
  selectOnDemandSchedule,
  selectScheduleDayOfWeek,
  selectScheduleFrequency,
  selectScheduleMinute,
  selectScheduleType,
  setCustomCron,
  setScheduleTime,
} from '../../../utils/scheduleInterval';
import { visitServiceDetailsPage } from '../../../utils/service';
import {
  advanceToServiceConnectionStep,
  deleteService,
  getAgentCard,
  getServiceCategoryFromService,
  selectServiceConnector,
  Services,
  testConnection,
  waitForIngestionWorkflowForm,
  waitForServiceConnectionForm,
} from '../../../utils/serviceIngestion';
import { ResponseDataType } from '../Entity.interface';

interface RunnerDetails {
  name: string;
  // The react-aria runner Select matches options by their visible label, so a
  // display name is required — the system `name` (e.g. `CollateSaaS`) is not
  // rendered and would not match.
  displayName: string;
}
class ServiceBaseClass {
  public category: Services;
  protected serviceName: string;
  public serviceType: string;
  protected entityName: string;
  protected shouldTestConnection: boolean;
  protected shouldAddIngestion: boolean;
  public shouldAddDefaultFilters: boolean;
  protected entityFQN: string | null;
  public serviceResponseData: ResponseDataType = {} as ResponseDataType;
  public ingestionRunner: RunnerDetails = {
    name: 'CollateSaaS',
    displayName: 'Collate SaaS Runner',
  };

  constructor(
    category: Services,
    name: string,
    serviceType: string,
    entity: string,
    shouldTestConnection = true,
    shouldAddIngestion = true,
    shouldAddDefaultFilters = false,
    ingestionRunner?: RunnerDetails
  ) {
    this.category = category;
    this.serviceName = name;
    this.serviceType = serviceType;
    this.entityName = entity;
    this.shouldTestConnection = shouldTestConnection;
    this.shouldAddIngestion = shouldAddIngestion;
    this.shouldAddDefaultFilters = shouldAddDefaultFilters;
    this.entityFQN = null;
    this.ingestionRunner = ingestionRunner ?? this.ingestionRunner;
  }

  getServiceName() {
    return this.serviceName;
  }

  visitService() {
    // Handle visit service here
  }

  async createService(page: Page) {
    await page.click('[data-testid="add-service-button"]');

    // Select Service in step 1
    await this.serviceStep1(this.serviceType, page);
    await waitForAllLoadersToDisappear(page);

    // Enter service name in step 2
    await this.serviceStep2(this.serviceName, page);

    await advanceToServiceConnectionStep(page);
    await waitForServiceConnectionForm(page);

    await page.click('[data-testid="service-requirements"]');
    await this.fillConnectionDetails(page);

    const runnerSelector = page.getByTestId(
      'select-widget-root/ingestionRunner'
    );

    if (await runnerSelector.isVisible()) {
      const runnerLabel = this.ingestionRunner.displayName;
      const trigger = runnerSelector.getByRole('button');
      const option = page
        .locator('.core-select-widget-popover')
        .getByRole('option', { name: runnerLabel, exact: true });

      await trigger.scrollIntoViewIfNeeded();
      await trigger.focus();
      await trigger.click();
      await expect(option).toBeVisible();
      await option.click();
      await expect(trigger).toContainText(runnerLabel);
    }

    if (this.shouldTestConnection) {
      await testConnection(page);
    }

    this.serviceResponseData = await this.submitService(page);

    if (this.shouldAddIngestion) {
      await this.addIngestionPipeline(page);
    }
  }

  async serviceStep1(serviceType: string, page: Page) {
    await selectServiceConnector(page, serviceType);
  }

  async serviceStep2(serviceName: string, page: Page) {
    // Service name + connection details now share the Configure & Connect step;
    // the connection form's submit button advances to the next step.
    const encodedServiceName = encodeURIComponent(serviceName);
    const serviceNameValidationResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().includes(`/name/${encodedServiceName}`)
    );

    await page.fill('#service-name', serviceName);

    const response = await serviceNameValidationResponse;

    expect(
      response.status(),
      `Expected "${serviceName}" to be available, but service-name validation returned ${response.status()}`
    ).toBe(404);
  }

  async fillConnectionDetails(_page: Page) {
    // Handle fill connection details in respective service here
  }

  async fillIngestionDetails(_page: Page) {
    // Handle fill ingestion details in respective service here
  }

  async validateIngestionDetails(_page: Page) {
    // Handle validate ingestion details in respective service here
  }

  async addIngestionPipeline(page: Page) {
    await page.click('[role="tab"] [data-testid="agents"]');

    const metadataTab = page.locator('[data-testid="metadata-sub-tab"]');
    if (await metadataTab.isVisible()) {
      await metadataTab.click();
    }

    await page.getByTestId('add-new-ingestion-button').waitFor();

    await page.click('[data-testid="add-new-ingestion-button"]');

    await page
      .locator('.ant-dropdown:visible [data-menu-id*="metadata"]')
      .waitFor();

    await page.click('.ant-dropdown:visible [data-menu-id*="metadata"]');

    // Add ingestion page
    await waitForIngestionWorkflowForm(page);
    await this.fillIngestionDetails(page);

    // Creating the service triggers AutoPilot, whose success toast renders
    // bottom-center — directly over the wizard footer — and auto-closes after 5s
    // (showSuccessToast(..., 5000) in AddServicePage). A click landing inside
    // that window is intercepted by the toast, and with no per-action timeout
    // the retry loop runs to the end of the test instead.
    //
    // Bounding the click is what fixes it, not waiting the toast out: the toast
    // is fired by the create call several steps earlier, so whether it is on
    // screen when we get here depends on how fast those steps ran. Gating on it
    // being gone is a no-op when it has not rendered yet and when it has already
    // closed. A bounded click covers every ordering — Playwright retries the
    // intercepted click for the whole timeout, which outlasts the toast.
    await page.click('[data-testid="next-button"]', { timeout: 30_000 });

    // Go back and data should persist
    await page.click('[data-testid="previous-button"]');
    await waitForIngestionWorkflowForm(page);
    await this.validateIngestionDetails(page);

    // Go Next
    await page.click('[data-testid="next-button"]');
    await this.scheduleIngestion(page);

    await page.click('[data-testid="view-service-button"]');

    // Header available once page loads
    await page.getByTestId('data-assets-header').waitFor();
    await page
      .getByTestId('table-container')
      .getByTestId('loader')
      .waitFor({ state: 'detached' });
    await page.getByTestId('agents').click();
    const metadataTab2 = page.locator('[data-testid="metadata-sub-tab"]');
    if (await metadataTab2.isVisible()) {
      await metadataTab2.click();
    }
    await page
      .getByLabel('agents')
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    const triggerPipeline = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes('/api/v1/services/ingestionPipelines/trigger/') &&
        response.request().method() === 'POST'
    );
    const startedAfter = Date.now();
    await page.getByTestId('run-agent-button').first().click();

    expect((await triggerPipeline).status(), 'trigger ingestion').toBe(200);

    await this.waitForIngestion(page, startedAfter);
  }

  async submitService(page: Page) {
    await page.getByTestId('next-button').getByText('Next').click();

    if (this.shouldAddDefaultFilters) {
      await this.fillIngestionDetails(page);
    }

    const autoPilotApplicationRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/v1/apps/trigger/AutoPilotApplication') &&
        request.method() === 'POST'
    );

    const saveServiceResponse = page.waitForRequest(
      (request) =>
        request.url().includes('/api/v1/services/') &&
        request.method() === 'POST'
    );

    await page.getByRole('button', { name: 'Create & Deploy' }).click();

    const savedService = (await saveServiceResponse).response();

    const serviceDetails = await (await savedService)?.json();

    await autoPilotApplicationRequest;

    return serviceDetails;
  }

  async scheduleIngestion(page: Page) {
    await selectScheduleFrequency(page, 'custom');
    // Check validation error thrown for a cron that is too frequent
    // i.e. having interval less than 1 hour
    await setCustomCron(page, '* * * 2 6');
    await page.click('[data-testid="next-button"]');

    await expect(
      page.getByText(
        'Cron schedule too frequent. Please choose at least 1-hour intervals.'
      )
    ).toBeAttached();

    // Check validation error thrown for a cron that is invalid
    await setCustomCron(page, '* * * 2 ');

    await expect(
      page.getByText(
        'Cron expression must have exactly 5 fields (minute hour day-of-month month day-of-week)'
      )
    ).toBeAttached();

    await selectOnDemandSchedule(page);

    await expect(page.getByLabel('Raise on Error')).toBeChecked();
    await page.getByTestId('raise-on-error').click();

    await expect(page.getByLabel('Raise on Error')).not.toBeChecked();

    const deployPipelinePromise = page.waitForRequest(
      `/api/v1/services/ingestionPipelines/deploy/**`
    );

    await page.click('[data-testid="next-button"]');

    await deployPipelinePromise;

    await expect(page.getByTestId('success-line')).toContainText(
      'has been created and deployed successfully'
    );
  }

  waitForIngestion = async (
    page: Page,
    startedAfter: number,
    ingestionType = 'metadata'
  ) => {
    const { apiContext } = await getApiContext(page);
    const response = await apiContext.get(
      '/api/v1/services/ingestionPipelines',
      {
        params: {
          service: this.serviceName,
          pipelineType: ingestionType,
          serviceType: getServiceCategoryFromService(this.category),
        },
      }
    );
    const body = await okJson<{
      data: Array<{
        fullyQualifiedName: string;
        name: string;
        pipelineType: string;
      }>;
    }>(response, 'Find ingestion pipeline');
    const workflows = body.data.filter(
      (pipeline) => pipeline.pipelineType === ingestionType
    );
    expect(
      workflows,
      'exactly one pipeline must match the triggered ingestion'
    ).toHaveLength(1);
    const workflow = workflows[0];
    await waitForIngestionResult(
      apiContext,
      workflow.fullyQualifiedName,
      startedAfter
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('data-assets-header')).toBeVisible();
    await page.getByTestId('agents').click();
    const metadataTab = page.getByTestId('metadata-sub-tab');
    if (await metadataTab.isVisible()) {
      await metadataTab.click();
    }
    const card = getAgentCard(page, workflow.name);
    await expect(card.getByTestId('pipeline-type')).toContainText(
      startCase(ingestionType),
      { ignoreCase: true }
    );
    await expect(card.getByTestId('pipeline-status')).toHaveText('Success');
  };

  async updateService(page: Page) {
    await this.updateDescriptionForIngestedTables(page);
  }

  async openAgentScheduleStep(page: Page) {
    await page.getByTestId('more-actions').first().click();
    await page.click('[data-testid="edit-button"]');
    await waitForIngestionWorkflowForm(page);
    await page.click('[data-testid="next-button"]');
  }

  async updateScheduleOptions(page: Page) {
    await visitServiceDetailsPage(
      page,
      { type: this.category, name: this.serviceName },
      false
    );

    await page.click('[data-testid="agents"]');
    const metadataTab2 = page.locator('[data-testid="metadata-sub-tab"]');
    if (await metadataTab2.isVisible()) {
      await metadataTab2.click();
    }

    // click and edit pipeline schedule for Hours
    await this.openAgentScheduleStep(page);

    // select schedule
    await selectScheduleType(page);
    await selectScheduleFrequency(page, 'hour');
    await selectScheduleMinute(page, '05');

    // Deploy with schedule
    await page.click('[data-testid="next-button"]');
    await page.click('[data-testid="view-service-button"]');

    await expect(page.getByTestId('agent-schedule')).toContainText(
      'At 5 minutes past the hour'
    );
    await expect(page.getByTestId('agent-schedule')).toContainText(
      'Every hour, every day'
    );

    // click and edit pipeline schedule for Day
    await this.openAgentScheduleStep(page);
    await selectScheduleFrequency(page, 'day');
    await setScheduleTime(page, { hour: '04', minute: '04', period: 'AM' });

    // Deploy with schedule
    await page.click('[data-testid="next-button"]');

    const getIngestionPipelines = page.waitForRequest(
      `/api/v1/services/ingestionPipelines?**`
    );

    await page.click('[data-testid="view-service-button"]');

    await getIngestionPipelines;

    await expect(page.getByTestId('agent-schedule')).toContainText(
      'At 04:04 AM'
    );
    await expect(page.getByTestId('agent-schedule')).toContainText('Every day');

    // click and edit pipeline schedule for Week
    await this.openAgentScheduleStep(page);
    await selectScheduleFrequency(page, 'week');
    await selectScheduleDayOfWeek(page, 'Wednesday');
    await setScheduleTime(page, { hour: '05', minute: '05', period: 'AM' });

    // Deploy with schedule
    await page.click('[data-testid="next-button"]');
    await page.click('[data-testid="view-service-button"]');

    await expect(page.getByTestId('agent-schedule')).toContainText(
      'At 05:05 AM'
    );
    await expect(page.getByTestId('agent-schedule')).toContainText(
      'Only on wednesday'
    );

    // click and edit pipeline schedule for Custom
    await this.openAgentScheduleStep(page);
    await selectScheduleFrequency(page, 'custom');

    // Schedule & Deploy
    await setCustomCron(page, '0 * * 2 6');

    await page.click('[data-testid="next-button"]');
    await page.click('[data-testid="view-service-button"]');

    await expect(page.getByTestId('agent-schedule')).toContainText(
      'Every hour'
    );
    await expect(page.getByTestId('agent-schedule')).toContainText(
      'Only on saturday, only in february'
    );
  }

  async openIngestionFilterSection(page: Page) {
    await waitForAllLoadersToDisappear(page);
    const ingestionFilterSection = page.getByTestId(
      'ingestion-section-filters'
    );
    if (await ingestionFilterSection.isVisible()) {
      await ingestionFilterSection.click();
    }
  }

  async updateDescriptionForIngestedTables(
    page: Page,
    entityDataTestId?: string
  ) {
    const description = `${this.entityName} description`;

    // Navigate to ingested table
    await visitEntityPage({
      page,
      searchTerm: this.entityFQN ?? this.entityName,
      dataTestId: entityDataTestId ?? `${this.serviceName}-${this.entityName}`,
    });

    // update description
    await page.click('[data-testid="edit-description"]');
    await page
      .locator(`.description-markdown-editor:visible ${descriptionBox}`)
      .waitFor({
        state: 'visible',
      });
    await page.click(`.description-markdown-editor:visible ${descriptionBox}`);
    await page.fill(
      `.description-markdown-editor:visible ${descriptionBox}`,
      ''
    );
    await page.fill(
      `.description-markdown-editor:visible ${descriptionBox}`,
      description
    );

    await page.click('[data-testid="save"]');

    // re-run ingestion flow
    // Services page
    await visitServiceDetailsPage(
      page,
      {
        name: this.serviceName,
        type: this.category,
      },
      false
    );

    await page
      .getByTestId('table-container')
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    await page.click('[data-testid="agents"]');
    const metadataTab2 = page.locator('[data-testid="metadata-sub-tab"]');
    if (await metadataTab2.isVisible()) {
      await metadataTab2.click();
    }

    await page
      .getByLabel('agents')
      .getByTestId('loader')
      .waitFor({ state: 'detached' });
    await page.getByTestId('logs-button').first().waitFor({ state: 'visible' });

    const triggerPipeline = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes('/api/v1/services/ingestionPipelines/trigger/') &&
        response.request().method() === 'POST'
    );

    const startedAfter = Date.now();
    await page.getByTestId('run-agent-button').first().click();
    expect((await triggerPipeline).status(), 'trigger ingestion').toBe(200);

    // Wait for success
    await this.waitForIngestion(page, startedAfter);

    // Navigate to table name
    await visitEntityPage({
      page,
      searchTerm: this.entityFQN ?? this.entityName,
      dataTestId: entityDataTestId ?? `${this.serviceName}-${this.entityName}`,
    });

    await page.getByTestId('data-assets-header').waitFor({ state: 'visible' });

    await expect(page.getByTestId('markdown-parser').first()).toHaveText(
      description
    );

    // Check for right side widgets visibility
    await expect(page.getByTestId('KnowledgePanel.Tags')).toBeVisible();
    await expect(
      page.getByTestId('KnowledgePanel.GlossaryTerms')
    ).toBeVisible();
    await expect(page.getByTestId('KnowledgePanel.DataProducts')).toBeVisible();
  }

  async runAdditionalTests(
    _page: Page,
    _test: TestType<PlaywrightTestArgs, PlaywrightWorkerArgs>
  ) {
    // Write service specific tests
  }

  async deleteService(page: Page) {
    await deleteService(this.category, this.serviceName, page);
  }

  async deleteServiceByAPI(apiContext: APIRequestContext) {
    if (this.serviceResponseData.fullyQualifiedName) {
      const response = await deleteFixtureEntity(
        apiContext,
        `/api/v1/services/${getServiceCategoryFromService(
          this.category
        )}s/name/${encodeURIComponent(
          this.serviceResponseData.fullyQualifiedName
        )}?recursive=true&hardDelete=true`
      );

      expect(
        [200, 404],
        `delete ingestion service: ${await response.text()}`
      ).toContain(response.status());
    }
  }
}

export default ServiceBaseClass;

import { deleteFixtureEntity } from '../../../utils/apiResponse';
