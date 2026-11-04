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
import {
  createLandingPageAccount,
  deleteLandingPageAccount,
  expect,
  LandingPageAccount,
  openLandingPageAccountPage,
  test,
} from '../../../support/fixtures/landingPageUser';
import { okJson } from '../../../utils/apiResponse';
import {
  getWorkerAdminAPIContext,
  redirectToHomePage,
  uuid,
} from '../../../utils/common';
import { LANDING_PAGE_ROOT } from '../../../utils/customizeLandingPage';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// One token per run, in every title, so parallel workers never read each other's rows.
const RUN = `critann${uuid()}`;

const NEWEST = `Ingestion outage ${RUN}`;
const OLDER = `Search reindex ${RUN}`;
const NOTICE = `Governance review ${RUN}`;

interface SeededAnnouncement {
  id: string;
}

// Started minutes ago, so they are the newest live criticals and lead the
// carousel even when other specs leave day-old ones behind.
const seed = async (
  apiContext: APIRequestContext,
  displayName: string,
  type: string,
  startedMinutesAgo: number
): Promise<SeededAnnouncement> =>
  okJson(
    await apiContext.post('/api/v1/announcements', {
      data: {
        displayName,
        description: `${displayName} body`,
        type,
        startTime: Date.now() - startedMinutesAgo * MINUTE,
        endTime: Date.now() + DAY,
      },
    }),
    `Seed ${displayName}`
  );

const banner = (page: Page) => page.getByTestId('critical-announcements');
const bannerTitle = (page: Page) =>
  page.getByTestId('critical-announcement-title');
// Every live critical is in the rail; only the one scrolled into view is seen.
const titleOf = (page: Page, title: string) =>
  bannerTitle(page).filter({ hasText: title });
const bannerOf = (page: Page, title: string) =>
  page.getByTestId('critical-announcement-banner').filter({ hasText: title });

const openHome = async (page: Page) => {
  await redirectToHomePage(page);
  await expect(page.getByTestId(LANDING_PAGE_ROOT)).toBeVisible();
  await expect(banner(page)).toBeVisible();
  // A live critical takes the greeting's slot rather than stacking under it.
  await expect(page.getByTestId('home-landing-page-header')).toHaveCount(0);
};

test.describe('Landing page critical announcements', () => {
  // The banner leads with the newest live critical, so a second worker's seeds
  // would take the first slot; one worker keeps the order this spec asserts.
  test.describe.configure({ mode: 'serial' });

  let seeded: SeededAnnouncement[] = [];
  let consumer: LandingPageAccount;

  test.beforeAll(async () => {
    const apiContext = await getWorkerAdminAPIContext();
    consumer = await createLandingPageAccount(apiContext);
    seeded = await Promise.all([
      seed(apiContext, NEWEST, 'Critical', 1),
      seed(apiContext, OLDER, 'Critical', 2),
      seed(apiContext, NOTICE, 'Notice', 1),
    ]);
  });

  test.afterAll(async () => {
    const apiContext = await getWorkerAdminAPIContext();
    await Promise.all(
      seeded.map(({ id }) =>
        apiContext.delete(`/api/v1/announcements/${id}?hardDelete=true`)
      )
    );
    await deleteLandingPageAccount(apiContext, consumer);
  });

  test('a user sees live critical system announcements as a carousel', async ({
    browser,
  }) => {
    const page = await openLandingPageAccountPage(browser, consumer);

    try {
      await openHome(page);

      // Newest first: it is the one in view, the older one waits off-screen.
      await expect(titleOf(page, NEWEST)).toBeInViewport();
      await expect(titleOf(page, OLDER)).not.toBeInViewport();

      await page.getByTestId('critical-announcement-next').click();

      await expect(titleOf(page, OLDER)).toBeInViewport();
      await expect(titleOf(page, NEWEST)).not.toBeInViewport();

      await page.getByTestId('critical-announcement-previous').click();

      await expect(titleOf(page, NEWEST)).toBeInViewport();

      // Only critical system announcements reach users, and only here: the
      // notice is nowhere on Home, and the rail never repeats a critical one.
      await expect(page.getByText(NOTICE)).toHaveCount(0);
      await expect(
        page.getByTestId('announcement-rail').getByText(RUN)
      ).toHaveCount(0);
    } finally {
      await page.close();
    }
  });

  test('a dismissal holds across reloads, for that user only', async ({
    browser,
    page: adminPage,
  }) => {
    const page = await openLandingPageAccountPage(browser, consumer);

    try {
      await openHome(page);

      await expect(titleOf(page, NEWEST)).toBeInViewport();

      await bannerOf(page, NEWEST)
        .getByTestId('critical-announcement-dismiss')
        .click();

      await expect(titleOf(page, OLDER)).toBeInViewport();

      await page.reload();
      await expect(banner(page)).toBeVisible();

      await expect(titleOf(page, OLDER)).toBeInViewport();
      await expect(page.getByText(NEWEST)).toHaveCount(0);
    } finally {
      await page.close();
    }

    await openHome(adminPage);

    await expect(titleOf(adminPage, NEWEST)).toBeInViewport();
  });
});
