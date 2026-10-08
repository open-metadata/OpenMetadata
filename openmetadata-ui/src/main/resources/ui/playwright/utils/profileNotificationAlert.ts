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

import { expect, Locator, Page } from '@playwright/test';
import { ALERT_DESCRIPTION } from '../constant/alert';
import { AlertDetails, EventDetails } from '../constant/alert.interface';
import { ACTION_TIMEOUT } from '../constant/common';
import { enableAiAppMode } from '../e2e/Utils/appMode';
import { TableClass } from '../support/entity/TableClass';
import {
  chooseSelectOption,
  redirectToHomePage,
  toastNotification,
} from './common';
import { selectDropdownOption } from './destination';
import { getEntityDisplayName, waitForAllLoadersToDisappear } from './entity';

// ─── CoreUI Select helper ─────────────────────────────────────────────────────

/**
 * Select an option in a CoreUI Select inside a modal.
 * Unlike `selectDropdownOption` this does NOT blur the trigger afterward —
 * blurring inside a ModalOverlay moves focus outside the modal and React
 * Aria's focus containment then intercepts all subsequent pointer events.
 */
export const selectCoreUIOption = async (
  page: Page,
  testId: string,
  optionName: string
) => {
  const trigger = page.getByTestId(testId).getByRole('button');
  await expect(trigger).toBeVisible();
  await trigger.focus();

  let listboxId = '';
  await expect(async () => {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click();
    }
    await expect(trigger).toHaveAttribute('aria-expanded', 'true', {
      timeout: 2_000,
    });
    listboxId = (await trigger.getAttribute('aria-controls')) ?? '';
    expect(listboxId).toBeTruthy();
  }).toPass({ timeout: 10_000 });

  const listbox = page.locator(`[role="listbox"][id="${listboxId}"]`);
  await listbox.getByRole('option', { exact: true, name: optionName }).click();
  await expect(listbox).toBeHidden();
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

  await expect(option).toBeVisible({ timeout: ACTION_TIMEOUT });
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
  await selectCoreUIOption(page, `filters-select-${filterNumber}`, filterName);

  if (exclude) {
    const ruleRow = page.getByTestId(`filters-${filterNumber}`);
    const toggle = ruleRow.getByTestId('toggle-root');
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
    testId: 'ownerNameList-autocomplete',
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
    testId: 'fqnList-autocomplete',
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
    const input = page
      .getByTestId('eventTypeList-autocomplete')
      .getByRole('combobox');
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
    testId: 'domainList-autocomplete',
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
    testId: 'updateByUserList-autocomplete',
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
    testId: 'userList-autocomplete',
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
    eventTypes: ['Entity Created'],
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
 * Fill a controlled input and assert the value landed. One fill, one assertion — no retry: the
 * functional-updater fix means writes no longer clobber each other, so a value that fails to stick
 * is a real regression this must surface, not hide.
 */
const fillAndVerify = async (input: Locator, value: string) => {
  await input.fill(value);
  await expect(input).toHaveValue(value);
};

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
  await chooseSelectOption(
    page.getByTestId(`destination-category-select-${destinationNumber}`),
    page
      .getByRole('listbox', { name: /destination/i })
      .getByRole('option', { name: category, exact: true })
  );

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

/**
 * Add an external destination in the profile notification form (AI mode).
 * The AI form uses different testids than the legacy form (no `-field` suffix).
 */
export const addExternalDestinationProfile = async ({
  page,
  destinationNumber,
  category,
  input = '',
  advancedConfig,
}: {
  page: Page;
  destinationNumber: number;
  category: string;
  input?: string;
  advancedConfig?: {
    headers?: Array<{ key: string; value: string }>;
    queryParams?: Array<{ key: string; value: string }>;
  };
}) => {
  await chooseSelectOption(
    page.getByTestId(`destination-category-select-${destinationNumber}`),
    page
      .getByRole('listbox', { name: /destination/i })
      .getByRole('option', { name: category, exact: true })
  );

  if (category === 'Email') {
    const emailInput = page.getByTestId(`email-input-${destinationNumber}`);
    await fillAndVerify(emailInput.locator('input'), input);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId(`email-tag-${input}`)).toBeVisible();
  } else {
    const endpointInput = page.getByTestId(
      `endpoint-input-${destinationNumber}`
    );
    await fillAndVerify(endpointInput.locator('input'), input);
  }

  if (advancedConfig) {
    const dest = page.getByTestId(`destination-${destinationNumber}`);
    const accordionTrigger = dest.getByRole('button', {
      exact: true,
      name: 'Advanced Configuration',
    });

    if (
      (await accordionTrigger.isVisible()) &&
      (await accordionTrigger.getAttribute('aria-expanded')) !== 'true'
    ) {
      await accordionTrigger.click();
    }

    if (advancedConfig.headers) {
      for (let i = 0; i < advancedConfig.headers.length; i++) {
        const h = advancedConfig.headers[i];
        await page
          .getByTestId(`add-header-button-${destinationNumber}`)
          .click();
        await fillAndVerify(
          page
            .getByTestId(`header-key-input-${destinationNumber}-${i}`)
            .locator('input'),
          h.key
        );
        await fillAndVerify(
          page
            .getByTestId(`header-value-input-${destinationNumber}-${i}`)
            .locator('input'),
          h.value
        );
      }
    }

    if (advancedConfig.queryParams) {
      for (let i = 0; i < advancedConfig.queryParams.length; i++) {
        const qp = advancedConfig.queryParams[i];
        await page
          .getByTestId(`add-query-param-button-${destinationNumber}`)
          .click();
        await fillAndVerify(
          page
            .getByTestId(`query-param-key-input-${destinationNumber}-${i}`)
            .locator('input'),
          qp.key
        );
        await fillAndVerify(
          page
            .getByTestId(`query-param-value-input-${destinationNumber}-${i}`)
            .locator('input'),
          qp.value
        );
      }
    }
  }
};

