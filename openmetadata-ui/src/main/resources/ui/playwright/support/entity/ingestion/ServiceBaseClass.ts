/* eslint-disable @typescript-eslint/no-unused-vars */
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
  expect,
  Page,
  PlaywrightTestArgs,
  PlaywrightWorkerArgs,
  TestType,
} from '@playwright/test';
import { MAX_CONSECUTIVE_ERRORS } from '../../../constant/service';
import {
  descriptionBox,
  getApiContext,
  INVALID_NAMES,
  NAME_VALIDATION_ERROR,
  toastNotification,
} from '../../../utils/common';
import { visitEntityPage } from '../../../utils/entity';
import { visitServiceDetailsPage } from '../../../utils/service';
import {
  deleteService,
  getServiceCategoryFromService,
  makeRetryRequest,
  Services,
  testConnection,
} from '../../../utils/serviceIngestion';

class ServiceBaseClass {
  public category: Services;
  protected serviceName: string;
  public serviceType: string;
  protected entityName: string;
  protected shouldTestConnection: boolean;
  protected shouldAddIngestion: boolean;
  protected entityFQN: string | null;

  constructor(
    category: Services,
    name: string,
    serviceType: string,
    entity: string,
    shouldTestConnection = true,
    shouldAddIngestion = true
  ) {
    this.category = category;
    this.serviceName = name;
    this.serviceType = serviceType;
    this.entityName = entity;
    this.shouldTestConnection = shouldTestConnection;
    this.shouldAddIngestion = shouldAddIngestion;
    this.entityFQN = null;
  }

  visitService() {
    // Handle visit service here
  }

  async createService(page: Page) {
    // Handle create service here
    // intercept the service requirement md file fetch request
    await page.route('**/en-US/*/' + this.serviceType + '.md', (route) => {
      route.continue();
    });

    await page.click('[data-testid="add-service-button"]');

    // Select Service in step 1
    await this.serviceStep1(this.serviceType, page);

    const statusPromise = page.waitForRequest(
      '/api/v1/services/ingestionPipelines/status'
    );
    const ipPromise = page.waitForRequest(
      '/api/v1/services/ingestionPipelines/ip'
    );

    // Enter service name in step 2
    await this.serviceStep2(this.serviceName, page);

    await statusPromise;
    await ipPromise;

    await page.click('[data-testid="service-requirements"]');

    // await airflowStatus;
    await this.fillConnectionDetails(page);

    if (this.shouldTestConnection) {
      await testConnection(page);
    }

    await this.submitService(page);

    if (this.shouldAddIngestion) {
      await this.addIngestionPipeline(page);
    }
  }

  async serviceStep1(serviceType: string, page: Page) {
    // Storing the created service name and the type of service
    // Select Service in step 1
    await page.click(`[data-testid="${serviceType}"]`);
    await page.click('[data-testid="next-button"]');
  }

  async serviceStep2(serviceName: string, page: Page) {
    // validation should work
    await page.click('[data-testid="next-button"]');

    await page.waitForSelector('#name_help');
    const nameHelp = await page.$eval('#name_help', (el) => el.textContent);

    expect(nameHelp).toContain('Name is required');

    // invalid name validation should work
    await page
      .locator('[data-testid="service-name"]')
      .fill(INVALID_NAMES.WITH_SPECIAL_CHARS);
    const nameHelpError = await page.$eval(
      '#name_help',
      (el) => el.textContent
    );

    expect(nameHelpError).toContain(NAME_VALIDATION_ERROR);

    await page.fill('[data-testid="service-name"]', serviceName);

    await page.click('[data-testid="next-button"]');
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
    await page.click('[data-testid="add-ingestion-button"]');

    // Add ingestion page
    await page.waitForSelector('[data-testid="add-ingestion-container"]');
    await this.fillIngestionDetails(page);

    await page.click('[data-testid="submit-btn"]');

    // Go back and data should persist
    await page.click('[data-testid="back-button"]');
    await this.validateIngestionDetails(page);

    // Go Next
    await page.click('[data-testid="submit-btn"]');
    await this.scheduleIngestion(page);

    await page.click('[data-testid="view-service-button"]');

    // Header available once page loads
    await page.waitForSelector('[data-testid="data-assets-header"]');
    await page
      .getByTestId('table-container')
      .getByTestId('loader')
      .waitFor({ state: 'detached' });
    await page.getByTestId('ingestions').click();
    await page
      .getByLabel('Ingestions')
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    // need manual wait to settle down the deployed pipeline, before triggering the pipeline
    await page.waitForTimeout(3000);

    await page.getByTestId('more-actions').first().click();
    await page.getByTestId('run-button').click();

    await toastNotification(page, `Pipeline triggered successfully!`);

    // need manual wait to make sure we are awaiting on latest run results
    await page.waitForTimeout(2000);

    await this.handleIngestionRetry('metadata', page);
  }

