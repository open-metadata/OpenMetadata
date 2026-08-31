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

import { Page } from '@playwright/test';

/**
 * Enter AI app mode the OSS-native way — no plugin/app install gate. OSS ships
 * the AI shell in-tree (see InterfaceModeMenuItem / SettingsAppModePage), so
 * the app-mode store hydrates straight from the session tuple that
 * `writeAppMode` persists. Seeding that tuple with an init script (which runs
 * before the app bundle on every subsequent navigation) is enough for the next
 * `goto` to boot into the AI shell.
 *
 * Keys and values mirror `src/constants/appMode.constants.ts`
 * (`APP_MODE_SESSION_KEY = 'omAppMode'`, `APP_MODE_HINT_STORAGE_KEY =
 * 'omAppModeHint'`, `AI_APP_MODE = 'ai'`) and the tuple shape written by
 * `writeAppMode` in `src/hooks/useAppMode.ts`.
 */
export const seedAiAppMode = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      'omAppMode',
      JSON.stringify({ personaAppMode: null, mode: 'ai', source: 'manual' })
    );
    window.localStorage.setItem(
      'omAppModeHint',
      JSON.stringify({ mode: 'ai', ts: Date.now() })
    );
  });
};
