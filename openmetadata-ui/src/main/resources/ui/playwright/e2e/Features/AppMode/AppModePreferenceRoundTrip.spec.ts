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

import { Page, Request, Response } from '@playwright/test';
import { expect, test } from '../../../support/fixtures/base';
import { UserClass } from '../../../support/user/UserClass';
import { createNewPage } from '../../../utils/common';
import { switchToAiModeViaProfileToggle } from '../../Utils/appMode';

// The AI sidebar renders two AppModeSwitcher instances (compact rail + expanded
// card); `:visible` narrows to whichever is shown without a positional locator.
const VISIBLE_SWITCHER_TRIGGER =
  '[data-testid="app-mode-switcher-trigger"]:visible';
const VISIBLE_SWITCHER_CARD = '[data-testid="app-mode-switcher-card"]:visible';

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
const isAppModePreferenceDelete = (response: Response) =>
  isAppModePreferenceResponse(response, 'DELETE');

/**
 * Opens the app-mode switcher popover as `user` in a fresh, isolated browser
 * context (never the shared admin — this suite needs a user with no
 * pre-existing persona/preference) and returns the page ready for the
 * "remember" toggle, which lives on the AI-sidebar AppModeSwitcher.
 */
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

test.describe('AppMode — preference round trip', { tag: ['@Platform'] }, () => {
  test.afterEach(async ({ browser }) => {
    // Best-effort: a mid-test assertion failure must not leak a PUT'd
    // preference into a sibling test that shares this fixture user.
    const { apiContext, afterAction } = await createNewPage(browser);
    await apiContext
      .delete(`/api/v1/users/${user.responseData.id}/preferences/appMode`)
      .catch(() => undefined);
    await afterAction();
  });

  test('Toggle "remember" ON emits a PUT with the typed-union body', async ({
    browser,
  }) => {
    // openSwitcherAsAi = login + profile-toggle + open-switcher: three heavy
    // sequential steps that tip past the 60s default under CI load. Bump.
    test.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await openSwitcherAsAi(page, user);

      const putResponse = page.waitForResponse(isAppModePreferencePut);
      await page
        .locator(VISIBLE_SWITCHER_CARD)
        .getByTestId('app-mode-remember-toggle')
        .click();
      const putRequest: Request = (await putResponse).request();

      expect(putRequest.method()).toBe('PUT');
      expect(putRequest.url()).toContain(
        `/users/${user.responseData.id}/preferences/appMode`
      );
      expect(putRequest.postDataJSON()).toEqual({
        type: 'appMode',
        config: { value: 'ai' },
      });
    } finally {
      await context.close();
    }
  });

  test('Toggle "remember" OFF emits a DELETE', async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await openSwitcherAsAi(page, user);

      const rememberToggle = page
        .locator(VISIBLE_SWITCHER_CARD)
        .getByTestId('app-mode-remember-toggle');

      // Tick it on first so there is something to untick.
      const putResponse = page.waitForResponse(isAppModePreferencePut);
      await rememberToggle.click();
      await putResponse;

      const deleteResponse = page.waitForResponse(isAppModePreferenceDelete);
      await rememberToggle.click();
      const resolved = await deleteResponse;

      expect(resolved.request().method()).toBe('DELETE');
      expect(resolved.status()).toBe(200);
    } finally {
      await context.close();
    }
  });

  // NOTE: the Collate suite also had a "rapid tick/untick/tick inside the
  // debounce window coalesces to one request" test. It relied on a fixed
  // `waitForTimeout` to let a bug-case second request surface, which the OSS
  // playwright lint bans with no clean equivalent, so it is not ported here.
});