  async submitService(page: Page) {
    await page.click('[data-testid="submit-btn"]');
    await page.waitForSelector('[data-testid="success-line"]', {
      state: 'visible',
    });

    await expect(page.getByTestId('success-line')).toContainText(
      'has been created successfully'
    );
  }

  async scheduleIngestion(page: Page) {
    await page.click('[data-testid="cron-type"]');
    await page.click('.ant-select-item-option-content:has-text("Custom")');
    // Check validation error thrown for a cron that is too frequent
    // i.e. having interval less than 1 hour
    await page.locator('#schedular-form_cron').fill('* * * 2 6');
    await page.click('[data-testid="deploy-button"]');

    await expect(
      page.getByText(
        'Cron schedule too frequent. Please choose at least 1-hour intervals.'
      )
    ).toBeAttached();

    // Check validation error thrown for a cron that is invalid
    await page.locator('#schedular-form_cron').clear();
    await page.click('[data-testid="deploy-button"]');
    await page.locator('#schedular-form_cron').fill('* * * 2 ');

    await expect(
      page.getByText(
        'Error: Expression has only 4 parts. At least 5 parts are required.'
      )
    ).toBeAttached();

    await page.locator('#schedular-form_cron').clear();

    await page.waitForSelector('[data-testid="schedular-card-container"]');
    await page
      .getByTestId('schedular-card-container')
      .getByText('On Demand')
      .click();

    await expect(page.locator('[data-testid="cron-type"]')).not.toBeVisible();

    const deployPipelinePromise = page.waitForRequest(
      `/api/v1/services/ingestionPipelines/deploy/**`
    );

    await page.click('[data-testid="deploy-button"]');

    await deployPipelinePromise;

    await expect(page.getByTestId('success-line')).toContainText(
      'has been created and deployed successfully'
    );
  }

  handleIngestionRetry = async (ingestionType = 'metadata', page: Page) => {
    const { apiContext } = await getApiContext(page);

    // Need to wait before start polling as Ingestion is taking time to reflect state on their db
    // Queued status are not stored in DB. cc: @ulixius9
    await page.waitForTimeout(2000);

    const response = await apiContext
      .get(
        `/api/v1/services/ingestionPipelines?fields=pipelineStatuses&service=${
          this.serviceName
        }&pipelineType=${ingestionType}&serviceType=${getServiceCategoryFromService(
          this.category
        )}`
      )
      .then((res) => res.json());

    const workflowData = response.data.filter(
      (d: { pipelineType: string }) => d.pipelineType === ingestionType
    )[0];

    const oneHourBefore = Date.now() - 86400000;
    let consecutiveErrors = 0;

    await expect
      .poll(
        async () => {
          try {
            const response = await makeRetryRequest({
              url: `/api/v1/services/ingestionPipelines/${encodeURIComponent(
                workflowData.fullyQualifiedName
              )}/pipelineStatus?startTs=${oneHourBefore}&endTs=${Date.now()}`,
              page,
            });
            consecutiveErrors = 0; // Reset error counter on success

            return response.data[0]?.pipelineState;
          } catch (error) {
            consecutiveErrors++;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              throw new Error(
                `Failed to get pipeline status after ${MAX_CONSECUTIVE_ERRORS} consecutive attempts`
              );
            }

            return 'running';
          }
        },
        {
          // Custom expect message for reporting, optional.
          message: 'Wait for pipeline to be successful',
          timeout: 750_000,
          intervals: [30_000, 15_000, 5_000],
        }
      )
      // Move ahead if we do not have running or queued status
      .toEqual(expect.stringMatching(/(success|failed|partialSuccess)/));

    const pipelinePromise = page.waitForRequest(
      `/api/v1/services/ingestionPipelines?**`
    );
    const statusPromise = page.waitForRequest(
      `/api/v1/services/ingestionPipelines/**/pipelineStatus?**`
    );

    await page.reload();

    await page.waitForSelector('[data-testid="data-assets-header"]');

    await pipelinePromise;
    await statusPromise;

    await page.waitForSelector('[data-testid="ingestions"]');
    await page.click('[data-testid="ingestions"]');
    await page.waitForSelector(`td:has-text("${ingestionType}")`);

