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

import { expect, Page } from '@playwright/test';
import { isEmpty, startCase } from 'lodash';
import { ALERT_DESCRIPTION } from '../constant/alert';
import {
  AlertDetails,
  ObservabilityCreationDetails,
} from '../constant/alert.interface';
import { DELETE_TERM } from '../constant/common';
import { SidebarItem } from '../constant/sidebar';
import {
  clickOutside,
  descriptionBox,
  redirectToHomePage,
  toastNotification,
  uuid,
} from './common';
import { validateFormNameFieldInput } from './form';
import { sidebarClick } from './sidebar';

export const generateAlertName = () => `0%alert-playwright-${uuid()}`;

export const visitNotificationAlertPage = async (page: Page) => {
  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.SETTINGS);
  const getAlerts = page.waitForResponse('/api/v1/events/subscriptions?*');
  const getActivityFeedAlertDetails = page.waitForResponse(
    '/api/v1/events/subscriptions/name/ActivityFeedAlert?include=all'
  );
  await page.click('[data-testid="notifications"]');
  await getAlerts;
  await getActivityFeedAlertDetails;
};

export const visitObservabilityAlertPage = async (page: Page) => {
  await redirectToHomePage(page);
  const getAlerts = page.waitForResponse(
    '/api/v1/events/subscriptions?*alertType=Observability*'
  );
  await sidebarClick(page, SidebarItem.OBSERVABILITY_ALERT);
  await getAlerts;
};

export const findPageWithAlert = async (
  page: Page,
  alertDetails: AlertDetails
) => {
  const { id } = alertDetails;
  const alertRow = page.locator(`[data-row-key="${id}"]`);
  const nextButton = page.locator('[data-testid="next"]');
  if ((await alertRow.isHidden()) && (await nextButton.isEnabled())) {
    const getAlerts = page.waitForResponse('/api/v1/events/subscriptions?*');
    await nextButton.click();
    await getAlerts;
    await page.waitForSelector('.ant-table-wrapper [data-testid="loader"]', {
      state: 'detached',
    });
    await findPageWithAlert(page, alertDetails);
  }
};

export const visitEditAlertPage = async (
  page: Page,
  alertDetails: AlertDetails,
  isNotificationAlert = true
) => {
  if (isNotificationAlert) {
    await visitNotificationAlertPage(page);
  } else {
    await visitObservabilityAlertPage(page);
  }
  const { id: alertId } = alertDetails;

  await findPageWithAlert(page, alertDetails);
  await page.click(
    `[data-row-key="${alertId}"] [data-testid="alert-edit-${alertDetails.name}"]`
  );

  // Check alert name
  await expect(page.locator('#name')).toHaveValue(alertDetails.name);
};

export const visitAlertDetailsPage = async (
  page: Page,
  alertDetails: AlertDetails
) => {
  await findPageWithAlert(page, alertDetails);

  const getAlertDetails = page.waitForResponse(
    '/api/v1/events/subscriptions/name/*'
  );
  await page
    .locator(`[data-row-key="${alertDetails.id}"]`)
    .getByText(alertDetails.name)
    .click();
  await getAlertDetails;
};

export const deleteAlertSteps = async (page: Page, name: string) => {
  await page.getByTestId(`alert-delete-${name}`).click();

  await expect(page.locator('.ant-modal-header')).toHaveText(
    `Delete subscription "${name}"`
  );

  await page.fill('[data-testid="confirmation-text-input"]', DELETE_TERM);

  const deleteAlert = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' && response.status() === 200
  );
  await page.click('[data-testid="confirm-button"]');
  await deleteAlert;

  await toastNotification(page, `"${name}" deleted successfully!`);
};

