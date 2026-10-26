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
import { APIRequestContext, expect, Locator, Page } from '@playwright/test';
import { DateTime } from 'luxon';
import {
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../../utils/common';
import { pickDateInCorePicker } from '../../../utils/dateTime';
import { getRowByName } from '../../../utils/scopedLocators';
import { test } from '../../fixtures/pages';

const DAY = 24 * 60 * 60 * 1000;
const LIST_PATH = '/settings/notifications/announcements';
const ANNOUNCEMENTS_PATH = /^\/api\/v1\/announcements(\/[^/]+)?$/;

interface SeededAnnouncement {
  id: string;
  name: string;
  displayName: string;
}

// One token per run, in every title, so search and cleanup see only this spec's rows.
const RUN = `sysann${uuid()}`;

const seedAnnouncement = async (
  apiContext: APIRequestContext,
  title: string,
  window: { startTime: number; endTime: number },
  type = 'Notice'
): Promise<SeededAnnouncement> => {
  const response = await apiContext.post('/api/v1/announcements', {
    // No entityLink: that is what makes it a system announcement.
    data: {
      displayName: `${title} ${RUN}`,
      description: `${title} body`,
      type,
      ...window,
    },
  });

  expect(
    response.ok(),
    `seed ${title}: ${response.status()} ${await response.text()}`
  ).toBe(true);

  return response.json();
};

const live = () => ({
  startTime: Date.now() - DAY,
  endTime: Date.now() + DAY,
});

const openList = async (page: Page) => {
  const listed = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/announcements?') &&
      response.url().includes('system=true')
  );
  await page.goto(LIST_PATH);
  await listed;

  await expect(page.getByTestId('system-announcements-page')).toBeVisible();
};

// Search filters the fetched list by title in the browser; no request to wait for.
const searchList = async (page: Page, term: string) => {
  await page.getByTestId('announcement-search').locator('input').fill(term);
};

// Matched on method as well as path: the form's own GET of the source
// announcement, or a list refetch, can land first on the same path.
const clickAndWaitForWrite = async (
  page: Page,
  trigger: Locator,
  method: 'POST' | 'PATCH' | 'DELETE',
  expectedStatus = 200
) => {
  const written = page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      ANNOUNCEMENTS_PATH.test(new URL(response.url()).pathname)
  );
  await trigger.click();
  const response = await written;

  expect(response.status()).toBe(expectedStatus);

  return response;
};

const rowActions = async (page: Page, name: string, action: string) => {
  await page.getByTestId(`announcement-actions-${name}`).click();
  await page.getByRole('menuitem', { name: action }).click();
};

