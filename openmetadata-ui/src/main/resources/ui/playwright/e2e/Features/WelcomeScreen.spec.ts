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
import { Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../constant/config';
import { installServerLoadReducers } from '../../support/fixtures/serverLoad';
import { UserClass } from '../../support/user/UserClass';
import {
  clickIgnoringToasts,
  getWorkerAdminAPIContext,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { expect, test as base } from '../fixtures/pages';
import { enableAiAppMode } from '../Utils/appMode';

// The welcome screen is remembered on the user (`isFirstTimeUser`), so a
// first login needs an account that has never reached a home route: a fresh
// admin per test (admin so the connect button renders), signed in without the
// `loggedInUsers` seed and landing away from home.
const signInAsFirstLogin = async (page: Page, user: UserClass) => {
  await installServerLoadReducers(page.context());
  await user.signIn(page, undefined, undefined, {
    suppressWelcomeScreen: false,
    landingPath: '/explore',
  });
};

const test = base.extend<{ firstLoginUser: UserClass; firstLoginPage: Page }>({
  // eslint-disable-next-line no-empty-pattern -- Created through the worker's admin API context, not a browser.
  firstLoginUser: async ({}, use) => {
    const apiContext = await getWorkerAdminAPIContext();
    const user = new UserClass(undefined, true);
    await user.create(apiContext);

    try {
      await use(user);
    } finally {
      await user.delete(apiContext);
    }
  },

  firstLoginPage: async ({ browser, firstLoginUser }, use) => {
    const page = await browser.newPage();

    try {
      await signInAsFirstLogin(page, firstLoginUser);
      await use(page);
    } finally {
      await page.close();
    }
  },
});

// The add-service route differs by distribution (Collate nests it under
// /connections in AI mode), so the connect tests check which connectors the
// wizard lists: a database-only grid for classic, every category for AI mode.
const openHome = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await waitForAllLoadersToDisappear(page);
};

test.describe(
  'First-login welcome screen',
  { tag: ['@Features', DOMAIN_TAGS.PLATFORM] },
  () => {
    test('shows once on the classic home and closes to the landing page', async ({
      browser,
      firstLoginPage: page,
      firstLoginUser,
    }) => {
      // The home records the welcome screen on the user in the background; the
      // later steps read it back from the server, so they wait for that write.
      const welcomeRecorded = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          response
            .url()
            .includes(`/api/v1/users/${firstLoginUser.responseData.id}`)
      );
      await openHome(page, '/my-data');

      await test.step('the first visit shows the welcome screen', async () => {
        await expect(page.getByTestId('welcome-screen')).toBeVisible();
        await expect(page.getByTestId('welcome-screen-img')).toBeVisible();
        expect((await welcomeRecorded).status()).toBe(200);
      });

      await test.step('closing it shows the landing page', async () => {
        await clickIgnoringToasts(page.getByTestId('welcome-screen-close-btn'));

        await expect(page.getByTestId('home-page-surface')).toBeVisible();
        await expect(page.getByTestId('welcome-screen')).toBeHidden();
      });

      await test.step('it does not come back on the next visit', async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('home-page-surface')).toBeVisible();
        await expect(page.getByTestId('welcome-screen')).toBeHidden();
      });

      await test.step('it does not come back in another browser', async () => {
        const otherBrowserPage = await browser.newPage();

        try {
          await signInAsFirstLogin(otherBrowserPage, firstLoginUser);
          await openHome(otherBrowserPage, '/my-data');

          await expect(
            otherBrowserPage.getByTestId('home-page-surface')
          ).toBeVisible();
          await expect(
            otherBrowserPage.getByTestId('welcome-screen')
          ).toBeHidden();
        } finally {
          await otherBrowserPage.close();
        }
      });
    });

    test('classic: connect a data source opens the database service wizard', async ({
      firstLoginPage: page,
    }) => {
      await openHome(page, '/my-data');

      await clickIgnoringToasts(page.getByTestId('welcome-screen-connect-btn'));

      const connectors = page.getByTestId('select-service');

      await expect(connectors.getByTestId('Mysql')).toBeVisible();
      await expect(connectors.getByTestId('Looker')).toBeHidden();
    });

    test('classic: take a product tour opens the tour', async ({
      firstLoginPage: page,
    }) => {
      await openHome(page, '/my-data');

      await clickIgnoringToasts(page.getByTestId('welcome-screen-tour-btn'));

      // /tour only starts the tour, which opens on Home with the welcome
      // screen gone.
      await expect(page.locator('.product-tour-helper')).toContainText(
        'Topics to catch up on'
      );
      await expect(page.getByTestId('welcome-screen')).toHaveCount(0);
    });

    test('AI mode: shows on the home, opens every connector, and stays dismissed', async ({
      firstLoginPage: page,
    }) => {
      await enableAiAppMode(page);
      await openHome(page, '/');

      await test.step('the first visit shows the welcome screen', async () => {
        await expect(page.getByTestId('welcome-screen')).toBeVisible();
      });

      await test.step('connect a data source opens every category', async () => {
        await clickIgnoringToasts(
          page.getByTestId('welcome-screen-connect-btn')
        );

        const connectors = page.getByTestId('select-service');

        await expect(connectors.getByTestId('Mysql')).toBeVisible();
        await expect(connectors.getByTestId('Looker')).toBeVisible();
      });

      await test.step('the kept-alive home does not show it again', async () => {
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('home-landing-page')).toBeVisible();
        await expect(page.getByTestId('welcome-screen')).toBeHidden();
      });
    });
  }
);
