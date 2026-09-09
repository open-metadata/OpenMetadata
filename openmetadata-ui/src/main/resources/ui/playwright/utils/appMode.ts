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

const APP_MODE_SESSION_KEY = 'omAppMode';

/**
 * Put the tab into AI (app) mode before the app boots.
 *
 * AI mode is off unless the session says otherwise: `useAppMode` reads
 * `sessionStorage[omAppMode]` and otherwise falls back to the default mode, so
 * a fresh browser lands on the classic routes and the `/observability/*` route
 * table never mounts. A spec that relies on the signed-in account already
 * preferring AI mode passes only where that account happens to have it set.
 *
 * `source: 'manual'` makes the tuple sticky — the boot resolver re-resolves
 * only tuples it wrote itself (`source: 'boot'`), so this survives hydration.
 */
export const enableAiAppMode = async (page: Page): Promise<void> => {
  await page.addInitScript((key) => {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({ mode: 'ai', personaAppMode: null, source: 'manual' })
    );
  }, APP_MODE_SESSION_KEY);
};
