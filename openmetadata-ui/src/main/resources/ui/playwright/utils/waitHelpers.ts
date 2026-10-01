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

/**
 * React Aria popovers (`Dropdown.Popover`, menus, selects) slide in over
 * ~150ms and carry `data-entering` for the duration. Playwright's click
 * auto-wait only requires the box to be stable across two animation frames,
 * which a loaded CI runner can satisfy *inside* the slide: the press then
 * starts on the item and ends off it, so the item takes focus but
 * `onAction` never fires and whatever the click was meant to open never
 * appears. Same hazard `waitForAntOverlayToOpen` covers for antd, keyed on
 * the attribute instead of a class so it holds for every RAC overlay.
 */
export const waitForAriaOverlayToSettle = async (page: Page) => {
  await expect(page.locator('[data-entering]')).toHaveCount(0);
};

/**
 * Clicks `trigger` until `target` shows up, for triggers whose click is
 * idempotent (it opens something; clicking again re-opens it). Covers the
 * case where a single click is swallowed because the target moved between
 * mousedown and mouseup — a re-layout under the cursor leaves no click event
 * at all, so there is nothing to wait longer for.
 *
 * Only re-clicks while the target is still hidden: once a click has landed,
 * the thing it opened usually covers the trigger, and a redundant click would
 * block on that mask. The click is bounded for the same reason — the config
 * sets no `actionTimeout`, so an intercepted click would otherwise eat the
 * whole retry budget in one attempt instead of failing fast and retrying.
 */
export const clickUntilVisible = async (
  trigger: Locator,
  target: Locator,
  options?: { timeout?: number }
) => {
  await expect(async () => {
    if (!(await target.isVisible())) {
      await trigger.click({ timeout: 5_000 });
    }
    await expect(target).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: options?.timeout ?? 30_000, intervals: [500, 1_000] });
};
