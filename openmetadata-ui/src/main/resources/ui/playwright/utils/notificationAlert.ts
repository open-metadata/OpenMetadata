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
import { ALERT_UPDATED_DESCRIPTION } from '../constant/alert';
import { AlertDetails } from '../constant/alert.interface';
import { SidebarItem } from '../constant/sidebar';
import { Domain } from '../support/domain/Domain';
import { DashboardClass } from '../support/entity/DashboardClass';
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';
import { TableClass } from '../support/entity/TableClass';
import { UserClass } from '../support/user/UserClass';
import {
  addEntityFQNFilter,
  addEventTypeFilter,
  addMultipleFilters,
  checkRecentEventDetails,
  inputBasicAlertInformation,
  saveAlertAndVerifyResponse,
  visitAlertDetailsPage,
  visitEditAlertPage,
  waitForRecentEventsToFinishExecution,
} from './alert';
import { clickOutside, descriptionBox, redirectToHomePage } from './common';
import { addMultiOwner, updateDescription } from './entity';
import { addExternalDestination } from './observabilityAlert';
import { sidebarClick } from './sidebar';

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

export const editSingleFilterAlert = async ({
  page,
  alertDetails,
  sourceName,
  sourceDisplayName,
  user1,
  user2,
  domain,
  dashboard,
}: {
  page: Page;
  alertDetails: AlertDetails;
  sourceName: string;
  sourceDisplayName: string;
  user1: UserClass;
  user2: UserClass;
  domain: Domain;
  dashboard: DashboardClass;
}) => {
  await visitEditAlertPage(page, alertDetails);

  // Update description
  await page.locator(descriptionBox).clear();
  await page.locator(descriptionBox).fill(ALERT_UPDATED_DESCRIPTION);

  // Update source
  await page.click('[data-testid="source-select"]');
  await page
    .getByTestId(`${sourceName}-option`)
    .getByText(sourceDisplayName)
    .click();

  // Filters should reset after source change
  await expect(page.getByTestId('filter-select-0')).not.toBeAttached();

  await addMultipleFilters({
    page,
    user1,
    user2,
    domain,
    dashboard,
  });

  await page.getByTestId('connection-timeout-input').clear();
  await page.fill('[data-testid="connection-timeout-input"]', '26');

  await page.getByTestId('read-timeout-input').clear();
  await page.fill('[data-testid="read-timeout-input"]', '26');

  // Add owner GChat destination
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

  // Add user email destination
  await page.click('[data-testid="add-destination-button"]');
  await addInternalDestination({
    page,
    destinationNumber: 2,
    category: 'Users',
    type: 'Email',
    typeId: 'User-select',
    searchText: user1.getUserName(),
  });
};

export const createAlertWithMultipleFilters = async ({
  page,
  alertName,
  sourceName,
  sourceDisplayName,
  user1,
  user2,
  domain,
  dashboard,
}: {
  page: Page;
  alertName: string;
  sourceName: string;
  sourceDisplayName: string;
  user1: UserClass;
  user2: UserClass;
  domain: Domain;
  dashboard: DashboardClass;
}) => {
  await inputBasicAlertInformation({
    page,
    name: alertName,
    sourceName,
    sourceDisplayName,
  });

  await addMultipleFilters({
    page,
    user1,
    user2,
    domain,
    dashboard,
  });

  await page.click('[data-testid="add-destination-button"]');
  await addInternalDestination({
    page,
    destinationNumber: 0,
    category: 'Followers',
    type: 'Email',
  });
  await page.click('[data-testid="add-destination-button"]');
  await addExternalDestination({
    page,
    destinationNumber: 1,
    category: 'Email',
    input: 'test@example.com',
  });
  await page.click('[data-testid="add-destination-button"]');
  await addExternalDestination({
    page,
    destinationNumber: 2,
    category: 'G Chat',
    input: 'https://gchat.com',
  });
  await page.click('[data-testid="add-destination-button"]');
  await addExternalDestination({
    page,
    destinationNumber: 3,
    category: 'Webhook',
    input: 'https://webhook.com',
  });
  await page.click('[data-testid="add-destination-button"]');
  await addExternalDestination({
    page,
    destinationNumber: 4,
    category: 'Ms Teams',
    input: 'https://msteams.com',
  });
  await page.click('[data-testid="add-destination-button"]');
  await addExternalDestination({
    page,
    destinationNumber: 5,
    category: 'Slack',
    input: 'https://slack.com',
  });

  return await saveAlertAndVerifyResponse(page);
};

export const createTaskAlert = async ({
  page,
  alertName,
  sourceName,
  sourceDisplayName,
}: {
  page: Page;
  alertName: string;
  sourceName: string;
  sourceDisplayName: string;
}) => {
  await inputBasicAlertInformation({
    page,
    name: alertName,
    sourceName,
    sourceDisplayName,
  });

  // Select Destination
  await page.click('[data-testid="add-destination-button"]');
  await addInternalDestination({
    page,
    destinationNumber: 0,
    category: 'Owners',
    type: 'Email',
  });
  await page.click('[data-testid="add-destination-button"]');
  await addInternalDestination({
    page,
    destinationNumber: 1,
    category: 'Assignees',
    type: 'Email',
  });

  return await saveAlertAndVerifyResponse(page);
};

