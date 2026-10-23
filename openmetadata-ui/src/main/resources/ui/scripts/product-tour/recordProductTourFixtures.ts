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
/**
 * Records the fixtures a product tour serves its pages from.
 *
 * Runs the tour against a server with sample data, with the fixtures switched
 * off, and saves every API response its pages read. Record from a clean
 * sample-data instance only: the fixtures ship with the app, so anything the
 * server returns ends up in front of every user who takes the tour. That rules
 * out an instance any Playwright project has run against, `setup` included:
 * it creates users the tour's pages list. The recorder signs the admin in
 * itself, so it needs no setup.
 *
 *   node scripts/product-tour/seedProductTourData.mjs   # showcase content
 *   TOUR_FIXTURES_OUT=src/constants/product-tour/classicTour.fixtures.json \
 *     npx playwright test -c scripts/product-tour/recordProductTourFixtures.config.ts
 *
 * The app mode the admin is in picks the tour, as Help > Tour does; set
 * TOUR_APP_MODE (`default` or `ai`) to record the tour of another mode. A
 * distribution records its own tours the same way, with
 * PLAYWRIGHT_TEST_BASE_URL pointing at its app.
 */
import { expect, Page, Request, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { AdminClass } from '../../playwright/support/user/AdminClass';
import { APP_MODE_SESSION_KEY } from '../../src/constants/appMode.constants';
import {
  PRODUCT_TOUR_RECORD_KEY,
  TOUR_WRITE_METHODS,
} from '../../src/constants/product-tour/productTour.constants';
import type { ProductTourFixture } from '../../src/interface/product-tour/productTour.interface';
import {
  getTourRequestKey,
  isTourPassThroughPath,
  normalizeTourQuery,
  toTourRequest,
} from '../../src/utils/product-tour/productTourMock.utils';

const API_BASE_PATH = '/api/v1';
const NEXT_BUTTON = '[data-tour-elem="right-arrow"]';
const LAST_STEP_BUTTON = '[data-testid="last-step-button"]';
const MAX_STEPS = 50;
const STEP_TIMEOUT = 60_000;
// Panels that load after the page settles (a summary of the first result) still
// fetch within this window.
const STEP_SETTLE_MS = 3_000;

const readStep = (page: Page) =>
  page
    .locator('.product-tour-helper')
    .innerText({ timeout: 1_000 })
    .catch(() => '');

const isRecordable = (request: Request) => {
  const { pathname } = new URL(request.url());
  const isWrite = (TOUR_WRITE_METHODS as readonly string[]).includes(
    request.method().toLowerCase()
  );
  if (
    isWrite ||
    !pathname.startsWith(API_BASE_PATH) ||
    !['xhr', 'fetch'].includes(request.resourceType())
  ) {
    return false;
  }
  const path = pathname.slice(API_BASE_PATH.length);

  return !isTourPassThroughPath(path);
};

test('record the product tour fixtures', async ({ page }) => {
  const out = process.env.TOUR_FIXTURES_OUT;
  test.skip(!out, 'Set TOUR_FIXTURES_OUT to the fixtures file to write.');
  // Settled before the listener: the sign-in lands on Home outside the tour.
  await new AdminClass().signIn(page);
  await page.waitForLoadState('networkidle');
  const fixtures = new Map<string, ProductTourFixture>();

  page.on('response', async (response) => {
    const request = response.request();
    if (!isRecordable(request) || !response.ok()) {
      return;
    }
    const tourRequest = toTourRequest(
      request.method(),
      request.url(),
      API_BASE_PATH,
      request.postData() ?? undefined
    );
    const key = getTourRequestKey(tourRequest);
    if (fixtures.has(key)) {
      return;
    }
    const data = await response.json().catch(() => undefined);
    if (data !== undefined) {
      fixtures.set(key, {
        method: tourRequest.method,
        path: tourRequest.path,
        query: normalizeTourQuery(tourRequest.query),
        body: tourRequest.body,
        status: response.status(),
        data,
      });
    }
  });

  await page.addInitScript(
    (key) => sessionStorage.setItem(key, 'true'),
    PRODUCT_TOUR_RECORD_KEY
  );
  const appMode = process.env.TOUR_APP_MODE;
  if (appMode) {
    // This tab's mode, as switching modes in the app sets it.
    await page.evaluate(
      ({ key, mode }) =>
        sessionStorage.setItem(
          key,
          JSON.stringify({ personaAppMode: null, mode, source: 'manual' })
        ),
      { key: APP_MODE_SESSION_KEY, mode: appMode }
    );
  }
  await page.goto('/tour');

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      // Every step has react-tour's Next control; on the last it holds the
      // finish button.
      await page
        .locator(NEXT_BUTTON)
        .waitFor({ state: 'visible', timeout: STEP_TIMEOUT });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(STEP_SETTLE_MS);
      await page.waitForLoadState('networkidle');
      if (await page.locator(LAST_STEP_BUTTON).isVisible()) {
        break;
      }
      // react-tour ignores clicks while it waits to show the next step.
      const current = await readStep(page);
      await page.locator(NEXT_BUTTON).click();
      await expect
        .poll(
          async () => {
            const shown = await readStep(page);

            return shown !== '' && shown !== current;
          },
          { timeout: STEP_TIMEOUT }
        )
        .toBe(true);
    }
  } finally {
    const sorted = [...fixtures.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, fixture]) => fixture);
    writeFileSync(out as string, `${JSON.stringify(sorted, null, 2)}\n`);
  }
});
