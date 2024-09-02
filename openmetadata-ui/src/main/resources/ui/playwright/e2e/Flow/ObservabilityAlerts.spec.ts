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

import test, { expect } from '@playwright/test';
import {
  ALERT_UPDATED_DESCRIPTION,
  INGESTION_PIPELINE_NAME,
  TEST_CASE_NAME,
  TEST_SUITE_NAME,
} from '../../constant/alert';
import { Domain } from '../../support/domain/Domain';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import {
  addDomainFilter,
  addEntityFQNFilter,
  addExternalDestination,
  addGetSchemaChangesAction,
  addInternalDestination,
  addOwnerFilter,
  addPipelineStatusUpdatesAction,
  deleteAlert,
  generateAlertName,
  getObservabilityCreationDetails,
  inputBasicAlertInformation,
  saveAlertAndVerifyResponse,
  verifyAlertDetails,
  visitAlertDetailsPage,
  visitEditAlertPage,
  visitObservabilityAlertPage,
} from '../../utils/alert';
import {
  clickOutside,
  createNewPage,
  descriptionBox,
} from '../../utils/common';

const table1 = new TableClass();
const table2 = new TableClass();
const pipeline = new PipelineClass();
const user1 = new UserClass();
const user2 = new UserClass();
const domain = new Domain();

