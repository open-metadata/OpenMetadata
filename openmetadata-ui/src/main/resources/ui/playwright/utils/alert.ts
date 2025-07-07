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

import { APIRequestContext, expect, Page } from '@playwright/test';
import { isEmpty, startCase } from 'lodash';
import {
  ALERT_DESCRIPTION,
  ALERT_WITHOUT_PERMISSION_POLICY_DETAILS,
  ALERT_WITHOUT_PERMISSION_POLICY_NAME,
  ALERT_WITHOUT_PERMISSION_ROLE_DETAILS,
  ALERT_WITHOUT_PERMISSION_ROLE_NAME,
  ALERT_WITH_PERMISSION_POLICY_DETAILS,
  ALERT_WITH_PERMISSION_POLICY_NAME,
  ALERT_WITH_PERMISSION_ROLE_DETAILS,
  ALERT_WITH_PERMISSION_ROLE_NAME,
} from '../constant/alert';
import { AlertDetails, EventDetails } from '../constant/alert.interface';
import { DELETE_TERM } from '../constant/common';
import { Domain } from '../support/domain/Domain';
import { DashboardClass } from '../support/entity/DashboardClass';
import { TableClass } from '../support/entity/TableClass';
import { UserClass } from '../support/user/UserClass';
import {
  clickOutside,
  descriptionBox,
  getApiContext,
  toastNotification,
  uuid,
} from './common';
import { getEntityDisplayName, getTextFromHtmlString } from './entity';
import { validateFormNameFieldInput } from './form';
import {
  addFilterWithUsersListInput,
  addInternalDestination,
  visitNotificationAlertPage,
} from './notificationAlert';
import { visitObservabilityAlertPage } from './observabilityAlert';

export const generateAlertName = () => `0%alert-playwright-${uuid()}`;

export const commonPrerequisites = async ({
  apiContext,
  user1,
  user2,
  domain,
  table,
}: {
  apiContext: APIRequestContext;
  user1: UserClass;
  user2: UserClass;
  domain: Domain;
  table: TableClass;
}) => {
  await table.create(apiContext);
  await user1.create(apiContext);
  await user2.create(apiContext);
  await domain.create(apiContext);
  await apiContext.post('/api/v1/policies', {
    data: ALERT_WITH_PERMISSION_POLICY_DETAILS,
  });

  await apiContext.post('/api/v1/policies', {
    data: ALERT_WITHOUT_PERMISSION_POLICY_DETAILS,
  });

  const role1Response = await apiContext.post('/api/v1/roles', {
    data: ALERT_WITH_PERMISSION_ROLE_DETAILS,
  });

  const role2Response = await apiContext.post('/api/v1/roles', {
    data: ALERT_WITHOUT_PERMISSION_ROLE_DETAILS,
  });

  const role1Data = (await role1Response.json()) as {
    id: string;
    name: string;
  };

  const role2Data = (await role2Response.json()) as {
    id: string;
    name: string;
  };

  await user1.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/roles/0',
        value: {
          id: role1Data.id,
          type: 'role',
          name: role1Data.name,
        },
      },
    ],
  });

  await user2.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/roles/0',
        value: {
          id: role2Data.id,
          type: 'role',
          name: role2Data.name,
        },
      },
    ],
  });
};

export const commonCleanup = async ({
  apiContext,
  user1,
  user2,
  domain,
  table,
}: {
  apiContext: APIRequestContext;
  user1: UserClass;
  user2: UserClass;
  domain: Domain;
  table: TableClass;
}) => {
  await user1.delete(apiContext);
  await user2.delete(apiContext);
  await domain.delete(apiContext);
  await table.delete(apiContext);
  await apiContext.delete(
    `/api/v1/policies/name/${ALERT_WITH_PERMISSION_POLICY_NAME}?hardDelete=true`
  );
  await apiContext.delete(
    `/api/v1/policies/name/${ALERT_WITHOUT_PERMISSION_POLICY_NAME}?hardDelete=true`
  );
  await apiContext.delete(
    `/api/v1/roles/name/${ALERT_WITH_PERMISSION_ROLE_NAME}?hardDelete=true`
  );
  await apiContext.delete(
    `/api/v1/roles/name/${ALERT_WITHOUT_PERMISSION_ROLE_NAME}?hardDelete=true`
  );
};

