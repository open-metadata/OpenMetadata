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

  // Ensure notifications menu item is visible before clicking
  await expect(page.getByTestId('notifications')).toBeVisible();
  await page.click('[data-testid="notifications"]');

  // Wait for both API calls and the click to complete
  await Promise.all([
    page.waitForResponse('/api/v1/events/subscriptions?*'),
    page.waitForResponse(
      '/api/v1/events/subscriptions/name/ActivityFeedAlert?include=all'
    ),
    page.click('[data-testid="notifications.alerts"]'),
  ]);

  // Ensure UI is ready after API responses
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
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
  // Open filter dropdown
  await page.click(`[data-testid="filter-select-${filterNumber}"]`);

  // Select filter option - chain :visible selector inline
  // Wait for dropdown animation to complete and element to be actionable
  const filterOption = page
    .locator('.ant-select-dropdown:visible')
    .getByTestId(filterTestId);
  await expect(filterOption).toBeVisible();
  await expect(filterOption).toBeEnabled();
  await filterOption.click();

  // Verify dropdown closed
  await expect(page.locator('.ant-select-dropdown:visible')).not.toBeVisible();

  // Open user select dropdown
  const userSelectInput = page.locator(
    '[data-testid="user-name-select"] [role="combobox"]'
  );
  await expect(userSelectInput).toBeVisible();
  await userSelectInput.click();
  const awaitResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query?q=') &&
      response.url().includes(encodeURIComponent(updaterName)) &&
      response.url().includes('index=user_search_index')
  );
  // Fill search term and wait for API response
  await userSelectInput.fill(updaterName);
  await awaitResponse;

  // Select user from search results - chain :visible selector inline
  const userOption = page
    .locator('.ant-select-dropdown:visible')
    .locator(`[title="${updaterName}"]`);
  await expect(userOption).toBeVisible();
  await userOption.click();

  // Verify user is selected
  await expect(page.getByTestId('user-name-select')).toHaveText(updaterName);

  // Manually close dropdown if it doesn't auto-close
  await clickOutside(page);

  // Verify dropdown closed
  await expect(page.locator('.ant-select-dropdown:visible')).not.toBeVisible();

  if (exclude) {
    // Change filter effect
    const filterSwitch = page.getByTestId(`filter-switch-${filterNumber}`);
    await expect(filterSwitch).toBeVisible();
    await filterSwitch.click();
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
  // Open destination category dropdown
  const categorySelect = page.getByTestId(
    `destination-category-select-${destinationNumber}`
  );
  await expect(categorySelect).toBeVisible();
  await categorySelect.click();

  // Select category option - chain :visible selector inline
  const categoryOption = page
    .locator('.ant-select-dropdown:visible')
    .locator(`[data-testid="${category}-internal-option"]`);
  await expect(categoryOption).toBeVisible();
  await categoryOption.click();

  // Verify dropdown closed
  await expect(page.locator('.ant-select-dropdown:visible')).not.toBeVisible();

  // Select the receivers with proper waiting
  if (typeId) {
    if (category === 'Teams' || category === 'Users') {
      const dropdownTrigger = page.locator(
        `[data-testid="destination-${destinationNumber}"] [data-testid="dropdown-trigger-button"]`
      );
      await expect(dropdownTrigger).toBeVisible();
      await dropdownTrigger.click();

      const searchInput = page.locator(
        `[data-testid="team-user-select-dropdown-${destinationNumber}"]:visible [data-testid="search-input"]`
      );
      await expect(searchInput).toBeVisible();

      const getSearchResult = page.waitForResponse('/api/v1/search/query?q=*');
      await searchInput.fill(searchText);
      await getSearchResult;

      // Wait for search results to render
      const resultsDropdown = page.locator('.ant-dropdown:visible');
      await resultsDropdown.waitFor({ state: 'visible' });

      const option = resultsDropdown.locator(
        `[data-testid="${searchText}-option-label"]`
      );
      await expect(option).toBeVisible();
      await option.click();
    } else {
      const input = page.getByTestId(typeId);
      await expect(input).toBeVisible();

      const getSearchResult = page.waitForResponse('/api/v1/search/query?q=*');
      await input.fill(searchText);
      await getSearchResult;

      // Select option from search results - chain :visible selector inline
      const option = page
        .locator('.ant-select-dropdown:visible')
        .locator(`[title="${searchText}"]`);
      await expect(option).toBeVisible();
      await option.click();
    }

    // Manually close dropdown
    await clickOutside(page);

    // Verify dropdown closed
    await expect(
      page.locator('.ant-select-dropdown:visible')
    ).not.toBeVisible();
  }

  // Select destination type with proper waiting
  const typeSelect = page.getByTestId(
    `destination-type-select-${destinationNumber}`
  );
  await expect(typeSelect).toBeVisible();
  await typeSelect.click();

  // Wait for type dropdown to be visible
  const typeDropdown = page.locator('.select-options-container:visible');
  await typeDropdown.waitFor({ state: 'visible' });

  const typeOption = typeDropdown.locator(
    `[data-testid="${type}-external-option"]`
  );
  await expect(typeOption).toBeVisible();
  await typeOption.click();

  // Verify the selection
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
    searchText: user1.getUserDisplayName(),
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