export const addOwnerFilter = async ({
  page,
  filterNumber,
  ownerName,
  exclude = false,
  selectId = 'Owner',
}: {
  page: Page;
  filterNumber: number;
  ownerName: string;
  exclude?: boolean;
  selectId?: string;
}) => {
  // Select owner filter
  await page.click(`[data-testid="filter-select-${filterNumber}"]`);
  await page.click(`[data-testid="${selectId}-filter-option"]:visible`);

  // Search and select owner
  const getSearchResult = page.waitForResponse('/api/v1/search/query?q=*');
  await page.waitForSelector('.ant-select-dropdown:visible');
  await page.fill(
    '[data-testid="owner-name-select"] [role="combobox"]',
    ownerName,
    {
      force: true,
    }
  );
  await getSearchResult;
  await page
    .locator(`.ant-select-dropdown:visible [title="${ownerName}"]`)
    .click();

  await expect(
    page.getByTestId('owner-name-select').getByTitle(ownerName)
  ).toBeAttached();

  if (exclude) {
    // Change filter effect
    await page.click(`[data-testid="filter-switch-${filterNumber}"]`);
  }
};

export const addEntityFQNFilter = async ({
  page,
  filterNumber,
  entityFQN,
  exclude = false,
  selectId = 'Entity FQN',
}: {
  page: Page;
  filterNumber: number;
  entityFQN: string;
  exclude?: boolean;
  selectId?: string;
}) => {
  // Select entity FQN filter
  await page.click(`[data-testid="filter-select-${filterNumber}"]`);
  await page.click(`[data-testid="${selectId}-filter-option"]:visible`);

  // Search and select entity
  const getSearchResult = page.waitForResponse('/api/v1/search/query?q=*');
  await page.fill(
    '[data-testid="fqn-list-select"] [role="combobox"]',
    entityFQN,
    {
      force: true,
    }
  );
  await getSearchResult;
  await page.click(`.ant-select-dropdown:visible [title="${entityFQN}"]`);

  await expect(
    page.getByTestId('fqn-list-select').getByTitle(entityFQN)
  ).toBeAttached();

  if (exclude) {
    // Change filter effect
    await page.click(`[data-testid="filter-switch-${filterNumber}"]`);
  }
};

export const addEventTypeFilter = async ({
  page,
  filterNumber,
  eventType,
  exclude = false,
}: {
  page: Page;
  filterNumber: number;
  eventType: string;
  exclude?: boolean;
}) => {
  // Select event type filter
  await page.click(`[data-testid="filter-select-${filterNumber}"]`);
  await page.click(`[data-testid="Event Type-filter-option"]:visible`);

  // Search and select event type
  await page.fill(
    '[data-testid="event-type-select"] [role="combobox"]',
    eventType,
    {
      force: true,
    }
  );
  await page.click(
    `.ant-select-dropdown:visible [title="${startCase(eventType)}"]`
  );

  await expect(page.getByTestId('event-type-select')).toHaveText(
    startCase(eventType)
  );

  if (exclude) {
    // Change filter effect
    await page.click(`[data-testid="filter-switch-${filterNumber}"]`);
  }
};

export const addFilterWithUsersListInput = async ({
  page,
  filterTestId,
  filterNumber,
  updaterName,
  exclude = false,
}: {
  page: Page;
  filterTestId: string;
  filterNumber: number;
  updaterName: string;
  exclude?: boolean;
}) => {
  // Select updater name filter
  await page.click(`[data-testid="filter-select-${filterNumber}"]`);
  await page.click(`[data-testid="${filterTestId}"]:visible`);

  // Search and select user
  const getSearchResult = page.waitForResponse('/api/v1/search/query?q=*');
  await page.fill(
    '[data-testid="user-name-select"] [role="combobox"]',
    updaterName,
    {
      force: true,
    }
  );
  await getSearchResult;
  await page.click(`.ant-select-dropdown:visible [title="${updaterName}"]`);

  await expect(page.getByTestId('user-name-select')).toHaveText(updaterName);

  if (exclude) {
    // Change filter effect
    await page.click(`[data-testid="filter-switch-${filterNumber}"]`);
  }
};

export const addDomainFilter = async ({
  page,
  filterNumber,
  domainName,
  domainDisplayName,
  exclude = false,
}: {
  page: Page;
  filterNumber: number;
  domainName: string;
  domainDisplayName: string;
  exclude?: boolean;
}) => {
  // Select domain filter
  await page.click(`[data-testid="filter-select-${filterNumber}"]`);
  await page.click(`[data-testid="Domain-filter-option"]:visible`);

  // Search and select domain
  const getSearchResult = page.waitForResponse(
    '/api/v1/search/query?q=**index=domain_search_index'
  );
  await page.fill(
    '[data-testid="domain-select"] [role="combobox"]',
    domainName,
    {
      force: true,
    }
  );
  await getSearchResult;
  await page.click(
    `.ant-select-dropdown:visible [title="${domainDisplayName}"]`
  );

  await expect(
    page.getByTestId('domain-select').getByTitle(domainDisplayName)
  ).toBeAttached();

  if (exclude) {
    // Change filter effect
    await page.click(`[data-testid="filter-switch-${filterNumber}"]`);
  }
};

