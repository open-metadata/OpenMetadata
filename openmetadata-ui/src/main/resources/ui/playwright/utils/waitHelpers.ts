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

import { expect, Locator, Page, Response } from '@playwright/test';

export const waitForAntOverlayToOpen = async (overlay: Locator) => {
  await expect(overlay).toBeVisible();
  // Ant's invisible enter-start frame has a stable box, so click auto-waiting
  // can finish before the zoom motion starts changing the target's position.
  await expect(overlay).not.toHaveClass(
    /\bant-zoom(?:-big)?-(?:appear|enter|leave)(?:-|\b)/
  );
  await expect(overlay).toHaveCSS('opacity', '1');
};

/** Match the request first so a later HTTP 200 cannot hide its earlier failure. */
export const waitForResponseWithStatus = (
  page: Page,
  matchesRequest: (response: Response) => boolean | Promise<boolean>,
  expectedStatus: number | number[] | 'ok',
  options?: { timeout?: number }
): Promise<Response> => {
  const statuses = Array.isArray(expectedStatus)
    ? expectedStatus
    : [expectedStatus];
  const label = expectedStatus === 'ok' ? '2xx' : statuses.join(' or ');
  return page.waitForResponse(matchesRequest, options).then((response) => {
    if (
      expectedStatus === 'ok'
        ? !response.ok()
        : !statuses.includes(response.status())
    ) {
      throw new Error(
        `${response.request().method()} ${
          new URL(response.url()).pathname
        }: expected HTTP ${label}, received ${response.status()}`
      );
    }
    return response;
  });
};

/**
 * Registers the response listener *before* triggering the click, which is the
 * only ordering that cannot race: a response fired between the click and a
 * later `waitForResponse` is unobservable and the wait hangs until timeout.
 *
 * Resolves on the **first** response matching `urlPattern` and throws if that
 * one's status is not `expectedStatus`. Where a single click produces several
 * matching responses — a list refresh plus a count query on the same path, say
 * — the first to arrive is the one judged, so a later, healthy response will
 * not rescue an earlier failure. Narrow `urlPattern` until it identifies one
 * response, or await `page.waitForResponse` directly with a predicate.
 */
export const clickAndWaitFor = async (
  page: Page,
  locator: Locator,
  urlPattern: string | RegExp,
  expectedStatus = 200
): Promise<Response> => {
  const responsePromise = page.waitForResponse(urlPattern);
  await locator.click();
  const response = await responsePromise;

  if (response.status() !== expectedStatus) {
    throw new Error(
      `Expected ${String(
        urlPattern
      )} to return ${expectedStatus}, got ${response.status()}`
    );
  }

  return response;
};

/** React Aria counterpart of `waitForAntOverlayToOpen`: a click landing mid-slide cancels the press. */
export const waitForAriaOverlayToSettle = async (page: Page) => {
  await expect(page.locator('[data-entering]')).toHaveCount(0);
};

/**
 * Clicks `trigger` until `target` appears; a click swallowed by a re-layout
 * fires no event, so retrying is the only fix. `force` is off by default — it
 * also clicks through a real intercepting overlay and would hide that bug.
 */
export const clickUntilVisible = async (
  trigger: Locator,
  target: Locator,
  options?: { timeout?: number; force?: 'onRetry' | 'always' }
) => {
  let attempt = 0;
  await expect(async () => {
    const isRetry = attempt++ > 0;
    if (!(await target.isVisible())) {
      await trigger.click({
        force:
          options?.force === 'always' ||
          (options?.force === 'onRetry' && isRetry),
        timeout: 5_000,
      });
    }
    await expect(target).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: options?.timeout ?? 30_000, intervals: [500, 1_000] });
};

/** Budget for one search to list what the test is looking for. */
const SEARCH_ATTEMPT_TIMEOUT = 5_000;
/** Total budget for something written moments ago to become searchable. */
const SEARCH_INDEXING_TIMEOUT = 90_000;

/**
 * Search is eventually consistent: the server indexes a write after the API
 * call returns, so what a test created moments ago can be missing from the
 * first query. Runs `search` until `target` is visible, reloading the page
 * between attempts so the term is queried afresh — typing an unchanged term
 * again issues no new request.
 */
export const searchUntilVisible = async (
  page: Page,
  search: () => Promise<void>,
  target: Locator,
  options?: { timeout?: number }
) => {
  let hasSearched = false;
  await expect(async () => {
    if (hasSearched) {
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    hasSearched = true;
    await search();
    await expect(target).toBeVisible({ timeout: SEARCH_ATTEMPT_TIMEOUT });
  }).toPass({
    timeout: options?.timeout ?? SEARCH_INDEXING_TIMEOUT,
    intervals: [2_000, 3_000, 5_000],
  });
};

/**
 * A card list the page queried right after a create can miss what was just
 * created, since search is eventually consistent. Opens `tab` until `card` is
 * listed, reloading between attempts so the list is queried afresh.
 */
export const openTabUntilListed = async (
  page: Page,
  tab: Locator,
  card: Locator
) => searchUntilVisible(page, () => tab.click(), card);

/**
 * A page-sized asset query for `term`. The pickers also fire size=0 counts,
 * and search `all` or `dataAsset` depending on what they add assets to.
 */
const isAssetPickerQuery = (response: Response, term: string): boolean => {
  const url = new URL(response.url());

  return (
    url.pathname.endsWith('/api/v1/search/query') &&
    url.searchParams.get('size') === '25' &&
    url.searchParams.get('q') === term
  );
};

/**
 * Searches an asset picker until `card` is listed. Search is eventually
 * consistent, so an asset created moments ago can be missing from the first
 * query. Between attempts the box is cleared and its unfiltered query awaited,
 * so the next fill is a new query rather than an unchanged term.
 */
export const searchAssetPickerUntilListed = async (
  page: Page,
  searchBar: Locator,
  term: string,
  card: Locator
) => {
  let hasSearched = false;
  await expect(async () => {
    if (hasSearched) {
      const cleared = page.waitForResponse((response) =>
        isAssetPickerQuery(response, '')
      );
      await searchBar.clear();
      await cleared;
    }
    hasSearched = true;
    const searched = page.waitForResponse((response) =>
      isAssetPickerQuery(response, term)
    );
    await searchBar.fill(term);
    await searched;
    await expect(card).toBeVisible({ timeout: SEARCH_ATTEMPT_TIMEOUT });
  }).toPass({
    timeout: SEARCH_INDEXING_TIMEOUT,
    intervals: [2_000, 3_000, 5_000],
  });
};