// ─── Navigation helpers ──────────────────────────────────────────────────────

export const navigateToNotificationLanding = async (
  page: Page
): Promise<void> => {
  await enableAiAppMode(page);
  await redirectToHomePage(page);

  await expect(page.getByTestId('ask-ai-user-menu-trigger')).toBeVisible();
  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await page.getByTestId('ai-profile-page').waitFor();
  await page.getByTestId('profile-nav-notification').click();
  await page.getByTestId('notification-landing').waitFor();
};

export const navigateToAlertsList = async (page: Page): Promise<void> => {
  await navigateToNotificationLanding(page);

  const alertsResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/events/subscriptions') &&
      res.url().includes('alertType=Notification') &&
      res.request().method() === 'GET'
  );
  await page.getByTestId('notification-card-alerts').click();
  await alertsResponse;
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('alerts-list-container')).toBeVisible();
};

export const inputAlertInformation = async ({
  page,
  name,
  sourceName,
}: {
  page: Page;
  name: string;
  sourceName: string;
}) => {
  const nameInput = page.getByRole('textbox', { name: /name/i });
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);

  const descriptionTextArea = page
    .getByTestId('description')
    .getByRole('textbox');
  await expect(descriptionTextArea).toBeVisible();
  await descriptionTextArea.fill(ALERT_DESCRIPTION);

  const sourceSelect = page.getByTestId('source-select');
  await expect(sourceSelect).toBeVisible();
  await sourceSelect.click();
  await page.getByRole('option', { name: new RegExp(sourceName, 'i') }).click();
};

export const saveNewAlertAndVerify = async (
  page: Page
): Promise<AlertDetails> => {
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/api/v1/events/subscriptions') &&
      !response.url().includes('testDestination')
  );

  await page.getByTestId('save-btn').click();
  const response = await createResponse;
  expect(response.status(), 'Create alert API should return 201').toBe(201);
  const alertDetails = await response.json();

  await toastNotification(page, 'Alerts created successfully.');

  return alertDetails;
};

const findPageWithAlert = async (
  page: Page,
  alertDetails: AlertDetails
): Promise<void> => {
  await waitForAllLoadersToDisappear(page);

  const container = page.getByTestId('alerts-list-container');
  await expect(container.locator('[data-testid^="alert-"]')).not.toHaveCount(
    0,
    { timeout: 10_000 }
  );

  const alertRow = page.getByTestId(
    `alert-${getEntityDisplayName(alertDetails)}`
  );
  const nextButton = container.getByTestId('next');

  if (await alertRow.isVisible()) {
    return;
  }

  if (!(await nextButton.isVisible()) || !(await nextButton.isEnabled())) {
    throw new Error(
      `Alert "${alertDetails.name}" not found on any page of the alerts list.`
    );
  }

  const getAlerts = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/events/subscriptions') &&
      res.request().method() === 'GET'
  );
  await nextButton.click();
  await getAlerts;
  await findPageWithAlert(page, alertDetails);
};

export const navigateToAlertDetail = async (
  page: Page,
  alertDetails: AlertDetails
): Promise<void> => {
  await findPageWithAlert(page, alertDetails);

  const displayName = getEntityDisplayName(alertDetails);
  const alertRow = page.getByTestId(`alert-${displayName}`);

  const detailResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/events/subscriptions/name/') &&
      res.request().method() === 'GET'
  );

  await alertRow.getByTestId('alert-name').click();
  await detailResponse;
  await waitForAllLoadersToDisappear(page);
};

export const navigateToEditAlert = async (
  page: Page,
  alertDetails: AlertDetails
): Promise<void> => {
  await findPageWithAlert(page, alertDetails);
  const displayName = getEntityDisplayName(alertDetails);
  await page.getByTestId(`alert-edit-${displayName}`).click();
};

export const deleteAlertFromList = async (
  page: Page,
  alertDetails: AlertDetails
): Promise<void> => {
  await findPageWithAlert(page, alertDetails);

  const displayName = getEntityDisplayName(alertDetails);

  await page.getByTestId(`alert-delete-${displayName}`).click();

  const deleteResponse = page.waitForResponse(
    (response) => response.request().method() === 'DELETE'
  );
  await page.getByTestId('confirm-button').click();
  expect((await deleteResponse).status()).toBe(200);
  await toastNotification(page, `"${displayName}" deleted successfully!`);
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
