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

import { Page, Response } from '@playwright/test';
import { expect, test } from '../../../support/fixtures/base';
import { UserClass } from '../../../support/user/UserClass';
import { createNewPage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  AppModeExpectation,
  assertAppMode,
  switchToAiModeViaProfileToggle,
} from '../../Utils/appMode';

// The AI sidebar renders two AppModeSwitcher instances (compact rail + expanded
// card); `:visible` narrows to whichever is shown without a positional locator.
const VISIBLE_SWITCHER_TRIGGER =
  '[data-testid="app-mode-switcher-trigger"]:visible';
const VISIBLE_SWITCHER_CARD = '[data-testid="app-mode-switcher-card"]:visible';
const VISIBLE_TRIGGER_ICON_AI =
  '[data-testid="app-mode-trigger-icon-ai"]:visible';

const isAppModePreferenceResponse = (
  response: Response,
  method: 'PUT' | 'DELETE'
) =>
  response.url().includes('/api/v1/users/') &&
  response.url().endsWith('/preferences/appMode') &&
  response.request().method() === method &&
  response.status() === 200;

const isAppModePreferencePut = (response: Response) =>
  isAppModePreferenceResponse(response, 'PUT');

/**
 * Cross-device sync depends on: server round trip (the PUT from device A) +
 * browser B's own boot-time fetch of `GET /users/{id}/preferences` + the
 * resolver effect settling — retry instead of asserting immediately after
 * login.
 */
const waitForAppMode = async (page: Page, expected: AppModeExpectation) => {
  await expect(async () => {
    await assertAppMode(page, expected);
  }).toPass({ timeout: 15_000 });
};

const openSwitcherAsAi = async (page: Page, user: UserClass) => {
  await user.login(page);
  await switchToAiModeViaProfileToggle(page);
  await expect(page.getByTestId('ask-sidebar')).toBeVisible();
  await page.locator(VISIBLE_SWITCHER_TRIGGER).click();
  await expect(page.locator(VISIBLE_SWITCHER_CARD)).toBeVisible();
};

const user = new UserClass();

test.beforeAll('Create fresh fixture user', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await user.create(apiContext);
  await afterAction();
});

test.afterAll('Delete fixture user', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await user.delete(apiContext);
  await afterAction();
});

test.describe('AppMode — cross-device sync', { tag: ['@Platform'] }, () => {
  test.afterEach(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await apiContext
      .delete(`/api/v1/users/${user.responseData.id}/preferences/appMode`)
      .catch(() => undefined);
    await afterAction();
  });

  test('Preference set in browser A is visible on a fresh login in browser B', async ({
    browser,
  }) => {
    // openSwitcherAsAi (full login + profile-toggle + switcher-open) plus a
    // second login on browser B tips past the 60s per-test default under CI
    // load. Bump.
    test.setTimeout(150_000);
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      await openSwitcherAsAi(pageA, user);

      const putResponse = pageA.waitForResponse(isAppModePreferencePut);
      await pageA
        .locator(VISIBLE_SWITCHER_CARD)
        .getByTestId('app-mode-remember-toggle')
        .click();
      await putResponse;

      // B has taken no action of its own — a fresh login must pick up the
      // server-side preference A just wrote.
      await user.login(pageB);
      await waitForAllLoadersToDisappear(pageB);

      await expect(pageB.getByTestId('ask-sidebar')).toBeVisible();
      // `ai-current-badge` lives inside the switcher popover — hidden until the
      // trigger is clicked. Use the always-mounted "current mode" trigger icon,
      // only rendered when useAppMode() === AI_APP_MODE.
      await expect(pageB.locator(VISIBLE_TRIGGER_ICON_AI)).toBeVisible();
      await waitForAppMode(pageB, 'ai');
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