export const addGMEFilter = async ({
  page,
  filterNumber,
  exclude = false,
}: {
  page: Page;
  filterNumber: number;
  exclude?: boolean;
}) => {
  // Select general metadata events filter
  await page.click(`[data-testid="filter-select-${filterNumber}"]`);
  await page.click(
    `[data-testid="General Metadata Events-filter-option"]:visible`
  );

  if (exclude) {
    // Change filter effect
    await page.click(`[data-testid="filter-switch-${filterNumber}"]`);
  }
};

export const addInternalDestination = async ({
  page,
  destinationNumber,
  category,
  typeId,
  type = '',
  searchText = '',
}: {
  page: Page;
  destinationNumber: number;
  category: string;
  typeId?: string;
  type?: string;
  searchText?: string;
}) => {
  // Select destination category
  await page.click(
    `[data-testid="destination-category-select-${destinationNumber}"]`
  );
  await page.click(`[data-testid="${category}-internal-option"]:visible`);

  // Select the receivers
  if (typeId) {
    if (category === 'Teams' || category === 'Users') {
      await page.click(
        `[data-testid="destination-${destinationNumber}"] [data-testid="dropdown-trigger-button"]`
      );
      const getSearchResult = page.waitForResponse('/api/v1/search/query?q=*');
      await page.fill(
        `[data-testid="team-user-select-dropdown-${destinationNumber}"]:visible [data-testid="search-input"]`,
        searchText
      );

      await getSearchResult;
      await page.click(
        `.ant-dropdown:visible [data-testid="${searchText}-option-label"]`
      );
    } else {
      const getSearchResult = page.waitForResponse('/api/v1/search/query?q=*');
      await page.fill(`[data-testid="${typeId}"]`, searchText);
      await getSearchResult;
      await page.click(`.ant-select-dropdown:visible [title="${searchText}"]`);
    }
    await clickOutside(page);
  }

  // Select destination type
  await page.click(
    `[data-testid="destination-type-select-${destinationNumber}"]`
  );
  await page.click(
    `.select-options-container [data-testid="${type}-external-option"]:visible`
  );

  // Check the added destination type
  await expect(
    page
      .getByTestId(`destination-type-select-${destinationNumber}`)
      .getByTestId(`${type}-external-option`)
  ).toBeAttached();
};

export const addExternalDestination = async ({
  page,
  destinationNumber,
  category,
  secretKey,
  input = '',
}: {
  page: Page;
  destinationNumber: number;
  category: string;
  input?: string;
  secretKey?: string;
}) => {
  // Select destination category
  await page.click(
    `[data-testid="destination-category-select-${destinationNumber}"]`
  );

  // Select external tab
  await page.click(`[data-testid="tab-label-external"]:visible`);

  // Select destination category option
  await page.click(
    `[data-testid="destination-category-dropdown-${destinationNumber}"]:visible [data-testid="${category}-external-option"]:visible`
  );

  // Input the destination receivers value
  if (category === 'Email') {
    await page.fill(
      `[data-testid="email-input-${destinationNumber}"] [role="combobox"]`,
      input
    );
    await page.keyboard.press('Enter');
  } else {
    await page.fill(
      `[data-testid="endpoint-input-${destinationNumber}"]`,
      input
    );
  }

  // Input the secret key value
  if (category === 'Webhook' && secretKey) {
    await page.fill(
      `[data-testid="secret-key-input-${destinationNumber}"]`,
      secretKey
    );
  }
};

