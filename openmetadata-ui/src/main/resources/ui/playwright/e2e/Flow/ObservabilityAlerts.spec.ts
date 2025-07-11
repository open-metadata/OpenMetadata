/*
 *  Copyright 2022 Collate.
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

import { Page, test as base } from '@playwright/test';
import {
  INGESTION_PIPELINE_NAME,
  TEST_CASE_NAME,
  TEST_SUITE_NAME,
} from '../../constant/alert';
import { Domain } from '../../support/domain/Domain';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { TableClass } from '../../support/entity/TableClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  commonPrerequisites,
  createAlert,
  deleteAlert,
  generateAlertName,
  inputBasicAlertInformation,
  saveAlertAndVerifyResponse,
  verifyAlertDetails,
  visitAlertDetailsPage,
} from '../../utils/alert';
import { getApiContext } from '../../utils/common';
import {
  addExternalDestination,
  checkAlertDetailsForWithPermissionUser,
  checkAlertFlowForWithoutPermissionUser,
  createCommonObservabilityAlert,
  editObservabilityAlert,
  getObservabilityCreationDetails,
  visitObservabilityAlertPage,
} from '../../utils/observabilityAlert';

const table1 = new TableClass();
const table2 = new TableClass();
const pipeline = new PipelineClass();
const user1 = new UserClass();
const user2 = new UserClass();
const admin = new AdminClass();
const domain = new Domain();

const SOURCE_NAME_1 = 'container';
const SOURCE_DISPLAY_NAME_1 = 'Container';
const SOURCE_NAME_2 = 'pipeline';
const SOURCE_DISPLAY_NAME_2 = 'Pipeline';
const SOURCE_NAME_3 = 'table';
const SOURCE_DISPLAY_NAME_3 = 'Table';

// Create 2 page and authenticate 1 with admin and another with normal user
const test = base.extend<{
  page: Page;
  userWithPermissionsPage: Page;
  userWithoutPermissionsPage: Page;
}>({
  page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await admin.login(page);
    await use(page);
    await page.close();
  },
  userWithPermissionsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user1.login(page);
    await use(page);
    await page.close();
  },
  userWithoutPermissionsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user2.login(page);
    await use(page);
    await page.close();
  },
});

const data = {
  alertDetails: {
    id: '',
    name: '',
    displayName: '',
    description: '',
    filteringRules: { resources: [] },
    input: { filters: [], actions: [] },
    destinations: [],
  },
};

test.beforeAll(async ({ browser }) => {
  test.slow();

  const { afterAction, apiContext } = await performAdminLogin(browser);
  await commonPrerequisites({
    apiContext,
    table: table2,
    user1,
    user2,
    domain,
  });

  await table1.create(apiContext);
  await table1.createTestSuiteAndPipelines(apiContext, {
    name: TEST_SUITE_NAME,
  });
  await table1.createTestCase(apiContext, { name: TEST_CASE_NAME });
  await pipeline.create(apiContext);
  await pipeline.createIngestionPipeline(apiContext, INGESTION_PIPELINE_NAME);

  await afterAction();
});

test.beforeEach(async ({ page }) => {
  test.slow();

  await visitObservabilityAlertPage(page);
});

test('Pipeline Alert', async ({ page }) => {
  test.slow();

  const ALERT_NAME = generateAlertName();

  await test.step('Create alert', async () => {
    data.alertDetails = await createAlert({
      page,
      alertName: ALERT_NAME,
      sourceName: SOURCE_NAME_1,
      sourceDisplayName: SOURCE_DISPLAY_NAME_1,
      user: user1,
      createButtonId: 'create-observability',
      selectId: 'Owner Name',
      addTrigger: true,
    });
  });

  await test.step('Verify diagnostic info tab', async () => {
    await visitObservabilityAlertPage(page);
    await visitAlertDetailsPage(page, data.alertDetails);

    const diagnosticTab = page.getByRole('tab', { name: /diagnostic info/i });
    const diagnosticInfoResponse = page.waitForResponse(
      `/api/v1/events/subscriptions/**/diagnosticInfo`
    );
    await diagnosticTab.click();
    await diagnosticInfoResponse;
  });

  await test.step('Check created alert details', async () => {
    await visitObservabilityAlertPage(page);
    await visitAlertDetailsPage(page, data.alertDetails);

    // Verify alert details
    await verifyAlertDetails({ page, alertDetails: data.alertDetails });
  });

  await test.step('Edit alert', async () => {
    await editObservabilityAlert({
      page,
      alertDetails: data.alertDetails,
      sourceName: SOURCE_NAME_2,
      sourceDisplayName: SOURCE_DISPLAY_NAME_2,
      user: user1,
      domain,
      pipeline,
    });

    // Click save
    const updateAlert = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/events/subscriptions') &&
        response.request().method() === 'PATCH' &&
        response.status() === 200
    );
    await page.click('[data-testid="save-button"]');
    await updateAlert.then(async (response) => {
      data.alertDetails = await response.json();

      test.expect(response.status()).toEqual(200);

      // Verify the edited alert changes
      await verifyAlertDetails({ page, alertDetails: data.alertDetails });
    });
  });

  await test.step('Delete alert', async () => {
    await deleteAlert(page, data.alertDetails, false);
  });
});

const OBSERVABILITY_CREATION_DETAILS = getObservabilityCreationDetails({
  tableName1: table1.entity.name,
  tableName2: table2.entity.name,
  testSuiteFQN: TEST_SUITE_NAME,
  testCaseName: TEST_CASE_NAME,
  ingestionPipelineName: INGESTION_PIPELINE_NAME,
  domainName: domain.data.name,
  domainDisplayName: domain.data.displayName,
  userName: `${user1.data.firstName}${user1.data.lastName}`,
});

for (const alertDetails of OBSERVABILITY_CREATION_DETAILS) {
  const { source, sourceDisplayName, filters, actions } = alertDetails;

  test(`${sourceDisplayName} alert`, async ({ page }) => {
    const ALERT_NAME = generateAlertName();

    test.slow(true);

    await test.step('Create alert', async () => {
      await createCommonObservabilityAlert({
        page,
        alertName: ALERT_NAME,
        sourceName: source,
        sourceDisplayName: sourceDisplayName,
        alertDetails,
        filters: filters,
        actions: actions,
      });

      // Click save
      data.alertDetails = await saveAlertAndVerifyResponse(page);
    });

    await test.step('Check created alert details', async () => {
      await visitObservabilityAlertPage(page);
      await visitAlertDetailsPage(page, data.alertDetails);

      // Verify alert details
      await verifyAlertDetails({ page, alertDetails: data.alertDetails });
    });

    await test.step('Delete alert', async () => {
      await deleteAlert(page, data.alertDetails, false);
    });
  });
}

test('Alert operations for a user with and without permissions', async ({
  page,
  userWithPermissionsPage,
  userWithoutPermissionsPage,
}) => {
  test.slow();

  const ALERT_NAME = generateAlertName();
  const { apiContext } = await getApiContext(page);
  await visitObservabilityAlertPage(userWithPermissionsPage);

  await test.step('Create and trigger alert', async () => {
    await inputBasicAlertInformation({
      page: userWithPermissionsPage,
      name: ALERT_NAME,
      sourceName: SOURCE_NAME_3,
      sourceDisplayName: SOURCE_DISPLAY_NAME_3,
      createButtonId: 'create-observability',
    });
    await userWithPermissionsPage.click('[data-testid="add-filters"]');

    // Select filter
    await userWithPermissionsPage.click('[data-testid="filter-select-0"]');
    await userWithPermissionsPage.click(
      '.ant-select-dropdown:visible [data-testid="Table Name-filter-option"]'
    );

    // Search and select filter input value
    const searchOptions = userWithPermissionsPage.waitForResponse(
      '/api/v1/search/query?q=*'
    );
    await userWithPermissionsPage.fill(
      `[data-testid="fqn-list-select"] [role="combobox"]`,
      table1.entity.name,
      {
        force: true,
      }
    );

    await searchOptions;

    await userWithPermissionsPage.click(
      `.ant-select-dropdown:visible [title="${table1.entity.name}"]`
    );

    // Check if option is selected
    await test
      .expect(
        userWithPermissionsPage.locator(
          `[data-testid="fqn-list-select"] [title="${table1.entity.name}"]`
        )
      )
      .toBeAttached();

    await userWithPermissionsPage.click('[data-testid="add-trigger"]');

    // Select action
    await userWithPermissionsPage.click('[data-testid="trigger-select-0"]');

    // Adding the dropdown visibility check to avoid flakiness here
    await userWithPermissionsPage.waitForSelector(
      `.ant-select-dropdown:visible`,
      {
        state: 'visible',
      }
    );
    await userWithPermissionsPage.click(
      '.ant-select-dropdown:visible [data-testid="Get Schema Changes-filter-option"]:visible'
    );
    await userWithPermissionsPage.waitForSelector(
      `.ant-select-dropdown:visible`,
      {
        state: 'hidden',
      }
    );

    await userWithPermissionsPage.click(
      '[data-testid="add-destination-button"]'
    );
    await addExternalDestination({
      page: userWithPermissionsPage,
      destinationNumber: 0,
      category: 'Slack',
      input: 'https://slack.com',
    });

    // Click save
    data.alertDetails = await saveAlertAndVerifyResponse(
      userWithPermissionsPage
    );

    // Trigger alert
    await table1.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/columns/4',
          value: {
            name: 'new_field',
            dataType: 'VARCHAR',
            dataLength: 100,
            dataTypeDisplay: 'varchar(100)',
          },
        },
      ],
    });
  });

  await test.step('Checks for user without permission', async () => {
    await checkAlertFlowForWithoutPermissionUser({
      page: userWithoutPermissionsPage,
      alertDetails: data.alertDetails,
      sourceName: SOURCE_NAME_3,
      table: table1,
    });
  });

  await test.step(
    'Check alert details page and Recent Events tab',
    async () => {
      await checkAlertDetailsForWithPermissionUser({
        page: userWithPermissionsPage,
        alertDetails: data.alertDetails,
        sourceName: SOURCE_NAME_3,
        table: table1,
        user: user2,
      });
    }
  );

  await test.step('Delete alert', async () => {
    await deleteAlert(userWithPermissionsPage, data.alertDetails, false);
  });
});
