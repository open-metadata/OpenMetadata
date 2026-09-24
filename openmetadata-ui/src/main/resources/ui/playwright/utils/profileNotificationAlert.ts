/*
 *  Copyright 2026 Collate.
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

/**
 * Playwright helpers for the Profile-page notification alert form.
 *
 * The new form uses CoreUI components (react-aria) — not antd — so the legacy
 * filter/destination utils from `utils/alert.ts` and `utils/notificationAlert.ts`
 * (which target `.ant-select-dropdown:visible`) don't work here.
 *
 * This file provides CoreUI-compatible replacements. Legacy utils are NOT modified.
 */

import { expect, Page } from '@playwright/test';
import { AlertDetails, EventDetails } from '../constant/alert.interface';
import { TableClass } from '../support/entity/TableClass';
import { selectDropdownOption } from './destination';

// ─── CoreUI Select helper ─────────────────────────────────────────────────────

/**
 * Select an option in a CoreUI Select component identified by data-testid.
 * CoreUI Select trigger is role="button", options are role="option".
 */
export const selectCoreUIOption = async (
  page: Page,
  testId: string,
  optionName: string
) => {
  const trigger = page.getByTestId(testId).getByRole('button');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const listbox = page.getByRole('listbox');
  const option = page.getByRole('option', { name: optionName, exact: true });
  await expect(option).toBeVisible();
  await option.click();
  await listbox.waitFor({ state: 'detached' });
};

// ─── CoreUI Autocomplete helper ───────────────────────────────────────────────

/**
 * Type into a CoreUI Autocomplete (combobox) and select a matching option.
 * Waits for the search API response before selecting.
 */
const fillAutocompleteAndSelect = async ({
  page,
  testId,
  searchText,
  waitForApi = true,
}: {
  page: Page;
  testId: string;
  searchText: string;
  waitForApi?: boolean;
}) => {
  const input = page.getByTestId(testId).getByRole('combobox');
  await expect(input).toBeVisible();
  await input.click();

  if (waitForApi) {
    const apiResponse = page.waitForResponse('/api/v1/search/query?q=*');
    await input.fill(searchText);
    await apiResponse;
  } else {
    await input.fill(searchText);
  }

  const option = page.getByRole('option', {
    name: new RegExp(searchText, 'i'),
  });

  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await input.press('Tab');
};

// ─── Filter helpers (CoreUI replacements for legacy antd-based utils) ─────────

/**
 * Add a filter row, select a filter type from the CoreUI Select, and optionally
 * toggle the include/exclude switch.
 */
const selectFilterType = async ({
  page,
  filterNumber,
  filterName,
  exclude = false,
}: {
  page: Page;
  filterNumber: number;
  filterName: string;
  exclude?: boolean;
}) => {
  await selectCoreUIOption(page, `filter-select-${filterNumber}`, filterName);

  if (exclude) {
    const toggle = page.getByTestId(`filter-switch-${filterNumber}`);
    await expect(toggle).toBeVisible();
    await toggle.click();
  }
};

export const addOwnerFilterProfile = async ({
  page,
  filterNumber,
  ownerName,
  exclude = false,
}: {
  page: Page;
  filterNumber: number;
  ownerName: string;
  exclude?: boolean;
}) => {
  await selectFilterType({ page, filterNumber, filterName: 'Owner', exclude });

  await fillAutocompleteAndSelect({
    page,
    testId: 'owner-name-select',
    searchText: ownerName,
  });
};

export const addEntityFQNFilterProfile = async ({
  page,
  filterNumber,
  entityFQN,
  exclude = false,
}: {
  page: Page;
  filterNumber: number;
  entityFQN: string;
  exclude?: boolean;
}) => {
  await selectFilterType({
    page,
    filterNumber,
    filterName: 'Entity FQN',
    exclude,
  });

  await fillAutocompleteAndSelect({
    page,
    testId: 'fqn-list-select',
    searchText: entityFQN,
  });
};

