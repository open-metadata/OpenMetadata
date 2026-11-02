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
import { clickIgnoringToasts } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { expect, test } from '../fixtures/pages';
import { enableAiAppMode } from '../Utils/appMode';

// The shared admin session seeds `loggedInUsers`, which is how every other spec
// keeps the welcome screen away. Drop it once per page — the session flag keeps
// a reload from dropping it again — so this page is the user's first login.
const asFirstLogin = (page: Page) =>
  page.addInitScript(() => {
    if (!sessionStorage.getItem('__pw_first_login')) {
      localStorage.removeItem('loggedInUsers');
      sessionStorage.setItem('__pw_first_login', '1');
    }
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
      page,
    }) => {
      await asFirstLogin(page);
      await openHome(page, '/my-data');

      await test.step('the first visit shows the welcome screen', async () => {
        await expect(page.getByTestId('welcome-screen')).toBeVisible();
        await expect(page.getByTestId('welcome-screen-img')).toBeVisible();
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
    });

    test('classic: connect a data source opens the database service wizard', async ({
      page,
    }) => {
      await asFirstLogin(page);
      await openHome(page, '/my-data');

      await clickIgnoringToasts(page.getByTestId('welcome-screen-connect-btn'));

      const connectors = page.getByTestId('select-service');

      await expect(connectors.getByTestId('Mysql')).toBeVisible();
      await expect(connectors.getByTestId('Looker')).toBeHidden();
    });

    test('classic: take a product tour opens the tour', async ({ page }) => {
      await asFirstLogin(page);
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
      page,
    }) => {
      await asFirstLogin(page);
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