const checkActionOrFilterDetails = async ({
  page,
  filters,
}: {
  page: Page;
  filters: AlertDetails['input']['filters'];
}) => {
  if (!isEmpty(filters)) {
    for (const filter of filters) {
      const index = filters.indexOf(filter);

      // Check filter effect
      await expect(
        page.locator('[data-testid="effect-value"]').nth(index)
      ).toContainText(startCase(filter.effect));

      // Check filter name
      await expect(
        page.locator('[data-testid="filter-name"]').nth(index)
      ).toContainText(startCase(filter.name));

      if (!isEmpty(filter.arguments)) {
        for (const argument of filter.arguments) {
          // Check filter arguments
          await expect(
            page.locator(`[data-testid="argument-container-${argument.name}"]`)
          ).toBeAttached();

          for (const val of argument.input) {
            await expect(
              page.locator(`[data-testid="argument-value"]`).getByText(val)
            ).toBeAttached();
          }
        }
      }
    }
  }
};

export const verifyAlertDetails = async ({
  page,
  alertDetails,
  isObservabilityAlert = false,
}: {
  page: Page;
  alertDetails: AlertDetails;
  isObservabilityAlert?: boolean;
}) => {
  const { name, description, filteringRules, input, destinations } =
    alertDetails;

  const triggerName = filteringRules.resources[0];
  const filters = input.filters;

  // Check created alert details
  await expect(page.getByTestId('alert-details-container')).toBeAttached();

  // Check alert name
  await expect(page.getByTestId('alert-name')).toContainText(name);

  if (description) {
    // Check alert name
    await expect(page.getByTestId('alert-description')).toContainText(
      description
    );
  }

  // Check trigger name
  await expect(page.getByTestId('resource-name')).toContainText(
    startCase(triggerName)
  );

  // Check filter details
  await checkActionOrFilterDetails({ page, filters });

  if (isObservabilityAlert) {
    const actions = input.actions;

    // Check action details
    await checkActionOrFilterDetails({ page, filters: actions });
  }

  if (!isEmpty(destinations)) {
    // Check connection timeout details
    await expect(page.getByTestId('connection-timeout')).toContainText(
      destinations[0].timeout.toString()
    );

    for (const destination of destinations) {
      // Check Destination category
      await expect(
        page
          .getByTestId(`destination-${destination.category}`)
          .getByTestId('category-value')
      ).toContainText(destination.category);

      // Check Destination type
      await expect(
        page
          .getByTestId(`destination-${destination.category}`)
          .getByTestId('destination-type')
      ).toContainText(startCase(destination.type));

      if (!isEmpty(destination.config?.secretKey)) {
        // Check secret key is present
        await expect(
          page.getByTestId(`destination-${destination.category}`)
        ).toContainText('Secret Key');
      }

      if (!isEmpty(destination.config?.receivers)) {
        // Check Destination receivers
        for (const receiver of destination.config.receivers) {
          await expect(page.getByTestId(`receiver-${receiver}`)).toBeAttached();
        }
      }
    }
  }
};

export const addGetSchemaChangesAction = async ({
  page,
  filterNumber,
  exclude = false,
}: {
  page: Page;
  filterNumber: number;
  exclude?: boolean;
}) => {
  // Select owner filter
  await page.click(`[data-testid="trigger-select-${filterNumber}"]`);
  await page.click(`[data-testid="Get Schema Changes-filter-option"]:visible`);

  if (exclude) {
    // Change filter effect
    await page.click(`[data-testid="filter-switch-${filterNumber}"]`);
  }
};

export const addPipelineStatusUpdatesAction = async ({
  page,
  filterNumber,
  statusName,
  exclude = false,
}: {
  page: Page;
  filterNumber: number;
  statusName: string;
  exclude?: boolean;
}) => {
  // Select pipeline status action
  await page.click(`[data-testid="trigger-select-${filterNumber}"]`);
  await page.click(
    `[data-testid="Get Pipeline Status Updates-filter-option"]:visible`
  );

  // Search and select pipeline status input
  await page.fill(
    '[data-testid="pipeline-status-select"] [role="combobox"]',
    statusName,
    {
      force: true,
    }
  );
  await page.click(`[title="${statusName}"]:visible`);

  await expect(page.getByTestId('pipeline-status-select')).toHaveText(
    statusName
  );

  await clickOutside(page);

  if (exclude) {
    // Change action effect
    await page.click(`[data-testid="trigger-switch-${filterNumber}"]`);
  }
};

