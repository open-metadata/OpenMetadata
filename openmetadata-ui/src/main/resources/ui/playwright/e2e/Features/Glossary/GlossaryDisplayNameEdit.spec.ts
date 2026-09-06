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
import test, { expect } from '@playwright/test';
import { performAdminLogin } from '../../../utils/admin';

// E2E regression test for the "stale left-panel displayName after a
// displayName-only edit" bug. The fix lives in `useGlossaryStore.updateActiveGlossary`,
// which must publish a fresh `glossaries` array reference so the `[glossaries]`-keyed
// `menuItems` useMemo in `GlossaryLeftPanel` recomputes. This test drives the real
// glossary rename flow through the browser (manage -> rename -> edit displayName ->
// save) against a live backend, then asserts the left-panel menu updates without a
// page reload or list refetch.
const GLOSSARY_NAME = 'E2eDisplayNameFix';
const DISPLAY_INITIAL = 'E2eDisplayNameFix';
const DISPLAY_RENAMED = 'E2eDisplayNameFix Renamed';

test.describe('Glossary displayName-only edit — left panel freshness', () => {
  test('left panel menu updates to the new displayName after a displayName-only edit', async ({
    browser,
  }) => {
    // 1. Login + get an authenticated page + API context (creates real data, so we clean up).
    const admin = await performAdminLogin(browser, { navigate: true });
    const page = admin.page;
    const apiContext = admin.apiContext;
    const token = admin.token;
    const authHeader = { Authorization: `Bearer ${token}` };

    // Use an explicit wide viewport so `ResizableLeftPanels` doesn't auto-collapse
    // the glossary list panel (the bug is about that panel's menu labels).
    await page.setViewportSize({ width: 1600, height: 900 });

    try {
      // Cleanup any leftover from a prior run, including soft-deleted records that
      // would 409 the create. Use recursive hard delete so re-runs are idempotent.
      await apiContext
        .delete(
          `/api/v1/glossaries/name/${GLOSSARY_NAME}?recursive=true&hardDelete=true`,
          { headers: authHeader }
        )
        .catch(() => undefined);

      const create = await apiContext.post('/api/v1/glossaries', {
        data: {
          name: GLOSSARY_NAME,
          displayName: DISPLAY_INITIAL,
          description: 'e2e regression target for displayName-only edit',
        },
        headers: authHeader,
      });
      expect(
        create.ok(),
        `create glossary: ${await create.text()}`
      ).toBeTruthy();

      // 2. Open the Glossary page on the new glossary. Wait for the glossary
      //    header's "manage" button — a definitive signal that the glossary has
      //    loaded and the right panel rendered — before asserting on the left
      //    panel menu (the menu itself is lazy-filled after the list fetch).
      await page.goto(`/glossary/${GLOSSARY_NAME}`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByTestId('manage-button')).toBeVisible({
        timeout: 60000,
      });

      const leftPanel = page.getByTestId('glossary-left-panel');

      // The menu initially shows the original displayName. The list panel
      // collapses its width to 0 until the resizable container measures, but
      // the antd Menu items are still in the DOM and readable — assert on
      // text presence (attached) rather than strict viewport visibility.
      await expect(
        leftPanel.getByText(DISPLAY_INITIAL, { exact: true })
      ).toBeAttached({
        timeout: 15000,
      });

      // 3. Open the glossary header "manage" dropdown and click the Rename item,
      //    which opens `EntityNameModal` (`data-testid="entity-name-modal"`).
      await page.getByTestId('manage-button').click();
      await page.getByTestId('rename-button').click();
      const nameModal = page.getByTestId('entity-name-modal');
      await expect(nameModal).toBeVisible();

      // 4. Change ONLY the displayName (leave the name field untouched) and save —
      //    this is exactly the displayName-only flow whose `name` is unchanged, so
      //    `GlossaryPage.updateGlossary` skips the `fetchGlossaryList` refresh.
      const displayNameInput = page.getByTestId('displayName');
      await displayNameInput.fill('');
      await displayNameInput.fill(DISPLAY_RENAMED);
      await page.getByTestId('save-button').click();

      // 5. The active-glossary-driven glossary header updates first; the left panel
      //    menu must follow (the fix). Before the fix, `updateActiveGlossary` mutated
      //    `glossaries` in place, so the `[glossaries]`-keyed memo kept the stale label
      //    until a list refetch / reload. Assert on attachment (the menu DOM) so a
      //    zero-width resizable panel doesn't mask the regression. Use exact text
      //    matching so the renamed label (which contains the original as a prefix)
      //    doesn't satisfy the "stale label still present" check.
      await expect(
        leftPanel.getByText(DISPLAY_RENAMED, { exact: true })
      ).toBeAttached({
        timeout: 15000,
      });
      await expect(
        leftPanel.getByText(DISPLAY_INITIAL, { exact: true })
      ).toHaveCount(0);

      // 6. Backend persisted the new displayName (round-trip sanity).
      const fetched = await apiContext.get(
        `/api/v1/glossaries/name/${GLOSSARY_NAME}`,
        { headers: authHeader }
      );
      const fetchedBody = await fetched.json();
      expect(fetchedBody.displayName).toBe(DISPLAY_RENAMED);
      expect(fetchedBody.name).toBe(GLOSSARY_NAME);
    } finally {
      // 7. Always tear down the e2e glossary so reruns are idempotent. Recursive
      //    hard delete clears both live and previously soft-deleted records that
      //    would otherwise 409 the next run's create.
      await apiContext
        .delete(
          `/api/v1/glossaries/name/${GLOSSARY_NAME}?recursive=true&hardDelete=true`,
          { headers: authHeader }
        )
        .catch(() => undefined);
      await admin.afterAction();
    }
  });
});