    await expect(
      page
        .locator(`[data-row-key*="${workflowData.name}"]`)
        .getByTestId('pipeline-status')
        .last()
    ).toContainText('SUCCESS');
  };

  async updateService(page: Page) {
    await this.updateDescriptionForIngestedTables(page);
  }

  async updateScheduleOptions(page: Page) {
    await visitServiceDetailsPage(
      page,
      { type: this.category, name: this.serviceName },
      false
    );

    await page.click('[data-testid="ingestions"]');

    // click and edit pipeline schedule for Hours

    await page.getByTestId('more-actions').first().click();
    await page.click('[data-testid="edit-button"]');
    await page.click('[data-testid="submit-btn"]');

    // select schedule
    await page.waitForSelector('[data-testid="schedular-card-container"]');
    await page
      .getByTestId('schedular-card-container')
      .getByText('Schedule', { exact: true })
      .click();
    await page.click('[data-testid="cron-type"]');
    await page
      .locator('.ant-select-item-option-content', { hasText: 'Hour' })
      .click();
    await page.getByTestId('minute-options').click();
    await page
      .locator('#minute-select_list + .rc-virtual-list [title="05"]')
      .click();

    // Deploy with schedule
    await page.click('[data-testid="deploy-button"]');
    await page.click('[data-testid="view-service-button"]');

    await expect(page.getByTestId('schedule-primary-details')).toHaveText(
      'At 5 minutes past the hour'
    );
    await expect(page.getByTestId('schedule-secondary-details')).toHaveText(
      'Every hour, every day'
    );

    // click and edit pipeline schedule for Day
    await page.getByTestId('more-actions').first().click();
    await page.click('[data-testid="edit-button"]');
    await page.click('[data-testid="submit-btn"]');
    await page.click('[data-testid="cron-type"]');
    await page.click('.ant-select-item-option-content:has-text("Day")');

    await page.click('[data-testid="hour-options"]');
    await page.click('#hour-select_list + .rc-virtual-list [title="04"]');

    await page.click('[data-testid="minute-options"]');
    await page.click('#minute-select_list + .rc-virtual-list [title="04"]');

    // Deploy with schedule
    await page.click('[data-testid="deploy-button"]');

    const getIngestionPipelines = page.waitForRequest(
      `/api/v1/services/ingestionPipelines?**`
    );

    await page.click('[data-testid="view-service-button"]');

    await getIngestionPipelines;

    await expect(page.getByTestId('schedule-primary-details')).toHaveText(
      'At 04:04 AM'
    );
    await expect(page.getByTestId('schedule-secondary-details')).toHaveText(
      'Every day'
    );

    // click and edit pipeline schedule for Week
    await page.getByTestId('more-actions').first().click();
    await page.click('[data-testid="edit-button"]');
    await page.click('[data-testid="submit-btn"]');
    await page.click('[data-testid="cron-type"]');
    await page.click('.ant-select-item-option-content:has-text("Week")');
    await page
      .locator('#schedular-form_dow .week-selector-buttons')
      .getByText('W')
      .click();
    await page.click('[data-testid="hour-options"]');
    await page.click('#hour-select_list + .rc-virtual-list [title="05"]');
    await page.click('[data-testid="minute-options"]');
    await page.click('#minute-select_list + .rc-virtual-list [title="05"]');

    // Deploy with schedule
    await page.click('[data-testid="deploy-button"]');
    await page.click('[data-testid="view-service-button"]');

    await expect(page.getByTestId('schedule-primary-details')).toHaveText(
      'At 05:05 AM'
    );
    await expect(page.getByTestId('schedule-secondary-details')).toHaveText(
      'Only on wednesday'
    );

    // click and edit pipeline schedule for Custom
    await page.getByTestId('more-actions').first().click();
    await page.click('[data-testid="edit-button"]');
    await page.click('[data-testid="submit-btn"]');
    await page.click('[data-testid="cron-type"]');
    await page.click('.ant-select-item-option-content:has-text("Custom")');

    // Schedule & Deploy
    await page.locator('#schedular-form_cron').fill('0 * * 2 6');

    await page.click('[data-testid="deploy-button"]');
    await page.click('[data-testid="view-service-button"]');

    await expect(page.getByTestId('schedule-primary-details')).toHaveText(
      'Every hour'
    );
    await expect(page.getByTestId('schedule-secondary-details')).toHaveText(
      'Only on saturday, only in february'
    );
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
    await page.click(descriptionBox);
    await page.fill(descriptionBox, '');
    await page.fill(descriptionBox, description);

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

    const ingestionResponse = page.waitForResponse(
      `/api/v1/services/ingestionPipelines/*/pipelineStatus?**`
    );
    await page.click('[data-testid="ingestions"]');

    await ingestionResponse;
    await page
      .getByRole('cell', { name: 'Pause Logs' })
      .waitFor({ state: 'visible' });

    // need manual wait to settle down the deployed pipeline, before triggering the pipeline
    await page.waitForTimeout(3000);

    await page.getByTestId('more-actions').first().click();
    await page.getByTestId('run-button').click();

    await toastNotification(page, `Pipeline triggered successfully!`);

    // need manual wait to make sure we are awaiting on latest run results
    await page.waitForTimeout(2000);

    // Wait for success
    await this.handleIngestionRetry('metadata', page);

    // Navigate to table name
    await visitEntityPage({
      page,
      searchTerm: this.entityFQN ?? this.entityName,
      dataTestId: entityDataTestId ?? `${this.serviceName}-${this.entityName}`,
    });

    await page.getByTestId('data-assets-header').waitFor({ state: 'visible' });

    await expect(page.getByTestId('entity-right-panel')).toBeVisible();

    await expect(page.getByTestId('markdown-parser').first()).toHaveText(
      description
    );
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
}

export default ServiceBaseClass;