export const addMultipleFilters = async ({
  page,
  user1,
  user2,
  domain,
  dashboard,
}: {
  page: Page;
  user1;
  user2;
  domain;
  dashboard;
}) => {
  // Add owner filter
  await page.click('[data-testid="add-filters"]');
  await addOwnerFilter({
    page,
    filterNumber: 0,
    ownerName: user1.getUserName(),
  });

  // Add entityFQN filter
  await page.click('[data-testid="add-filters"]');
  await addEntityFQNFilter({
    page,
    filterNumber: 1,
    entityFQN: (dashboard.entityResponseData as { fullyQualifiedName: string })
      .fullyQualifiedName,
    exclude: true,
  });

  // Add event type filter
  await page.click('[data-testid="add-filters"]');
  await addEventTypeFilter({
    page,
    filterNumber: 2,
    eventType: 'entityCreated',
  });

  // Add users list filter
  await page.click('[data-testid="add-filters"]');
  await addFilterWithUsersListInput({
    page,
    filterTestId: 'Updater Name-filter-option',
    filterNumber: 3,
    updaterName: user2.getUserName(),
    exclude: true,
  });

  // Add domain filter
  await page.click('[data-testid="add-filters"]');
  await addDomainFilter({
    page,
    filterNumber: 4,
    domainName: domain.responseData.name,
    domainDisplayName: domain.responseData.displayName,
  });

  // Add general metadata events filter
  await page.click('[data-testid="add-filters"]');
  await addGMEFilter({ page, filterNumber: 5 });
};

export const inputBasicAlertInformation = async ({
  page,
  name,
  createButtonId = 'create-notification',
  sourceName,
  sourceDisplayName,
}: {
  page: Page;
  createButtonId?: string;
  name: string;
  sourceName: string;
  sourceDisplayName: string;
}) => {
  await page.click(`[data-testid="${createButtonId}"]`);

  // Enter alert name
  await validateFormNameFieldInput({
    page,
    value: name,
    fieldName: 'Name',
    errorDivSelector: '#name_help',
  });

  // Enter description
  await page.locator(descriptionBox).clear();
  await page.locator(descriptionBox).fill(ALERT_DESCRIPTION);

  // Select all source
  await page.click('[data-testid="add-source-button"]');

  await page
    .getByTestId('drop-down-menu')
    .getByTestId(`${sourceName}-option`)
    .click();

  await expect(page.getByTestId('source-select')).toHaveText(sourceDisplayName);
};

export const saveAlertAndVerifyResponse = async (page: Page) => {
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

  const getAlertDetails = page.waitForResponse(
    '/api/v1/events/subscriptions/name/*'
  );
  const createAlert = page.waitForResponse(
    (response) => response.request().method() === 'POST'
  );

  // Click save
  await page.click('[data-testid="save-button"]');
  await createAlert.then(async (response) => {
    data.alertDetails = await response.json();

    expect(response.status()).toEqual(201);
  });
  await toastNotification(page, 'Alerts created successfully.');

  // Check if the alert details page is visible
  await getAlertDetails;

  await expect(page.getByTestId('alert-details-container')).toBeAttached();

  return data.alertDetails;
};

export const deleteAlert = async (
  page: Page,
  alertDetails: AlertDetails,
  isNotificationAlert = true
) => {
  if (isNotificationAlert) {
    await visitNotificationAlertPage(page);
  } else {
    await visitObservabilityAlertPage(page);
  }
  await findPageWithAlert(page, alertDetails);
  await deleteAlertSteps(page, alertDetails.name);
};

