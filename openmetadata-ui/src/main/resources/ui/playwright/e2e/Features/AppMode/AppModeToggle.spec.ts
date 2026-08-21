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
 * Ported from `collate-ui`'s `AppMode/AppModeToggle.spec.ts`.
 *
 * The Collate original also covered "switches back to Classic from the AI
 * sidebar interface toggle" — that scenario requires already being IN a
 * second, installed mode. Stock OM registers no mode beyond the default:
 * `useAppRoutesRegistry` starts empty and nothing under
 * `openmetadata-ui/src` calls `registerRoutes(...)` — only a downstream
 * plugin (e.g. Collate's AskCollate) does. That half of the spec stays
 * Collate-only; see `task-6-report.md`. What IS portable, and exercised
 * below, is the switcher's own behaviour when no such mode is installed —
 * true out of the box for every OM deployment.
 */

import { expect, test } from '@playwright/test';
import { redirectToHomePage } from '../../../utils/common';
import { openAppModeSwitcher } from '../../../utils/appMode';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('AppMode — interface toggle', () => {
  test('disables the AI option in the switcher when no second mode is installed', async ({
    page,
  }) => {
    await test.step('Load home in the default (Classic) mode', async () => {
      await redirectToHomePage(page);
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Open the profile dropdown and the app-mode switcher', async () => {
      await openAppModeSwitcher(page);
    });

    await test.step('The AI option is present but disabled; Classic is marked current', async () => {
      await expect(page.getByTestId('app-mode-option-ai')).toBeDisabled();
      await expect(page.getByTestId('app-mode-option-classic')).toBeEnabled();
      await expect(page.getByTestId('classic-current-badge')).toBeVisible();
    });
  });
});
