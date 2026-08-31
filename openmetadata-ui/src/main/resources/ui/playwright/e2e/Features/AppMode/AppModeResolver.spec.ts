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

import { Page, Response } from '@playwright/test';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  assertAppMode,
  disableAiAppMode,
  switchToAiModeViaProfileToggle,
} from '../../Utils/appMode';
import { expect, test } from './fixtures';

const APP_MODE_SESSION_KEY = 'omAppMode';
const APP_MODE_HINT_STORAGE_KEY = 'omAppModeHint';
const APP_MODE_HINT_TTL_MS = 60_000;

// The AI sidebar renders two AppModeSwitcher instances (compact rail + expanded
// card); only one is visible for a given sidebar state. `:visible` narrows to
// it without a positional locator.
const VISIBLE_SWITCHER_TRIGGER =
  '[data-testid="app-mode-switcher-trigger"]:visible';
const VISIBLE_SWITCHER_CARD = '[data-testid="app-mode-switcher-card"]:visible';

const isRememberPreferencePut = (response: Response) =>
  response.url().includes('/api/v1/users/') &&
  response.url().endsWith('/preferences/appMode') &&
  response.request().method() === 'PUT' &&
  response.status() === 200;

type AppModeStorage = {
  session: { personaAppMode: string | null; mode: string } | null;
  hint: { mode: string; ts: number } | null;
};

const readAppModeStorage = (page: Page): Promise<AppModeStorage> =>
  page.evaluate(
    ([sessionKey, hintKey]) => {
      const parse = <T>(raw: string | null): T | null => {
        if (raw === null) {
          return null;
        }
        try {
          return JSON.parse(raw) as T;
        } catch {
          return null;
        }
      };

      return {
        session: parse(globalThis.sessionStorage.getItem(sessionKey)),
        hint: parse(globalThis.localStorage.getItem(hintKey)),
      };
    },
    [APP_MODE_SESSION_KEY, APP_MODE_HINT_STORAGE_KEY]
  );

// Simulate "close every tab, then re-open" without spinning up a fresh browser
// context: sessionStorage is per-tab (goes away on close) and the localStorage
// hint is TTL-gated, so evicting both is functionally the same as coming back
// after > APP_MODE_HINT_TTL_MS.
const simulateAllTabsClosed = (page: Page): Promise<void> =>
  page.evaluate(
    ([sessionKey, hintKey]) => {
      globalThis.sessionStorage.removeItem(sessionKey);
      globalThis.localStorage.removeItem(hintKey);
    },
    [APP_MODE_SESSION_KEY, APP_MODE_HINT_STORAGE_KEY]
  );