export const getObservabilityCreationDetails = ({
  tableName1,
  tableName2,
  testCaseName,
  ingestionPipelineName,
  domainName,
  domainDisplayName,
  userName,
  testSuiteFQN,
}: {
  tableName1: string;
  tableName2: string;
  testCaseName: string;
  ingestionPipelineName: string;
  domainName: string;
  domainDisplayName: string;
  userName: string;
  testSuiteFQN: string;
}): Array<ObservabilityCreationDetails> => {
  return [
    {
      source: 'table',
      sourceDisplayName: 'Table',
      filters: [
        {
          name: 'Table Name',
          inputSelector: 'fqn-list-select',
          inputValue: tableName1,
          exclude: true,
        },
        {
          name: 'Domain',
          inputSelector: 'domain-select',
          inputValue: domainName,
          inputValueId: domainDisplayName,
          exclude: false,
        },
        {
          name: 'Owner Name',
          inputSelector: 'owner-name-select',
          inputValue: userName,
          exclude: true,
        },
      ],
      actions: [
        {
          name: 'Get Schema Changes',
          exclude: true,
        },
        {
          name: 'Get Table Metrics Updates',
          exclude: false,
        },
      ],
      destinations: [
        {
          mode: 'internal',
          category: 'Owners',
          type: 'Email',
        },
        {
          mode: 'external',
          category: 'Webhook',
          inputValue: 'https://webhook.com',
          secretKey: 'secret_key',
        },
      ],
    },
    {
      source: 'ingestionPipeline',
      sourceDisplayName: 'Ingestion Pipeline',
      filters: [
        {
          name: 'Ingestion Pipeline Name',
          inputSelector: 'fqn-list-select',
          inputValue: ingestionPipelineName,
          exclude: false,
        },
        {
          name: 'Domain',
          inputSelector: 'domain-select',
          inputValue: domainName,
          inputValueId: domainDisplayName,
          exclude: false,
        },
        {
          name: 'Owner Name',
          inputSelector: 'owner-name-select',
          inputValue: userName,
          exclude: true,
        },
      ],
      actions: [
        {
          name: 'Get Ingestion Pipeline Status Updates',
          inputs: [
            {
              inputSelector: 'pipeline-status-select',
              inputValue: 'Queued',
            },
          ],
          exclude: false,
        },
      ],
      destinations: [
        {
          mode: 'internal',
          category: 'Owners',
          type: 'Email',
        },
        {
          mode: 'external',
          category: 'Email',
          inputValue: 'test@example.com',
        },
      ],
    },
    {
      source: 'testCase',
      sourceDisplayName: 'Test case',
      filters: [
        {
          name: 'Test Case Name',
          inputSelector: 'fqn-list-select',
          inputValue: testCaseName,
          exclude: true,
        },
        {
          name: 'Domain',
          inputSelector: 'domain-select',
          inputValue: domainName,
          inputValueId: domainDisplayName,
          exclude: false,
        },
        {
          name: 'Owner Name',
          inputSelector: 'owner-name-select',
          inputValue: userName,
          exclude: true,
        },
        {
          name: 'Table Name A Test Case Belongs To',
          inputSelector: 'table-name-select',
          inputValue: tableName2,
          exclude: false,
        },
      ],
      actions: [
        {
          name: 'Get Test Case Status Updates',
          inputs: [
            {
              inputSelector: 'test-result-select',
              inputValue: 'Success',
            },
          ],
          exclude: false,
        },
        {
          name: 'Get Test Case Status Updates belonging to a Test Suite',
          inputs: [
            {
              inputSelector: 'test-suite-select',
              inputValue: testSuiteFQN,
              waitForAPI: true,
            },
            {
              inputSelector: 'test-status-select',
              inputValue: 'Failed',
            },
          ],
          exclude: false,
        },
      ],
      destinations: [
        {
          mode: 'internal',
          category: 'Users',
          inputSelector: 'User-select',
          inputValue: userName,
          type: 'Email',
        },
        {
          mode: 'external',
          category: 'Webhook',
          inputValue: 'https://webhook.com',
        },
      ],
    },
    {
      source: 'testSuite',
      sourceDisplayName: 'Test Suite',
      filters: [
        {
          name: 'Test Suite Name',
          inputSelector: 'fqn-list-select',
          inputValue: testSuiteFQN,
          exclude: true,
        },
        {
          name: 'Domain',
          inputSelector: 'domain-select',
          inputValue: domainName,
          inputValueId: domainDisplayName,
          exclude: false,
        },
        {
          name: 'Owner Name',
          inputSelector: 'owner-name-select',
          inputValue: userName,
          exclude: false,
        },
      ],
      actions: [],
      destinations: [
        {
          mode: 'external',
          category: 'Slack',
          inputValue: 'https://slack.com',
        },
      ],
    },
  ];
};
