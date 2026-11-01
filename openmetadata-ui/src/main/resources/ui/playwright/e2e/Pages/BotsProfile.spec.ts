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

import { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from '../../support/fixtures/base';
import { performAdminLogin } from '../../utils/admin';
import { okJson } from '../../utils/apiResponse';
import {
  redirectToHomePage,
  selectOptionWithRetry,
  uuid,
} from '../../utils/common';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';
import { enableAiAppMode } from '../Utils/appMode';

test.use({ storageState: 'playwright/.auth/admin.json' });

// Assigned in beforeAll so a second beforeAll run in the same worker creates fresh bots.
let BOT_NAME: string;
let REVOKE_BOT_NAME: string;
let RESTORE_BOT_NAME: string;

const createBotWithUser = async (
  apiContext: APIRequestContext,
  name: string
) => {
  const userResponse = await apiContext.put('/api/v1/users', {
    data: {
      email: `${name}@test.com`,
      name,
      displayName: name,
      isBot: true,
      isAdmin: false,
      botName: name,
      domains: [],
      authenticationMechanism: {
        authType: 'JWT',
        config: { JWTTokenExpiry: 'Unlimited' },
      },
    },
  });
  await okJson(userResponse, `Create bot user ${name}`);

  await okJson(
    await apiContext.post('/api/v1/bots', {
      data: { botUser: name, name, displayName: name },
    }),
    `Create bot ${name}`
  );
};

const goToBotsPanel = async (page: Page) => {
  await enableAiAppMode(page);
  await redirectToHomePage(page);

  await expect(page.getByTestId('ask-ai-user-menu-trigger')).toBeVisible();

  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await expect(page.getByTestId('ai-profile-page')).toBeVisible();

  await page.getByTestId('profile-nav-bots').click();

  await expect(page.getByTestId('bots-list-panel')).toBeVisible();
};

const searchBot = async (page: Page, term: string) => {
  const searchResponsePromise = waitForResponseWithStatus(
    page,
    (response) => {
      const url = new URL(response.url());

      return (
        url.pathname === '/api/v1/search/query' &&
        (url.searchParams.get('q') ?? '').includes(term) &&
        response.request().method() === 'GET'
      );
    },
    200
  );

  await page.getByTestId('searchbar').getByRole('textbox').fill(term);
  await searchResponsePromise;
};

test.describe('Bots Panel in AI Profile Modal', { tag: '@basic' }, () => {
  test.beforeAll(async ({ browser }) => {
    BOT_NAME = `pw-bot-${uuid()}`;
    REVOKE_BOT_NAME = `pw-revoke-bot-${uuid()}`;
    RESTORE_BOT_NAME = `pw-restore-bot-${uuid()}`;
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createBotWithUser(apiContext, BOT_NAME);
      await createBotWithUser(apiContext, REVOKE_BOT_NAME);
      await createBotWithUser(apiContext, RESTORE_BOT_NAME);
      await okJson(
        await apiContext.delete(
          `/api/v1/bots/name/${RESTORE_BOT_NAME}?hardDelete=false`
        ),
        `Soft-delete bot ${RESTORE_BOT_NAME}`
      );
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      for (const name of [BOT_NAME, REVOKE_BOT_NAME, RESTORE_BOT_NAME]) {
        await apiContext.delete(`/api/v1/bots/name/${name}?hardDelete=true`);
      }
    } catch {
      // best-effort cleanup
    } finally {
      await afterAction();
    }
  });

  test('should navigate to bots panel', async ({ page }) => {
    await goToBotsPanel(page);

    await expect(
      page.getByTestId('searchbar').getByRole('textbox')
    ).toBeVisible();
  });

  test('should verify system bot cannot be deleted', async ({ page }) => {
    await goToBotsPanel(page);

    await searchBot(page, 'ingestion');

    await expect(page.getByTestId('bot-delete-ingestion-bot')).toBeDisabled();
  });

  test('should ask for confirmation before revoking a bot token', async ({
    page,
  }) => {
    await goToBotsPanel(page);

    await searchBot(page, REVOKE_BOT_NAME);
    await page.getByTestId(`bot-link-${REVOKE_BOT_NAME}`).click();

    const revokeButton = page.getByTestId('revoke-button');

    await expect(revokeButton).toBeVisible();

    await revokeButton.click();

    const popover = page.getByTestId('revoke-token-popover');

    await expect(popover).toBeVisible();
    await expect(popover).toContainText(
      'Are you sure you want to revoke access for JWT Token?'
    );

    await page.getByTestId('revoke-token-popover-cancel').click();

    await expect(popover).not.toBeVisible();
    await expect(revokeButton).toBeVisible();

    await revokeButton.click();

    const revokeResponse = waitForResponseWithStatus(
      page,
      (response) =>
        response.url().includes('/api/v1/users/revokeToken') &&
        response.request().method() === 'PUT',
      200
    );
    await page.getByTestId('revoke-token-popover-confirm').click();
    await revokeResponse;

    await expect(page.getByTestId('auth-mechanism')).toBeVisible();
  });

  test('should restore a soft-deleted bot from the list', async ({
    browser,
    page,
  }) => {
    await goToBotsPanel(page);

    const deletedListResponse = waitForResponseWithStatus(
      page,
      (response) =>
        response.url().includes('/api/v1/bots?') &&
        response.url().includes('include=deleted') &&
        response.request().method() === 'GET',
      200
    );
    await page.getByTestId('switch-deleted').click();
    await deletedListResponse;

    await searchBot(page, RESTORE_BOT_NAME);

    await page.getByTestId(`bot-restore-${RESTORE_BOT_NAME}`).click();

    await expect(page.getByTestId('restore-bot-popover')).toBeVisible();

    const restoreResponse = waitForResponseWithStatus(
      page,
      (response) =>
        response.url().includes('/api/v1/bots/restore') &&
        response.request().method() === 'PUT',
      200
    );
    await page.getByTestId('restore-bot-popover-confirm').click();
    await restoreResponse;

    // The soft-deleted bot user is already in the index, so presence alone proves
    // nothing — wait until the reindexed document reports it as not deleted.
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await expect
        .poll(
          async () => {
            const body = await okJson<{
              hits: {
                hits: { _source: { name: string; deleted: boolean } }[];
              };
            }>(
              await apiContext.get('/api/v1/search/query', {
                params: {
                  q: `name:"${RESTORE_BOT_NAME}"`,
                  index: 'user_search_index',
                  from: 0,
                  size: 10,
                },
              }),
              'Search restored bot user'
            );

            return body.hits.hits.find(
              (hit) => hit._source.name === RESTORE_BOT_NAME
            )?._source.deleted;
          },
          { timeout: 60_000, intervals: [1_000, 2_000, 5_000] }
        )
        .toBe(false);
    } finally {
      await afterAction();
    }

    const activeListResponse = waitForResponseWithStatus(
      page,
      (response) =>
        response.url().includes('/api/v1/bots?') &&
        response.url().includes('include=non-deleted') &&
        response.request().method() === 'GET',
      200
    );
    await page.getByTestId('switch-deleted').click();
    await activeListResponse;

    await searchBot(page, RESTORE_BOT_NAME);

    await expect(
      page.getByTestId(`bot-link-${RESTORE_BOT_NAME}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`bot-restore-${RESTORE_BOT_NAME}`)
    ).toHaveCount(0);
  });

  test('should create bot via add form', async ({ page }) => {
    await goToBotsPanel(page);

    await page.getByTestId('add-bot').click();

    await expect(page.getByTestId('bot-add-form')).toBeVisible();

    const formBotName = `pw-form-bot-${uuid()}`;
    const formBotEmail = `${formBotName}@test.com`;

    await page.getByTestId('email').getByRole('textbox').fill(formBotEmail);
    await page
      .getByTestId('displayName')
      .getByRole('textbox')
      .fill(formBotName);

    await selectOptionWithRetry(
      page.getByTestId('token-expiry').getByRole('button'),
      page.getByRole('option', { name: '1 hour' })
    );

    const userResponsePromise = waitForResponseWithStatus(
      page,
      (response) =>
        new URL(response.url()).pathname === '/api/v1/users' &&
        response.request().method() === 'PUT',
      'ok'
    );
    const botResponsePromise = waitForResponseWithStatus(
      page,
      (response) =>
        new URL(response.url()).pathname === '/api/v1/bots' &&
        response.request().method() === 'POST',
      'ok'
    );

    await page.getByTestId('submit-btn').click();
    await userResponsePromise;
    await botResponsePromise;

    await expect(page.getByTestId('bots-list-panel')).toBeVisible();
  });

  test('should search bots from list', async ({ page }) => {
    await goToBotsPanel(page);

    await searchBot(page, BOT_NAME);

    await expect(page.getByTestId(`bot-link-${BOT_NAME}`)).toBeVisible();
  });

  test('should show bot detail and edit description', async ({ page }) => {
    await goToBotsPanel(page);

    await searchBot(page, BOT_NAME);
    await page.getByTestId(`bot-link-${BOT_NAME}`).click();

    await expect(page.getByTestId('bot-detail-container')).toBeVisible();

    const editDescButton = page.getByTestId('edit-description-btn');

    await expect(editDescButton).toBeVisible();
    await editDescButton.click();

    await expect(page.getByTestId('edit-description-modal')).toBeVisible();
  });

  test('should show token section', async ({ page }) => {
    await goToBotsPanel(page);

    await searchBot(page, BOT_NAME);
    await page.getByTestId(`bot-link-${BOT_NAME}`).click();

    await expect(page.getByTestId('token-section')).toBeVisible();
  });

  test('should toggle show deleted', async ({ page }) => {
    await goToBotsPanel(page);

    await expect(page.getByTestId('switch-deleted')).toBeVisible();
  });
});
