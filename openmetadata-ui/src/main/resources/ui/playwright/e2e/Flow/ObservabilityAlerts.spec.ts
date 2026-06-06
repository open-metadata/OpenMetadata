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

import { Page } from '@playwright/test';
import {
  INGESTION_PIPELINE_NAME,
  TEST_CASE_NAME,
  TEST_SUITE_NAME,
} from '../../constant/alert';
import { ObservabilityCreationDetails } from '../../constant/alert.interface';
import { Domain } from '../../support/domain/Domain';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  commonCleanup,
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
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  addExternalDestination,
  checkAlertDetailsForWithPermissionUser,
  checkAlertFlowForWithoutPermissionUser,
  createCommonObservabilityAlert,
  editObservabilityAlert,
  getObservabilityCreationDetails,
  visitObservabilityAlertPage,
} from '../../utils/observabilityAlert';
import { waitForSearchIndexed } from '../../utils/polling';
import { test as base } from '../fixtures/pages';

const user1 = new UserClass();
const user2 = new UserClass();
let table1: TableClass;
let table2: TableClass;
let pipeline: PipelineClass;
let domain: Domain;

const SOURCE_NAME_1 = 'container';
const SOURCE_DISPLAY_NAME_1 = 'Container';
const SOURCE_NAME_2 = 'pipeline';
const SOURCE_DISPLAY_NAME_2 = 'Pipeline';
const SOURCE_NAME_3 = 'table';
const SOURCE_DISPLAY_NAME_3 = 'Table';

const test = base.extend<{
  userWithPermissionsPage: Page;
  userWithoutPermissionsPage: Page;
}>({
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
  table1 = new TableClass();
  table2 = new TableClass();
  pipeline = new PipelineClass();
  domain = new Domain();
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

  // Wait for the entities used as alert-filter dropdown picks to be searchable.
  // In mode="multiple" the user can only pick options returned by the search API,
  // so the test must wait for ES indexing before the UI flow runs.
  await waitForSearchIndexed(
    apiContext,
    table1.entityResponseData.fullyQualifiedName ?? '',
    'table'
  );
  await waitForSearchIndexed(
    apiContext,
    table2.entityResponseData.fullyQualifiedName ?? '',
    'table'
  );
  await waitForSearchIndexed(
    apiContext,
    table1.testSuiteResponseData.fullyQualifiedName ?? '',
    'testSuite'
  );
  await waitForSearchIndexed(
    apiContext,
    table1.testCasesResponseData[0]?.fullyQualifiedName ?? '',
    'testCase'
  );
  await waitForSearchIndexed(
    apiContext,
    pipeline.ingestionPipelineResponseData.fullyQualifiedName ?? '',
    'ingestionPipeline'
  );

  // Build the observability creation details using the entity FQNs returned
  // from the API. The alert filter dropdowns run in mode="multiple", whose
  // option `title` attribute equals the entity FQN, so the test's expected
  // `inputValue` must match the FQN exactly.
  observabilityDetailsBySource.clear();
  const details = getObservabilityCreationDetails({
    tableName1: table1.entityResponseData.fullyQualifiedName ?? '',
    tableName2: table2.entityResponseData.fullyQualifiedName ?? '',
    testSuiteFQN: table1.testSuiteResponseData.fullyQualifiedName ?? '',
    testSuiteName: table1.testSuiteResponseData.name ?? '',
    testCaseName: table1.testCasesResponseData[0]?.fullyQualifiedName ?? '',
    ingestionPipelineName:
      pipeline.ingestionPipelineResponseData.fullyQualifiedName ?? '',
    domainName: domain.data.name,
    domainDisplayName: domain.data.displayName,
    userName: `${user1.data.firstName}${user1.data.lastName}`,
  });
  for (const detail of details) {
    observabilityDetailsBySource.set(detail.source, detail);
  }

  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await commonCleanup({
    apiContext,
    table: table2,
    user1,
    user2,
    domain,
  });
  await table1.delete(apiContext);
  await pipeline.delete(apiContext);

  await afterAction();
});