const SOURCE_NAME_1 = 'container';
const SOURCE_DISPLAY_NAME_1 = 'Container';
const SOURCE_NAME_2 = 'pipeline';
const SOURCE_DISPLAY_NAME_2 = 'Pipeline';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Observability Alert Flow', () => {
  const data = {
    alertDetails: {
      id: '',
      name: '',
      description: '',
      filteringRules: { resources: [] },
      input: { filters: [], actions: [] },
      destinations: [],
    },
  };

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table1.create(apiContext);
    await table2.create(apiContext);
    await table1.createTestSuiteAndPipelines(apiContext, TEST_SUITE_NAME);
    await table1.createTestCase(apiContext, TEST_CASE_NAME);
    await pipeline.create(apiContext);
    await pipeline.createIngestionPipeline(apiContext, INGESTION_PIPELINE_NAME);
    await user1.create(apiContext);
    await user2.create(apiContext);
    await domain.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table1.delete(apiContext);
    await table2.delete(apiContext);
    await pipeline.delete(apiContext);
    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await domain.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await visitObservabilityAlertPage(page);
  });

  test('Pipeline Alert', async ({ page }) => {
    const ALERT_NAME = generateAlertName();

    await test.step('Create alert', async () => {
      await inputBasicAlertInformation({
        page,
        name: ALERT_NAME,
        sourceName: SOURCE_NAME_1,
        sourceDisplayName: SOURCE_DISPLAY_NAME_1,
        createButtonId: 'create-observability',
      });

      // Select filters
      await page.click('[data-testid="add-filters"]');

      await addOwnerFilter({
        page,
        filterNumber: 0,
        ownerName: user1.getUserName(),
        selectId: 'Owner Name',
      });

      // Select trigger
      await page.click('[data-testid="add-trigger"]');

      await addGetSchemaChangesAction({
        page,
        filterNumber: 0,
      });

      await page.getByTestId('connection-timeout-input').clear();
      await page.fill('[data-testid="connection-timeout-input"]', '26');

      // Select Destination
      await page.click('[data-testid="add-destination-button"]');

      await addInternalDestination({
        page,
        destinationNumber: 0,
        category: 'Admins',
        type: 'Email',
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

    await test.step('Edit alert', async () => {
      await visitEditAlertPage(page, data.alertDetails, false);

      // Update description
      await page.locator(descriptionBox).clear();
      await page.locator(descriptionBox).fill(ALERT_UPDATED_DESCRIPTION);

      // Update source
      await page.click('[data-testid="source-select"]');
      await page
        .getByTestId(`${SOURCE_NAME_2}-option`)
        .getByText(SOURCE_DISPLAY_NAME_2)
        .click();

      // Filters should reset after source change
      await expect(page.getByTestId('filter-select-0')).not.toBeAttached();

      // Add owner filter
      await page.click('[data-testid="add-filters"]');
      await addOwnerFilter({
        page,
        filterNumber: 0,
        ownerName: user1.getUserName(),
        selectId: 'Owner Name',
      });

      // Add entityFQN filter
      await page.click('[data-testid="add-filters"]');
      await addEntityFQNFilter({
        page,
        filterNumber: 1,
        entityFQN: (
          pipeline.entityResponseData as { fullyQualifiedName: string }
        ).fullyQualifiedName,
        selectId: 'Pipeline Name',
        exclude: true,
      });
      // Add domain filter
      await page.click('[data-testid="add-filters"]');
      await addDomainFilter({
        page,
        filterNumber: 2,
        domainName: domain.responseData.name,
        domainDisplayName: domain.responseData.displayName,
      });

      // Add trigger
      await page.click('[data-testid="add-trigger"]');

      await addPipelineStatusUpdatesAction({
        page,
        filterNumber: 0,
        statusName: 'Successful',
        exclude: true,
      });

      // Add multiple destinations
      await page.click('[data-testid="add-destination-button"]');
      await addInternalDestination({
        page,
        destinationNumber: 0,
        category: 'Owners',
        type: 'G Chat',
      });

      // Add team Slack destination
      await page.click('[data-testid="add-destination-button"]');
      await addInternalDestination({
        page,
        destinationNumber: 1,
        category: 'Teams',
        type: 'Slack',
        typeId: 'Team-select',
        searchText: 'Organization',
      });

      // Click save
      const updateAlert = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/events/subscriptions') &&
          response.request().method() === 'PUT' &&
          response.status() === 200
      );
      await page.click('[data-testid="save-button"]');
      await updateAlert.then(async (response) => {
        data.alertDetails = await response.json();

        expect(response.status()).toEqual(200);

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

      await test.step('Create alert', async () => {
        await inputBasicAlertInformation({
          page,
          name: ALERT_NAME,
          sourceName: source,
          sourceDisplayName: sourceDisplayName,
          createButtonId: 'create-observability',
        });

        for (const filter of filters) {
          const filterNumber = filters.indexOf(filter);

          await page.click('[data-testid="add-filters"]');

          // Select filter
          await page.click(`[data-testid="filter-select-${filterNumber}"]`);
          await page.click(
            `.ant-select-dropdown:visible [data-testid="${filter.name}-filter-option"]`
          );

          // Search and select filter input value
          const searchOptions = page.waitForResponse(
            '/api/v1/search/query?q=*'
          );
          await page.fill(
            `[data-testid="${filter.inputSelector}"] [role="combobox"]`,
            filter.inputValue,
            {
              force: true,
            }
          );

          await searchOptions;

          await page.click(
            `.ant-select-dropdown:visible [title="${
              filter.inputValueId ?? filter.inputValue
            }"]`
          );

          // Check if option is selected
          await expect(
            page.locator(
              `[data-testid="${filter.inputSelector}"] [title="${
                filter.inputValueId ?? filter.inputValue
              }"]`
            )
          ).toBeAttached();

          if (filter.exclude) {
            // Change filter effect
            await page.click(`[data-testid="filter-switch-${filterNumber}"]`);
          }
        }

        // Add triggers
        for (const action of actions) {
          const actionNumber = actions.indexOf(action);

          await page.click('[data-testid="add-trigger"]');

          // Select action
          await page.click(`[data-testid="trigger-select-${actionNumber}"]`);

          // Adding the dropdown visibility check to avoid flakiness here
          await page.waitForSelector(`.ant-select-dropdown:visible`, {
            state: 'visible',
          });
          await page.click(
            `.ant-select-dropdown:visible [data-testid="${action.name}-filter-option"]:visible`
          );
          await page.waitForSelector(`.ant-select-dropdown:visible`, {
            state: 'hidden',
          });

          if (action.inputs && action.inputs.length > 0) {
            for (const input of action.inputs) {
              const getSearchResult = page.waitForResponse(
                '/api/v1/search/query?q=*'
              );
              await page.fill(
                `[data-testid="${input.inputSelector}"] [role="combobox"]`,
                input.inputValue,
                {
                  force: true,
                }
              );
              if (input.waitForAPI) {
                await getSearchResult;
              }
              await page.click(`[title="${input.inputValue}"]:visible`);

              // eslint-disable-next-line jest/no-conditional-expect
              await expect(page.getByTestId(input.inputSelector)).toHaveText(
                input.inputValue
              );

              await clickOutside(page);
            }
          }

          if (action.exclude) {
            // Change filter effect
            await page.click(`[data-testid="trigger-switch-${actionNumber}"]`);
          }
        }

        // Add Destinations
        for (const destination of alertDetails.destinations) {
          const destinationNumber =
            alertDetails.destinations.indexOf(destination);

          await page.click('[data-testid="add-destination-button"]');

          if (destination.mode === 'internal') {
            await addInternalDestination({
              page,
              destinationNumber,
              category: destination.category,
              type: destination.type,
              typeId: destination.inputSelector,
              searchText: destination.inputValue,
            });
          } else {
            await addExternalDestination({
              page,
              destinationNumber,
              category: destination.category,
              input: destination.inputValue,
              secretKey: destination.secretKey,
            });
          }
        }

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
});
