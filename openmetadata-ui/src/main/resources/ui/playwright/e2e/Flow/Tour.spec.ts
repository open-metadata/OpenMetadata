/*
 *  Copyright 2024 Collate.
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
import { Locator, Page } from '@playwright/test';
import { ACTION_TIMEOUT } from '../../constant/common';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { expect, test as base } from '../../support/fixtures/base';
import { UserClass } from '../../support/user/UserClass';
import { getWorkerAdminAPIContext } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

// The tour's table, mirrored from src/constants/mockTourData.constants.ts. The tour runs on mock
// data only, so any API request naming this table is a component fetching the mock for real:
// it 404s on an instance without the sample data and throws error toasts mid-tour. CI always
// ingests the sample data, which is why such a leak cannot surface as a failed response there.
// ADR:2026-10-13-the-product-tour-never-requests-its-mock-entity
const TOUR_TABLE_FQN = 'sample_data.ecommerce_db.shopify.dim_address';
const TOUR_TABLE_ID = '9d664bbd-8c9e-4068-9112-9ab0457d4c52';
const TOUR_SEARCH_TERM = 'dim_a';
const EMPTY_TABLE_ENTITY_LINK = '<#E::table::>';
const TOUR_MOCK_MARKERS = [
  TOUR_TABLE_FQN,
  TOUR_TABLE_ID,
  EMPTY_TABLE_ENTITY_LINK,
];
const TOUR_LINEAGE_TABLES = ['raw_customer', 'dim_address', 'fact_order'];

// Each test signs in as its own account: a describe-level account is deleted by whichever
// worker finishes first, under the tests still running on the others.
const test = base.extend<{ tourUser: UserClass }>({
  // eslint-disable-next-line no-empty-pattern -- The account needs only the worker's admin API context.
  tourUser: async ({}, use) => {
    const apiContext = await getWorkerAdminAPIContext();
    const user = new UserClass();
    await user.create(apiContext);

    try {
      await use(user);
    } finally {
      await user.delete(apiContext);
    }
  },
});

const decodeUrl = (url: string) => {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
};

const recordTourMockRequests = (page: Page) => {
  const requests: string[] = [];

  page.on('request', (request) => {
    const url = decodeUrl(request.url());
    const isTourMockRequest =
      url.includes('/api/v1/') &&
      TOUR_MOCK_MARKERS.some((marker) => url.includes(marker));

    if (isTourMockRequest) {
      requests.push(`${request.method()} ${url}`);
    }
  });

  return requests;
};

const expectTourBadge = async (
  page: Page,
  step: string,
  timeout = ACTION_TIMEOUT
) => {
  // A single web-first assertion. The badge re-renders on every step transition,
  // so a separate visibility wait followed by a text poll gave the transition two
  // independent budgets to lose against; toHaveText auto-waits for the element to
  // attach *and* carry the expected step, and reports the actual step on failure.
  await expect(page.locator('[data-tour-elem="badge"]')).toHaveText(step, {
    timeout,
  });
};

const expectTourStep = async (page: Page, step: number, target: Locator) => {
  await expectTourBadge(page, String(step));
  // In the viewport, not merely visible: toBeVisible ignores overflow clipping, so it passed
  // while the spotlight sat over a result card clipped to nothing by a zero-width panel.
  await expect(target).toBeInViewport();
};

const goToNextTourStep = async (page: Page) => {
  await page.locator('[data-tour-elem="right-arrow"]').click();
};

const validateTourSteps = async (page: Page) => {
  const searchBox = page.getByTestId('searchBox');

  await expectTourStep(page, 1, page.locator('#feedWidgetData'));
  await goToNextTourStep(page);

  await expectTourStep(page, 2, searchBox);
  await goToNextTourStep(page);

  // A typing step: the tour advances on Enter only once the exact term is typed.
  await expectTourStep(page, 3, searchBox);
  await searchBox.fill(TOUR_SEARCH_TERM);
  await searchBox.press('Enter');

  await expectTourStep(page, 4, page.locator(`#search-card-${TOUR_TABLE_ID}`));
  await goToNextTourStep(page);

  // Click steps are advanced the way a user advances them — by clicking the highlighted
  // target — which also proves the target can receive the click, not merely that it exists.
  const tableLink = page.getByTestId(TOUR_TABLE_FQN);
  await expectTourStep(page, 5, tableLink);
  await tableLink.click();

  await expectTourStep(page, 6, page.getByTestId('entity-page-header'));
  await goToNextTourStep(page);

  await expectTourStep(page, 7, page.getByTestId('owner-label'));
  await goToNextTourStep(page);

  await expectTourStep(page, 8, page.getByTestId('entity-follow-button'));
  await goToNextTourStep(page);

  await expectTourStep(page, 9, page.locator('#schemaDetails'));
  await goToNextTourStep(page);

  const sampleDataTab = page.getByTestId('sample_data');
  await expectTourStep(page, 10, sampleDataTab);
  await sampleDataTab.click();

  await expectTourStep(page, 11, page.getByTestId('sample-data-table'));
  await goToNextTourStep(page);

  const profilerTab = page.getByTestId('profiler');
  await expectTourStep(page, 12, profilerTab);
  await profilerTab.click();

  await expectTourStep(page, 13, page.locator('#profilerDetails'));
  await goToNextTourStep(page);

  const lineageTab = page.getByTestId('lineage');
  await expectTourStep(page, 14, lineageTab);
  await lineageTab.click();

  const lineageDetails = page.getByTestId('lineage-details');
  await expectTourStep(page, 15, lineageDetails);

  for (const table of TOUR_LINEAGE_TABLES) {
    await expect(
      lineageDetails.getByTestId(
        `lineage-node-sample_data.ecommerce_db.shopify.${table}`
      )
    ).toBeVisible();
  }

  await expect(page.getByTestId('lineage-map-onboarding-dialog')).toBeHidden();

  await page.getByTestId('last-step-button').click();
  await page.getByTestId('saveButton').click();

  await expect(page).not.toHaveURL(/\/tour/);
  await expect(page.locator('[data-tour-elem="badge"]')).toBeHidden();
};

// Quarantined: the tour anchors on elements the new landing page no longer
// renders. See QUARANTINE.md.
test.describe(
  'Tour should work properly',
  { tag: [PLAYWRIGHT_BASIC_TEST_TAG_OBJ.tag, '@quarantine'] },
  () => {
    test('Tour should work from help section', async ({ page, tourUser }) => {
      test.slow();

      const tourMockRequests = recordTourMockRequests(page);
      await tourUser.signIn(page);

      await page.locator('[data-testid="help-icon"]').click();
      await page.getByRole('link', { name: 'Tour', exact: true }).click();
      await page.waitForURL('**/tour', { waitUntil: 'domcontentloaded' });

      await validateTourSteps(page);

      expect(
        tourMockRequests,
        'the tour must not request its mock table from the server'
      ).toEqual([]);
    });

    test('Tour should work from welcome screen', async ({ page, tourUser }) => {
      test.slow();

      // The welcome screen only renders until the user is recorded as seen, so it is kept.
      await tourUser.signIn(page, undefined, undefined, {
        suppressWelcomeScreen: false,
      });

      const isAlertVisible = await page
        .getByTestId('whats-new-alert-card')
        .isVisible();
      if (isAlertVisible) {
        await page
          .getByTestId('whats-new-alert-card')
          .locator('.whats-new-alert-close')
          .click();
      }
      await page.getByText('Take a product tour to get started!').click();
      await page.waitForURL('**/tour', { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);
      await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

      await page.locator('#feedWidgetData').waitFor();
      // Since the tour steps are already tested in the first test,
      // here we only validate whether the tour is loading or not.
      await expectTourBadge(page, '1');
    });

    test('Tour should start for a first-time user opening it from the URL', async ({
      page,
      tourUser,
    }) => {
      // Lands on /tour before My Data has ever rendered for this user, so the welcome screen
      // is still due. It must not take the place of the step targets and block the tour.
      await tourUser.signIn(page, undefined, undefined, {
        suppressWelcomeScreen: false,
        landingPath: '/tour',
      });

      await expectTourStep(page, 1, page.locator('#feedWidgetData'));
      await expect(page.getByTestId('welcome-screen')).toBeHidden();
    });
  }
);