test.beforeEach(async ({ page }) => {
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
    await waitForAllLoadersToDisappear(page);
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

// Test names must be known at module load, but filter/action values must use
// FQNs that only exist after entity creation. Declare the source list statically
// and look up the full details (built in beforeAll) inside each test.
const OBSERVABILITY_SOURCES: Array<{
  source: string;
  sourceDisplayName: string;
}> = [
  { source: 'table', sourceDisplayName: 'Table' },
  { source: 'ingestionPipeline', sourceDisplayName: 'Ingestion Pipeline' },
  { source: 'testCase', sourceDisplayName: 'Test case' },
  { source: 'testSuite', sourceDisplayName: 'Test Suite' },
];

const observabilityDetailsBySource = new Map<
  string,
  ObservabilityCreationDetails
>();

for (const { source, sourceDisplayName } of OBSERVABILITY_SOURCES) {
  test(`${sourceDisplayName} alert`, async ({ page }) => {
    test.slow();
    const alertDetails = observabilityDetailsBySource.get(source);
    if (!alertDetails) {
      throw new Error(
        `Observability creation details missing for source "${source}". ` +
          `Was beforeAll set up correctly?`
      );
    }
    const { filters, actions } = alertDetails;
    const ALERT_NAME = generateAlertName();

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
  // Todo: Re-enable after fixing the https://github.com/open-metadata/openmetadata-collate/issues/3280 @sonika-shah
  test.fixme(
    process.env.PLAYWRIGHT_IS_OSS !== 'true',
    'Skipping in AUT environment'
  );
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
    await userWithPermissionsPage
      .locator('.ant-select-dropdown:visible')
      .waitFor({ state: 'hidden' });

    // The mode="multiple" AsyncSelect renders dropdown options whose `title`
    // equals the entity FQN, not the bare name. Search and pick by FQN.
    const table1Fqn = table1.entityResponseData.fullyQualifiedName ?? '';

    // Focus the combobox first so the search input becomes editable
    // (mode="multiple" keeps the input readonly until focused).
    await userWithPermissionsPage.click(
      `[data-testid="fqn-list-select"] [role="combobox"]`
    );

    // Search and select filter input value
    const searchOptions = userWithPermissionsPage.waitForResponse(
      '/api/v1/search/query?q=*'
    );
    await userWithPermissionsPage.fill(
      `[data-testid="fqn-list-select"] [role="combobox"]`,
      table1Fqn,
      {
        force: true, // eslint-disable-line playwright/no-force-option -- Ant Select overlay covers combobox input
      }
    );

    await searchOptions;

    await userWithPermissionsPage.click(
      `.ant-select-dropdown:visible [title="${table1Fqn}"]`
    );

    // Check if option is selected
    await test
      .expect(
        userWithPermissionsPage.locator(
          `[data-testid="fqn-list-select"] [title="${table1Fqn}"]`
        )
      )
      .toBeAttached();

    // Clicking add-trigger closes the fqn-list-select dropdown (multi-select stays open until click outside)
    await userWithPermissionsPage.click('[data-testid="add-trigger"]');

    // Wait for the fqn-list-select dropdown to fully close before opening the trigger dropdown
    await userWithPermissionsPage
      .locator('.ant-select-dropdown:visible')
      .waitFor({ state: 'hidden' });

    // Select action
    await userWithPermissionsPage.click('[data-testid="trigger-select-0"]');

    // Adding the dropdown visibility check to avoid flakiness here
    await userWithPermissionsPage
      .locator(`.ant-select-dropdown:visible`)
      .waitFor({
        state: 'visible',
      });
    await userWithPermissionsPage.click(
      '.ant-select-dropdown:visible [data-testid="Get Schema Changes-filter-option"]:visible'
    );
    await userWithPermissionsPage
      .locator(`.ant-select-dropdown:visible`)
      .waitFor({
        state: 'hidden',
      });

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

  await test.step('Check alert details page and Recent Events tab', async () => {
    await checkAlertDetailsForWithPermissionUser({
      page: userWithPermissionsPage,
      alertDetails: data.alertDetails,
      sourceName: SOURCE_NAME_3,
      table: table1,
      user: user2,
    });
  });

  await test.step('Delete alert', async () => {
    await deleteAlert(userWithPermissionsPage, data.alertDetails, false);
  });
});
