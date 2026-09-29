/*
 *  Copyright 2025 Collate.
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
import { clickAndWaitFor } from './waitHelpers';

export const enableDisableAutoPilotApplication = async (
  apiContext: APIRequestContext,
  enable = true
) => {
  await apiContext.patch('/api/v1/apps/name/AutoPilotApplication', {
    data: [{ op: 'replace', path: '/appConfiguration/active', value: enable }],
    headers: {
      'Content-Type': 'application/json-patch+json',
    },
  });
};

const APPLICATION_CARD = '[data-testid$="-application-card"]';

/**
 * The two paginated application lists. They share a card testid and paging
 * controls and differ only in the endpoint a page turn hits, so both are
 * walked by the same code.
 */
export const APPLICATION_LIST = {
  installed: { api: /\/api\/v1\/apps\?/, label: 'applications list' },
  marketplace: { api: /\/api\/v1\/apps\/marketplace/, label: 'marketplace' },
} as const;

type ApplicationList = (typeof APPLICATION_LIST)[keyof typeof APPLICATION_LIST];

const waitForApplicationCards = async (page: Page) => {
  await expect(page.locator(APPLICATION_CARD)).not.toHaveCount(0);
};

/**
 * Walk an application list from the current page onwards, stopping as soon as
 * the card is on screen. Returns whether it was found anywhere.
 *
 * Both lists paginate at PAGE_SIZE_BASE (15) and the bundled app count grows
 * whenever a new application ships, so a card sitting on page 1 today silently
 * moves to page 2 the next time one is added. Anything that asserts on a
 * card's presence or absence has to page, or it is really only asserting about
 * page 1.
 */
const isOnAnyApplicationPage = async (
  page: Page,
  cardTestId: string,
  list: ApplicationList
) => {
  await waitForApplicationCards(page);

  const card = page.getByTestId(cardTestId);
  const nextPage = page.getByTestId('next');

  while (!(await card.isVisible())) {
    const canPage =
      (await nextPage.isVisible()) && (await nextPage.isEnabled());

    if (!canPage) {
      return false;
    }

    await clickAndWaitFor(page, nextPage, list.api);

    // The list swaps its cards for skeletons while loading, so the next card
    // to appear can only belong to the page we just moved to.
    await waitForApplicationCards(page);
  }

  return true;
};

/**
 * Bring an installed application's card on screen and return its locator,
 * paging until it is found. Throws when no page holds it.
 */
export const findApplicationCard = async (
  page: Page,
  cardTestId: string,
  list: ApplicationList = APPLICATION_LIST.installed
) => {
  const isFound = await isOnAnyApplicationPage(page, cardTestId, list);

  if (!isFound) {
    throw new Error(
      `${cardTestId} was not found on any page of the ${list.label}`
    );
  }

  return page.getByTestId(cardTestId);
};

/**
 * Assert an application is installed, paging until its card is found. Use this
 * rather than a bare toBeVisible(), which only ever asserts about page 1.
 */
export const expectApplicationInstalled = async (
  page: Page,
  cardTestId: string
) => {
  expect(
    await isOnAnyApplicationPage(page, cardTestId, APPLICATION_LIST.installed),
    `${cardTestId} should be on some page of the applications list`
  ).toBe(true);
};

/**
 * Assert an application is not installed. A bare toBeHidden() cannot tell
 * "uninstalled" from "on a later page", so it passes even when the uninstall
 * silently failed.
 */
export const expectApplicationNotInstalled = async (
  page: Page,
  cardTestId: string
) => {
  expect(
    await isOnAnyApplicationPage(page, cardTestId, APPLICATION_LIST.installed),
    `${cardTestId} should not be on any page of the applications list`
  ).toBe(false);
};

/**
 * Open an installed application's details page from Settings > Applications,
 * paging to its card first. Assumes the applications list is already open.
 */
export const openApplicationDetails = async (
  page: Page,
  cardTestId: string
) => {
  const card = await findApplicationCard(page, cardTestId);

  await card.getByTestId('config-btn').click();
};