export const createConversationAlert = async ({
  page,
  alertName,
  sourceName,
  sourceDisplayName,
}: {
  page: Page;
  alertName: string;
  sourceName: string;
  sourceDisplayName: string;
}) => {
  await inputBasicAlertInformation({
    page,
    name: alertName,
    sourceName,
    sourceDisplayName,
  });

  // Select Destination
  await page.click('[data-testid="add-destination-button"]');
  await addInternalDestination({
    page,
    destinationNumber: 0,
    category: 'Owners',
    type: 'Email',
  });

  return await saveAlertAndVerifyResponse(page);
};

export const checkAlertConfigDetails = async ({
  page,
  sourceName,
}: {
  page: Page;
  sourceName: string;
}) => {
  // Verify alert configs
  await expect(page.getByTestId('source-select')).toHaveText(sourceName);

  await expect(page.getByTestId('filter-select-0')).toHaveText('Event Type');
  await expect(
    page.getByTestId('event-type-select').getByTitle('Entity Restored')
  ).toBeAttached();
  await expect(
    page.getByTestId('event-type-select').getByTitle('Entity Soft Deleted')
  ).toBeAttached();

  await expect(page.getByTestId('filter-select-1')).toHaveText('Entity FQN');

  await expect(page.getByTestId('destination-category-select-0')).toHaveText(
    'Owners'
  );
  await expect(page.getByTestId('destination-type-select-0')).toHaveText(
    'Email'
  );
};

export const checkAlertDetailsForWithPermissionUser = async ({
  page,
  alertDetails,
  sourceName,
  table,
  user,
}: {
  page: Page;
  alertDetails: AlertDetails;
  sourceName: string;
  table: TableClass;
  user: UserClass;
}) => {
  await visitNotificationAlertPage(page);
  await visitAlertDetailsPage(page, alertDetails);

  // Change alert owner
  await addMultiOwner({
    page,
    ownerNames: [user.responseData.displayName],
    activatorBtnDataTestId: 'edit-owner',
    endpoint: EntityTypeEndpoint.NotificationAlert,
    type: 'Users',
  });

  // UpdateDescription
  await updateDescription(page, ALERT_UPDATED_DESCRIPTION, true);

  // Check other configs
  await checkAlertConfigDetails({ page, sourceName });
  await checkRecentEventDetails({
    page,
    alertDetails,
    table,
    totalEventsCount: 2,
  });
};

export const checkAlertFlowForWithoutPermissionUser = async ({
  page,
  alertDetails,
  sourceName,
  table,
}: {
  page: Page;
  alertDetails: AlertDetails;
  sourceName: string;
  table: TableClass;
}) => {
  await visitNotificationAlertPage(page);

  await expect(page.getByTestId('create-notification')).not.toBeAttached();

  await expect(
    page.getByTestId(`alert-edit-${alertDetails.name}`)
  ).not.toBeAttached();

  await expect(
    page.getByTestId(`alert-delete-${alertDetails.name}`)
  ).not.toBeAttached();

  // Wait for events to finish execution
  await waitForRecentEventsToFinishExecution(page, alertDetails.name, 2);

  await visitAlertDetailsPage(page, alertDetails);

  await expect(page.getByTestId('edit-owner')).not.toBeAttached();

  await expect(page.getByTestId('edit-description')).not.toBeAttached();

  await expect(page.getByTestId('edit-button')).not.toBeAttached();

  await expect(page.getByTestId('delete-button')).not.toBeAttached();

  await checkAlertConfigDetails({ page, sourceName });
  await checkRecentEventDetails({
    page,
    alertDetails,
    table,
    totalEventsCount: 2,
  });
};

export const createAlertForRecentEventsCheck = async ({
  page,
  alertName,
  sourceName,
  sourceDisplayName,
  createButtonId,
  table,
}: {
  page: Page;
  alertName: string;
  sourceName: string;
  sourceDisplayName: string;
  user: UserClass;
  createButtonId?: string;
  selectId?: string;
  addTrigger?: boolean;
  table: TableClass;
}) => {
  await inputBasicAlertInformation({
    page,
    name: alertName,
    sourceName,
    sourceDisplayName,
    createButtonId,
  });

  // Add entityFQN filter
  await page.click('[data-testid="add-filters"]');
  await addEntityFQNFilter({
    page,
    filterNumber: 0,
    entityFQN: (table.entityResponseData as { fullyQualifiedName: string })
      .fullyQualifiedName,
  });

  // Add event type filter
  await page.click('[data-testid="add-filters"]');
  await addEventTypeFilter({
    page,
    filterNumber: 1,
    eventTypes: ['entitySoftDeleted', 'entityRestored'],
  });

  // Select Destination
  await page.click('[data-testid="add-destination-button"]');

  await addInternalDestination({
    page,
    destinationNumber: 0,
    category: 'Owners',
    type: 'Email',
  });

  return await saveAlertAndVerifyResponse(page);
};
