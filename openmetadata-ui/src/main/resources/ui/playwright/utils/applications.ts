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
const APPLICATIONS_LIST_API = /\/api\/v1\/apps\?/;

const waitForApplicationCards = async (page: Page) => {
  await expect(page.locator(APPLICATION_CARD)).not.toHaveCount(0);
};

/**
 * Walk the installed applications list from the current page onwards, stopping
 * as soon as the card is on screen. Returns whether it was found anywhere.
 *
 * The list paginates at PAGE_SIZE_BASE (15) and the installed app count grows
 * whenever a new application ships, so a card sitting on page 1 today silently
 * moves to page 2 the next time one is added.
 */
const isOnAnyApplicationPage = async (page: Page, cardTestId: string) => {
  await waitForApplicationCards(page);

  const card = page.getByTestId(cardTestId);
  const nextPage = page.getByTestId('next');

  while (!(await card.isVisible())) {
    const canPage =
      (await nextPage.isVisible()) && (await nextPage.isEnabled());

    if (!canPage) {
      return false;
    }

    await clickAndWaitFor(page, nextPage, APPLICATIONS_LIST_API);

    // The list swaps its cards for skeletons while loading, so the next card
    // to appear can only belong to the page we just moved to.
    await waitForApplicationCards(page);
  }

  return true;
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
    await isOnAnyApplicationPage(page, cardTestId),
    `${cardTestId} should be on some page of the applications list`
  ).toBe(true);
};

/**
 * Open an installed application's details page from Settings > Applications,
 * paging to its card first. Assumes the applications list is already open.
 */
export const openApplicationDetails = async (
  page: Page,
  cardTestId: string
) => {
  await expectApplicationInstalled(page, cardTestId);

  await page.getByTestId(cardTestId).getByTestId('config-btn').click();
};
