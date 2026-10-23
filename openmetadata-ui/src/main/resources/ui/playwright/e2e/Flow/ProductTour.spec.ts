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
import { Page, Request } from '@playwright/test';
import { PRODUCT_TOUR_PASS_THROUGH_PATHS } from '../../constant/productTour';
import { expect, test } from '../../support/fixtures/base';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

// The Classic tour walks the real pages and serves them from recorded
// fixtures (ADR:2026-10-23-the-product-tour-serves-its-pages-from-recorded-fixtures).
test.use({ storageState: 'playwright/.auth/admin.json' });

// react-tour's controls carry no test ids; these are its own attributes.
const NEXT_BUTTON = '[data-tour-elem="right-arrow"]';
const CLOSE_BUTTON = '[class*="reactour__close"]';
const STEP_TIMEOUT = 30_000;
const API_BASE_PATH = '/api/v1';

const popover = (page: Page) => page.locator('.product-tour-helper');

const readStep = (page: Page) =>
  popover(page)
    .innerText({ timeout: 1_000 })
    .catch(() => '');

const expectStep = async (page: Page, text: string) => {
  await expect(popover(page)).toContainText(text, { timeout: STEP_TIMEOUT });
};

// react-tour waits before showing the next step and ignores clicks meanwhile,
// so each Next waits for the step it opens.
const goNext = async (page: Page) => {
  const next = page.locator(NEXT_BUTTON);
  await expect(next).toBeVisible({ timeout: STEP_TIMEOUT });
  const current = await readStep(page);
  await next.click();
  await expect
    .poll(
      async () => {
        const shown = await readStep(page);

        return shown !== '' && shown !== current;
      },
      { timeout: STEP_TIMEOUT }
    )
    .toBe(true);
};

const goToStep = async (page: Page, step: number) => {
  for (let current = 1; current < step; current++) {
    await goNext(page);
  }
};

/** Opens Help > Tour on `path`. */
const startTourFrom = async (page: Page, path: string) => {
  await page.goto(path);
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('help-icon').click();
  await page.getByRole('menuitem', { name: 'Tour' }).click();
  await expectStep(page, 'Topics to catch up on');
};

const expectTourClosed = async (page: Page) => {
  await expect(popover(page)).toHaveCount(0);
  await expect(page.getByTestId('tour-step-loading')).toHaveCount(0);
};

/**
 * Collects the page-data requests that reach the server on the tour's pages:
 * every one should have been served from a fixture instead. Watching starts
 * when the tour leaves /tour for its first step, so the page it was started
 * from, which refetches as it unmounts, is not counted; or at once, for a
 * tour already on its pages.
 */
const watchServerRequests = (page: Page, { fromNow = false } = {}) => {
  const reached: string[] = [];
  let hasOpenedTour = false;
  let isOnTourPages = fromNow;
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) {
      return;
    }
    const isTourLauncher = new URL(frame.url()).pathname.endsWith('/tour');
    hasOpenedTour ||= isTourLauncher;
    isOnTourPages ||= hasOpenedTour && !isTourLauncher;
  });
  page.on('request', (request: Request) => {
    const { pathname, search } = new URL(request.url());
    const path = pathname.slice(API_BASE_PATH.length);
    const isPageData =
      pathname.startsWith(API_BASE_PATH) &&
      !PRODUCT_TOUR_PASS_THROUGH_PATHS.some((pattern) => pattern.test(path));
    if (isOnTourPages && isPageData) {
      reached.push(`${request.method()} ${pathname}${search}`);
    }
  });

  return reached;
};

test.describe('Product tour — Classic', () => {
  test('walks the Classic pages on recorded data and returns to Home', async ({
    page,
  }) => {
    test.slow();
    const reachedServer = watchServerRequests(page);

    await test.step('Help > Tour starts on Home', async () => {
      await startTourFrom(page, '/explore');
    });

    await test.step('Next crosses to each page and shows its step', async () => {
      await goNext(page);
      await expect(page).toHaveURL(/\/explore/);
      await expectStep(page, 'Explore');

      const lastStep = page.getByTestId('last-step-button');
      for (let step = 2; step < 20 && !(await lastStep.isVisible()); step++) {
        await goNext(page);
      }
      await expect(page).toHaveURL(/\/context-center\/memories/);
      await expectStep(page, 'Memories');
    });

    await test.step('No tour page reads from the server', async () => {
      expect(reachedServer).toEqual([]);
    });

    await test.step('The last step opens the end modal, and Explore Now goes Home', async () => {
      await page.getByTestId('last-step-button').click();
      await expect(page.getByTestId('tour-end-modal')).toBeVisible();
      await page.getByTestId('tour-end-explore-now').click();
      await expect(page).toHaveURL(/\/(my-data)?$/);
      await expectTourClosed(page);
    });
  });

  test('closing early returns to the page the tour was started from', async ({
    page,
  }) => {
    await test.step('Close with the X on a later page', async () => {
      await startTourFrom(page, '/explore');
      await goToStep(page, 3);
      await expect(page).toHaveURL(/\/settings\/services\/databases/);
      await page.locator(CLOSE_BUTTON).click();
      await expect(page).toHaveURL(/\/explore$/);
      await expectTourClosed(page);
    });

    await test.step('Escape closes it too', async () => {
      await page.getByTestId('help-icon').click();
      await page.getByRole('menuitem', { name: 'Tour' }).click();
      await expectStep(page, 'Topics to catch up on');
      await page.keyboard.press('Escape');
      await expect(page).toHaveURL(/\/explore$/);
      await expectTourClosed(page);
    });
  });

  test('follows the browser Back and Forward buttons', async ({ page }) => {
    await startTourFrom(page, '/explore');
    await goToStep(page, 3);
    await expect(page).toHaveURL(/\/settings\/services\/databases/);

    await test.step('Back returns to the previous page step', async () => {
      await page.goBack();
      await expect(page).toHaveURL(/\/explore$/);
      await expectStep(page, 'Explore');
    });

    await test.step('Forward moves on again', async () => {
      await page.goForward();
      await expect(page).toHaveURL(/\/settings\/services\/databases/);
      await expectStep(page, 'Services');
    });

    await test.step('Back past the first step leaves the tour', async () => {
      await page.goBack();
      await expectStep(page, 'Explore');
      await page.goBack();
      await expectStep(page, 'Topics to catch up on');
      await page.goBack();
      await expect(page).toHaveURL(/\/explore$/);
      await expectTourClosed(page);
    });
  });

  test('a reload mid-tour resumes the same step on recorded data', async ({
    page,
  }) => {
    await startTourFrom(page, '/explore');
    await goToStep(page, 3);
    await expectStep(page, 'Services');

    const reachedServer = watchServerRequests(page, { fromNow: true });
    await page.reload();

    await expect(page).toHaveURL(/\/settings\/services\/databases/);
    await expectStep(page, 'Services');
    expect(
      reachedServer.filter((request) => request.includes('/services/'))
    ).toEqual([]);

    await page.locator(CLOSE_BUTTON).click();
    await expect(page).toHaveURL(/\/explore$/);
    await expectTourClosed(page);
  });
});
