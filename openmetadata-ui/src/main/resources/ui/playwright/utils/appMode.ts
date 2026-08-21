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

import { expect, Page, Response } from '@playwright/test';

/**
 * Shared helpers for the `AppMode/*.spec.ts` suite.
 *
 * Core ships the generic mode primitives (`useAppMode.ts`), the boot
 * resolver (`useResolvedAppMode.ts`), and the `AppModeSwitcher` mounted in
 * the navbar profile dropdown (`UserProfileIcon.component.tsx`) — but it
 * registers no second mode itself. `useAppRoutesRegistry` starts empty and
 * nothing under `openmetadata-ui/src` calls `registerRoutes(...)`; only a
 * downstream plugin (e.g. Collate's AskCollate) does that. These helpers
 * therefore only assume what's true of stock OM: the switcher is always
 * mounted, and the active mode lives in a per-tab `sessionStorage` tuple
 * written by `writeAppMode` (see `hooks/useAppMode.ts`).
 */

export type AppModeExpectation = 'ai' | 'default';

const APP_MODE_SESSION_KEY = 'omAppMode';

const readPersistedMode = async (page: Page): Promise<string | null> =>
  page.evaluate((sessionKey) => {
    const raw = globalThis.sessionStorage.getItem(sessionKey);
    if (raw === null) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as { mode?: string };

      return parsed.mode ?? null;
    } catch {
      return null;
    }
  }, APP_MODE_SESSION_KEY);

/**
 * Asserts the tab's persisted app mode. Zustand's initial store value and
 * an explicit `'default'` write are both Classic, so `expected: 'default'`
 * accepts either a `null` (never written) or literal `'default'` tuple.
 */
export const assertAppMode = async (
  page: Page,
  expected: AppModeExpectation
) => {
  const mode = await readPersistedMode(page);
  if (expected === 'default') {
    expect(mode === null || mode === 'default').toBe(true);
  } else {
    expect(mode).toBe(expected);
  }
};

/**
 * Opens the navbar profile dropdown (`dropdown-profile`), then the
 * `AppModeSwitcher` popover mounted inside it, and waits for the popover
 * card to render. Works regardless of whether a second mode is installed
 * — the switcher (and its "remember" toggle) are always mounted; only the
 * non-default mode OPTION inside the popover is conditionally disabled.
 */
export const openAppModeSwitcher = async (page: Page) => {
  await page.getByTestId('dropdown-profile').click();
  await page.getByTestId('app-mode-switcher-trigger').first().click();
  await expect(
    page.getByTestId('app-mode-switcher-card').first()
  ).toBeVisible();
};

export const isAppModePreferenceResponse = (
  response: Response,
  method: 'PUT' | 'DELETE'
) =>
  response.url().includes('/api/v1/users/') &&
  response.url().endsWith('/preferences/appMode') &&
  response.request().method() === method &&
  response.status() === 200;

export const isAppModePreferencePut = (response: Response) =>
  isAppModePreferenceResponse(response, 'PUT');

export const isAppModePreferenceDelete = (response: Response) =>
  isAppModePreferenceResponse(response, 'DELETE');