test.describe('System announcements in Settings → Notifications', () => {
  test.afterAll(async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const response = await apiContext.get(
      '/api/v1/announcements?system=true&limit=1000'
    );
    const { data } = (await response.json()) as {
      data: SeededAnnouncement[];
    };

    await Promise.all(
      data
        .filter(({ displayName }) => displayName?.includes(RUN))
        .map(({ id }) =>
          apiContext.delete(`/api/v1/announcements/${id}?hardDelete=true`)
        )
    );
    await afterAction();
  });

  test('an admin reaches the list from the Notifications card', async ({
    page,
  }) => {
    await page.goto('/settings/notifications');

    const card = page.getByTestId('notifications.announcements');

    await expect(card).toBeVisible();

    const listed = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/announcements?') &&
        response.url().includes('system=true')
    );
    await card.click();
    await listed;

    await expect(page).toHaveURL(new RegExp(`${LIST_PATH}$`));
  });

  test('an admin creates an announcement and sees it scheduled in the list', async ({
    page,
  }) => {
    const title = `Release notes ${RUN}`;
    const start = DateTime.now().plus({ days: 2 });

    await openList(page);
    await page.getByTestId('add-announcement').click();

    await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/add$`));

    await page.getByTestId(`announcement-type-${'Deprecation'}`).click();
    await page.locator('#title').fill(title);
    await pickDateInCorePicker(
      page,
      page.getByTestId('startTime').getByRole('button'),
      start.toISODate() ?? ''
    );
    await pickDateInCorePicker(
      page,
      page.getByTestId('endTime').getByRole('button'),
      start.plus({ days: 3 }).toISODate() ?? ''
    );
    await page.locator(descriptionBox).fill('Glossary API v1 is retired.');

    // The live preview follows the form before anything is saved.
    await expect(page.getByTestId('announcement-preview')).toContainText(title);
    await expect(page.getByTestId('announcement-preview-status')).toContainText(
      'Scheduled'
    );

    const created = await clickAndWaitForWrite(
      page,
      page.getByTestId('announcement-submit'),
      'POST',
      201
    );
    const body = (await created.json()) as { entityLink?: string };

    expect(body.entityLink).toBeUndefined();
    await expect(page).toHaveURL(new RegExp(`${LIST_PATH}$`));

    await searchList(page, title);

    const row = getRowByName(page, title);

    await expect(row).toContainText('Deprecation');
    await expect(row).toContainText('Scheduled');
  });

  test('search narrows by title; status filters on the server', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    const critical = await seedAnnouncement(
      apiContext,
      'Search outage',
      live(),
      'Critical'
    );
    const expired = await seedAnnouncement(apiContext, 'Old release', {
      startTime: Date.now() - 3 * DAY,
      endTime: Date.now() - 2 * DAY,
    });
    await afterAction();

    await openList(page);
    await searchList(page, RUN);

    await expect(getRowByName(page, critical.displayName)).toBeVisible();
    await expect(getRowByName(page, expired.displayName)).toBeVisible();

    const filtered = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/announcements?') &&
        response.url().includes('status=Expired')
    );
    await page.getByTestId('announcement-status-filter').click();
    await page.getByRole('menuitemradio', { name: 'Expired' }).click();
    await filtered;

    await expect(getRowByName(page, expired.displayName)).toBeVisible();
    await expect(getRowByName(page, critical.displayName)).toHaveCount(0);

    await page.getByTestId('announcement-clear-filters').click();

    await expect(
      page.getByTestId('announcement-search').locator('input')
    ).toHaveValue('');
  });

  test('an admin edits, duplicates and deletes from the row menu', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    const seeded = await seedAnnouncement(apiContext, 'Town hall', live());
    await afterAction();

    await openList(page);
    await searchList(page, seeded.displayName);

    // Edit
    await rowActions(page, seeded.name, 'Edit');

    await expect(page).toHaveURL(new RegExp(`/edit/${seeded.id}$`));

    const editedTitle = `Town hall moved ${RUN}`;
    await page.locator('#title').fill(editedTitle);
    await clickAndWaitForWrite(
      page,
      page.getByTestId('announcement-submit'),
      'PATCH'
    );
    await searchList(page, editedTitle);

    await expect(getRowByName(page, editedTitle)).toBeVisible();

    // Duplicate: the form opens pre-filled, and saving makes a second row.
    await rowActions(page, seeded.name, 'Duplicate');

    await expect(page.locator('#title')).toHaveValue(`${editedTitle} (copy)`);

    await clickAndWaitForWrite(
      page,
      page.getByTestId('announcement-submit'),
      'POST',
      201
    );
    await searchList(page, editedTitle);

    await expect(getRowByName(page, `${editedTitle} (copy)`)).toBeVisible();

    // Delete, behind a confirmation.
    await rowActions(page, seeded.name, 'Delete');

    await expect(page.getByTestId('announcement-delete-confirm')).toBeVisible();

    await clickAndWaitForWrite(page, page.getByTestId('save-button'), 'DELETE');

    await expect(
      page.getByTestId(`announcement-row-${seeded.name}`)
    ).toHaveCount(0);
  });

  test('a non-admin sees no Announcements card and cannot open the page', async ({
    dataConsumerPage,
  }) => {
    await dataConsumerPage.goto('/settings/notifications');

    await expect(
      dataConsumerPage.getByTestId('notifications.announcements')
    ).toHaveCount(0);

    await dataConsumerPage.goto(LIST_PATH);

    await expect(
      dataConsumerPage.getByTestId('system-announcements-page')
    ).toHaveCount(0);
    await expect(
      dataConsumerPage.getByTestId('permission-error-placeholder')
    ).toBeVisible();
  });
});