test.describe('AppMode — resolver behaviour', { tag: ['@Platform'] }, () => {
  test('profile-dropdown toggle switches Classic → AI and populates session + hint', async ({
    page,
  }) => {
    await disableAiAppMode(page);
    await page.goto('/my-data', { waitUntil: 'domcontentloaded' });
    await waitForAllLoadersToDisappear(page);

    await test.step('Sanity: starts in Classic', async () => {
      await expect(page.getByTestId('left-sidebar')).toBeVisible();
      await assertAppMode(page, 'default');
    });

    await test.step('Toggle to AI via profile dropdown', async () => {
      await switchToAiModeViaProfileToggle(page);
      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
      await assertAppMode(page, 'ai');
    });

    await test.step('Cross-tab hint is populated with AI', async () => {
      const { hint } = await readAppModeStorage(page);

      expect(hint?.mode).toBe('ai');
      // Fresh — ts within the TTL window.
      expect(Date.now() - (hint?.ts ?? 0)).toBeLessThan(APP_MODE_HINT_TTL_MS);
    });
  });

  test('refresh preserves AI mode via the session tuple', async ({ page }) => {
    await disableAiAppMode(page);
    await page.goto('/my-data', { waitUntil: 'domcontentloaded' });
    await waitForAllLoadersToDisappear(page);
    await switchToAiModeViaProfileToggle(page);
    await expect(page.getByTestId('ask-sidebar')).toBeVisible();

    await test.step('Reload the tab', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('AI shell is still rendered and mode is still AI', async () => {
      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
      await assertAppMode(page, 'ai');
    });
  });

  test('new tab in the same browser inherits AI mode via the cross-tab hint', async ({
    page,
  }) => {
    await disableAiAppMode(page);
    await page.goto('/my-data', { waitUntil: 'domcontentloaded' });
    await waitForAllLoadersToDisappear(page);
    await switchToAiModeViaProfileToggle(page);
    await expect(page.getByTestId('ask-sidebar')).toBeVisible();

    // The hint is what carries the mode across tabs — sessionStorage does NOT
    // propagate to user-opened new tabs in modern browsers.
    const { hint: hintBefore } = await readAppModeStorage(page);
    expect(hintBefore?.mode).toBe('ai');

    const newTab = await page.context().newPage();
    try {
      await test.step('New tab boots into the AI shell via the hint', async () => {
        await newTab.goto('/my-data', { waitUntil: 'domcontentloaded' });
        await waitForAllLoadersToDisappear(newTab);
        await expect(newTab.getByTestId('ask-sidebar')).toBeVisible();
        await assertAppMode(newTab, 'ai');
      });
    } finally {
      await newTab.close();
    }
  });

  test('AI mode does NOT survive "all tabs closed" without the remember checkbox', async ({
    page,
  }) => {
    await disableAiAppMode(page);
    await page.goto('/my-data', { waitUntil: 'domcontentloaded' });
    await waitForAllLoadersToDisappear(page);
    await switchToAiModeViaProfileToggle(page);
    await expect(page.getByTestId('ask-sidebar')).toBeVisible();

    await test.step('Simulate closing every tab (session + hint gone)', async () => {
      await simulateAllTabsClosed(page);
    });

    await test.step('Reload — resolver falls back to default (Classic)', async () => {
      await page.goto('/my-data', { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);

      await expect(page.getByTestId('left-sidebar')).toBeVisible();
      await assertAppMode(page, 'default');
    });
  });

  test('AI mode survives "all tabs closed" when the remember checkbox is checked', async ({
    page,
  }) => {
    await disableAiAppMode(page);
    await page.goto('/my-data', { waitUntil: 'domcontentloaded' });
    await waitForAllLoadersToDisappear(page);
    await switchToAiModeViaProfileToggle(page);
    await expect(page.getByTestId('ask-sidebar')).toBeVisible();

    const rememberToggle = page
      .locator(VISIBLE_SWITCHER_CARD)
      .getByTestId('app-mode-remember-toggle');

    await test.step('Open the AI-sidebar app-mode switcher popover', async () => {
      await page.locator(VISIBLE_SWITCHER_TRIGGER).click();
      await expect(page.locator(VISIBLE_SWITCHER_CARD)).toBeVisible();
    });

    await test.step('Tick "remember" — writes appMode to per-user prefs', async () => {
      // The checkbox click fires a 300ms-debounced
      // `PUT /users/{id}/preferences/appMode` (server-persisted preference).
      // Wait for it to land before simulating "all tabs closed" — otherwise the
      // debounce can lose the race and the reload has nothing to resolve to.
      const putResponse = page.waitForResponse(isRememberPreferencePut);
      await rememberToggle.click();
      await putResponse;
      await expect(
        rememberToggle.locator('[role="checkbox"]')
      ).toHaveAttribute('aria-checked', 'true');
    });

    await test.step('Simulate closing every tab (session + hint gone)', async () => {
      await simulateAllTabsClosed(page);
    });

    await test.step('Reload — user pref boots into AI', async () => {
      await page.goto('/my-data', { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);

      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
      await assertAppMode(page, 'ai');
    });
  });

  test('fresh user with no pref, no persona, no hint → boots Classic', async ({
    page,
  }) => {
    // `disableAiAppMode` seeds the "cleared" state (no session, no hint) via an
    // init script, so a subsequent navigate simulates a truly fresh boot for
    // our persisted-storage layer.
    await disableAiAppMode(page);
    await page.goto('/my-data', { waitUntil: 'domcontentloaded' });
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('left-sidebar')).toBeVisible();
    await assertAppMode(page, 'default');
  });
});