export const findPageWithAlert = async (
  page: Page,
  alertDetails: AlertDetails
) => {
  const { id } = alertDetails;
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
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

export const deleteAlertSteps = async (
  page: Page,
  name: string,
  displayName: string
) => {
  await page.getByTestId(`alert-delete-${name}`).click();

  await expect(page.locator('.ant-modal-header')).toHaveText(
    `Delete subscription "${displayName}"`
  );

  await page.fill('[data-testid="confirmation-text-input"]', DELETE_TERM);

  const deleteAlert = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' && response.status() === 200
  );
  await page.click('[data-testid="confirm-button"]');
  await deleteAlert;

  await toastNotification(page, `"${displayName}" deleted successfully!`);
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
  await deleteAlertSteps(
    page,
    alertDetails.name,
    getEntityDisplayName(alertDetails)
  );
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
  await expect(page.locator('#displayName')).toHaveValue(
    getEntityDisplayName(alertDetails)
  );
};

export const visitAlertDetailsPage = async (
  page: Page,
  alertDetails: AlertDetails
) => {
  await findPageWithAlert(page, alertDetails);

  const getAlertDetails = page.waitForResponse(
    '/api/v1/events/subscriptions/name/*'
  );
  const getEventRecords = page.waitForResponse(
    '/api/v1/events/subscriptions/name/*/eventsRecord?listCountOnly=true'
  );
  await page
    .locator(`[data-row-key="${alertDetails.id}"]`)
    .getByText(getEntityDisplayName(alertDetails))
    .click();
  await getAlertDetails;
  await getEventRecords;
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
  eventTypes,
  exclude = false,
}: {
  page: Page;
  filterNumber: number;
  eventTypes: string[];
  exclude?: boolean;
}) => {
  // Select event type filter
  await page.click(`[data-testid="filter-select-${filterNumber}"]`);
  await page.click(`[data-testid="Event Type-filter-option"]:visible`);

  for (const eventType of eventTypes) {
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

    await expect(
      page.getByTestId('event-type-select').getByTitle(startCase(eventType))
    ).toBeAttached();
  }

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
    '/api/v1/search/query?q=**index=domain_search_index*'
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

const checkActionOrFilterDetails = async ({
  page,
  filters,
  isFilter = true,
}: {
  page: Page;
  filters: AlertDetails['input']['filters'];
  isFilter?: boolean;
}) => {
  if (!isEmpty(filters)) {
    for (const filter of filters) {
      const index = filters.indexOf(filter);

      await expect(page.getByTestId(`filter-${index}`)).toBeAttached();

      filter.effect === 'include'
        ? await expect(
            page.getByTestId(
              `${isFilter ? 'filter' : 'trigger'}-switch-${index}`
            )
          ).toHaveClass('ant-switch ant-switch-checked ant-switch-disabled')
        : await expect(
            page.getByTestId(
              `${isFilter ? 'filter' : 'trigger'}-switch-${index}`
            )
          ).not.toHaveClass(
            'ant-switch ant-switch-checked ant-switch-disabled'
          );
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
  const {
    name,
    displayName,
    description,
    filteringRules,
    input,
    destinations,
  } = alertDetails;

  const triggerName = filteringRules.resources[0];
  const filters = input.filters;

  // Check created alert details
  await expect(page.getByTestId('alert-details-container')).toBeAttached();

  // Check alert name
  await expect(page.getByTestId('entity-header-name')).toContainText(name);
  await expect(page.getByTestId('entity-header-display-name')).toContainText(
    displayName
  );

  if (description) {
    // Check alert description
    await expect(page.getByTestId('markdown-parser')).toContainText(
      getTextFromHtmlString(description)
    );
  }

  // Check trigger name
  await expect(page.getByTestId('source-select')).toContainText(triggerName);

  // Check filter details
  await checkActionOrFilterDetails({ page, filters });

  if (isObservabilityAlert) {
    const actions = input.actions;

    // Check action details
    await checkActionOrFilterDetails({
      page,
      filters: actions,
      isFilter: false,
    });
  }

  if (!isEmpty(destinations)) {
    // Check connection timeout details
    await expect(page.getByTestId('connection-timeout-input')).toHaveValue(
      destinations[0].timeout.toString()
    );

    // Check read timeout details
    await expect(page.getByTestId('read-timeout-input')).toHaveValue(
      destinations[0].readTimeout.toString()
    );

    for (const destinationNumber in destinations) {
      await expect(
        page.getByTestId(`destination-${destinationNumber}`)
      ).toBeAttached();
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
  user1: UserClass;
  user2: UserClass;
  domain: Domain;
  dashboard: DashboardClass;
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
    eventTypes: ['entityCreated'],
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
    fieldSelector: '#displayName',
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
      displayName: '',
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

export const createAlert = async ({
  page,
  alertName,
  sourceName,
  sourceDisplayName,
  user,
  createButtonId,
  selectId,
  addTrigger = false,
}: {
  page: Page;
  alertName: string;
  sourceName: string;
  sourceDisplayName: string;
  user: UserClass;
  createButtonId?: string;
  selectId?: string;
  addTrigger?: boolean;
}) => {
  await inputBasicAlertInformation({
    page,
    name: alertName,
    sourceName,
    sourceDisplayName,
    createButtonId,
  });

  // Select filters
  await page.click('[data-testid="add-filters"]');

  await addOwnerFilter({
    page,
    filterNumber: 0,
    ownerName: user.getUserName(),
    selectId,
  });

  if (addTrigger) {
    // Select trigger
    await page.click('[data-testid="add-trigger"]');

    await addGetSchemaChangesAction({
      page,
      filterNumber: 0,
    });

    await page.getByTestId('connection-timeout-input').clear();
    await page.getByTestId('read-timeout-input').clear();
    await page.fill('[data-testid="connection-timeout-input"]', '26');
    await page.fill('[data-testid="read-timeout-input"]', '26');
  }

  // Select Destination
  await page.click('[data-testid="add-destination-button"]');

  await addInternalDestination({
    page,
    destinationNumber: 0,
    category: 'Admins',
    type: 'Email',
  });

  return await saveAlertAndVerifyResponse(page);
};

export const waitForRecentEventsToFinishExecution = async (
  page: Page,
  name: string,
  totalEventsCount: number
) => {
  const { apiContext } = await getApiContext(page);

  await expect
    .poll(
      async () => {
        const response = await apiContext
          .get(
            `/api/v1/events/subscriptions/name/${name}/eventsRecord?listCountOnly=true`
          )
          .then((res) => res.json());

        return (
          response.pendingEventsCount === 0 &&
          response.totalEventsCount === totalEventsCount
        );
      },
      {
        // Custom expect message for reporting, optional.
        message: 'Wait for pending events to complete',
        intervals: [5_000, 10_000, 15_000, 20_000],
        timeout: 900_000,
      }
    )
    // Move ahead when the pending events count is 0
    .toEqual(true);
};

export const checkRecentEventDetails = async ({
  page,
  alertDetails,
  table,
  totalEventsCount,
}: {
  page: Page;
  alertDetails: AlertDetails;
  table: TableClass;
  totalEventsCount: number;
}) => {
  await expect(page.getByTestId('total-events-count')).toHaveText(
    `Total Events: ${totalEventsCount}`
  );

  await expect(page.getByTestId('failed-events-count')).toHaveText(
    'Failed Events: 0'
  );

  // Verify Recent Events tab
  const getRecentEvents = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(
          `/api/v1/events/subscriptions/id/${alertDetails.id}/listEvents?limit=15&paginationOffset=0`
        ) &&
      response.request().method() === 'GET' &&
      response.status() === 200
  );

  await page.getByRole('tab').getByText('Recent Events').click();

  await getRecentEvents.then(async (response) => {
    const recentEvents: EventDetails[] = (await response.json()).data;

    // Check the event details
    for (const event of recentEvents) {
      // Open collapse
      await page.getByTestId(`event-collapse-${event.data[0].id}`).click();

      await page.waitForSelector(
        `[data-testid="event-details-${event.data[0].id}"]`
      );

      // Check if table id is present in event details
      await expect(
        page
          .getByTestId(`event-details-${event.data[0].id}`)
          .getByTestId('event-data-entityId')
          .getByTestId('event-data-value')
      ).toContainText((table.entityResponseData as { id: string }).id);

      // Check if event type is present in event details
      await expect(
        page
          .getByTestId(`event-details-${event.data[0].id}`)
          .getByTestId('event-data-eventType')
          .getByTestId('event-data-value')
      ).toContainText(event.data[0].eventType);

      // Close collapse
      await page.getByTestId(`event-collapse-${event.data[0].id}`).click();
    }
  });

  await page.getByTestId('filter-button').click();

  await page.waitForSelector(
    '.ant-dropdown-menu[role="menu"] [data-menu-id*="failed"]'
  );

  const getFailedEvents = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(
          `/api/v1/events/subscriptions/id/${alertDetails.id}/listEvents?status=failed&limit=15&paginationOffset=0`
        ) &&
      response.request().method() === 'GET' &&
      response.status() === 200
  );

  await page.click('.ant-dropdown-menu[role="menu"] [data-menu-id*="failed"]');

  await getFailedEvents.then(async (response) => {
    const failedEvents: EventDetails[] = (await response.json()).data;

    expect(failedEvents).toHaveLength(0);
  });
};
