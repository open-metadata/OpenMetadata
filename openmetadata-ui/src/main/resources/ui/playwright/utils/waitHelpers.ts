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