export const addEventTypeFilterProfile = async ({
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
  await selectFilterType({
    page,
    filterNumber,
    filterName: 'Event Type',
    exclude,
  });

  for (const eventType of eventTypes) {
    const input = page.getByTestId('event-type-select').getByRole('combobox');
    await expect(input).toBeVisible();
    await input.click();
    await input.fill(eventType);

    const option = page.getByRole('option', {
      name: eventType,
      exact: true,
    });
    await expect(option).toBeVisible();
    await option.click();
    await input.press('Tab');
  }
};

export const addDomainFilterProfile = async ({
  page,
  filterNumber,
  domainDisplayName,
  exclude = false,
}: {
  page: Page;
  filterNumber: number;
  domainDisplayName: string;
  exclude?: boolean;
}) => {
  await selectFilterType({
    page,
    filterNumber,
    filterName: 'Domain',
    exclude,
  });

  await fillAutocompleteAndSelect({
    page,
    testId: 'domain-select',
    searchText: domainDisplayName,
  });
};

export const addUpdaterNameFilterProfile = async ({
  page,
  filterNumber,
  updaterName,
  exclude = false,
}: {
  page: Page;
  filterNumber: number;
  updaterName: string;
  exclude?: boolean;
}) => {
  await selectFilterType({
    page,
    filterNumber,
    filterName: 'Updater Name',
    exclude,
  });

  await fillAutocompleteAndSelect({
    page,
    testId: 'updater-name-select',
    searchText: updaterName,
  });
};

export const addGMEFilterProfile = async ({
  page,
  filterNumber,
  exclude = false,
}: {
  page: Page;
  filterNumber: number;
  exclude?: boolean;
}) => {
  await selectFilterType({
    page,
    filterNumber,
    filterName: 'General Metadata Events',
    exclude,
  });
};

export const addMentionedUsersFilterProfile = async ({
  page,
  filterNumber,
  userName,
  exclude = false,
}: {
  page: Page;
  filterNumber: number;
  userName: string;
  exclude?: boolean;
}) => {
  await selectFilterType({
    page,
    filterNumber,
    filterName: 'Mentioned Users',
    exclude,
  });

  await fillAutocompleteAndSelect({
    page,
    testId: 'user-name-select',
    searchText: userName,
  });
};

/**
 * Add 6 filters (owner, entityFQN, eventType, updaterName, domain, GME).
 * CoreUI replacement for `addMultipleFilters` from `utils/alert.ts`.
 */
export const addMultipleFiltersProfile = async ({
  page,
  user1,
  user2,
  domain,
  dashboard,
}: {
  page: Page;
  user1: { getUserDisplayName: () => string };
  user2: { getUserDisplayName: () => string };
  domain: { responseData: { name: string; displayName: string } };
  dashboard: {
    entityResponseData: { fullyQualifiedName?: string } | undefined;
  };
}) => {
  await page.getByTestId('add-filters').click();
  await addOwnerFilterProfile({
    page,
    filterNumber: 0,
    ownerName: user1.getUserDisplayName(),
  });

  await page.getByTestId('add-filters').click();
  await addEntityFQNFilterProfile({
    page,
    filterNumber: 1,
    entityFQN: (dashboard.entityResponseData as { fullyQualifiedName: string })
      .fullyQualifiedName,
    exclude: true,
  });

  await page.getByTestId('add-filters').click();
  await addEventTypeFilterProfile({
    page,
    filterNumber: 2,
    eventTypes: ['entityCreated'],
  });

  await page.getByTestId('add-filters').click();
  await addUpdaterNameFilterProfile({
    page,
    filterNumber: 3,
    updaterName: user2.getUserDisplayName(),
    exclude: true,
  });

  await page.getByTestId('add-filters').click();
  await addDomainFilterProfile({
    page,
    filterNumber: 4,
    domainDisplayName: domain.responseData.displayName,
  });

  await page.getByTestId('add-filters').click();
  await addGMEFilterProfile({ page, filterNumber: 5 });
};

// ─── Destination helper ───────────────────────────────────────────────────────

/**
 * Add an internal destination in the profile notification form.
 * Waits for the conditional type-select to mount after category selection.
 */
export const addInternalDestinationProfile = async ({
  page,
  destinationNumber,
  category,
  type,
}: {
  page: Page;
  destinationNumber: number;
  category: string;
  type: string;
}) => {
  // Select category via combobox
  const categoryInput = page
    .getByTestId(`destination-category-select-${destinationNumber}`)
    .getByRole('combobox');
  await expect(categoryInput).toBeVisible();
  await categoryInput.click();
  await categoryInput.fill('');
  await categoryInput.press('ArrowDown');

  const option = page.getByRole('option', { exact: true, name: category });
  await expect(option).toBeVisible();
  await option.click();

  // Wait for the remounted row to settle and the conditional type-select to appear
  const typeSelect = page.getByTestId(
    `destination-type-select-${destinationNumber}`
  );
  await expect(typeSelect).toBeVisible({ timeout: 30_000 });

  await selectDropdownOption({
    page,
    testId: `destination-type-select-${destinationNumber}`,
    optionName: type,
  });

  await page
    .getByRole('listbox')
    .waitFor({ state: 'detached' })
    .catch(() => undefined);
};

// ─── Recent events ────────────────────────────────────────────────────────────

/**
 * Profile-page replacement for `checkRecentEventDetails`.
 * Uses CoreUI Tabs and Dropdown instead of antd.
 */
export const checkRecentEventDetailsProfile = async ({
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
  const getRecentEvents = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(
          `/api/v1/events/subscriptions/id/${alertDetails.id}/listEvents?limit=15&paginationOffset=0`
        ) && response.request().method() === 'GET'
  );

  await page.getByRole('tab', { name: /recent event/i }).click();

  const recentResponse = await getRecentEvents;
  expect(recentResponse.status()).toBe(200);

  await recentResponse.json().then(async (json) => {
    const recentEvents: EventDetails[] = json.data;

    expect(recentEvents.length).toBeGreaterThanOrEqual(totalEventsCount);

    for (const event of recentEvents) {
      await page.getByTestId(`event-collapse-${event.data[0].id}`).click();
      await page.getByTestId(`event-details-${event.data[0].id}`).waitFor();

      await expect(
        page
          .getByTestId(`event-details-${event.data[0].id}`)
          .getByTestId('event-data-entityId')
          .getByTestId('event-data-value')
      ).toContainText((table.entityResponseData as { id: string }).id);

      await expect(
        page
          .getByTestId(`event-details-${event.data[0].id}`)
          .getByTestId('event-data-eventType')
          .getByTestId('event-data-value')
      ).toContainText(event.data[0].eventType);

      await page.getByTestId(`event-collapse-${event.data[0].id}`).click();
    }
  });

  await page.getByTestId('filter-button').click();
  const failedOption = page.getByRole('menuitemradio', { name: /failed/i });
  await expect(failedOption).toBeVisible();

  const getFailedEvents = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(
          `/api/v1/events/subscriptions/id/${alertDetails.id}/listEvents?status=failed&limit=15&paginationOffset=0`
        ) && response.request().method() === 'GET'
  );

  await failedOption.click();

  const failedResponse = await getFailedEvents;
  expect(failedResponse.status()).toBe(200);

  await failedResponse.json().then(async (json) => {
    const failedEvents: EventDetails[] = json.data;

    expect(failedEvents).toHaveLength(0);
  });
};
