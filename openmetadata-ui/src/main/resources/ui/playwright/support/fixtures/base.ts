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
import { test as playwrightTest } from '@playwright/test';
import { installServerLoadReducers } from './serverLoad';

/**
 * The suite's single entry point for `test`.
 *
 * It overrides the built-in `context` fixture rather than `page`, which is what
 * makes it reach every spec shape without them opting in: the built-in `page`
 * is derived from `context`, and `test.use({ storageState })` is applied as a
 * context option, so both keep working untouched.
 *
 * Specs that build their own pages via `browser.newContext()` or
 * `browser.newPage()` bypass this fixture entirely and call
 * `installServerLoadReducers` themselves — see `e2e/fixtures/pages.ts` and
 * `support/fixtures/userPages.ts`.
 */
export const test = playwrightTest.extend({
  context: async ({ context }, use) => {
    await installServerLoadReducers(context);

    await use(context);
  },
});

export { expect } from '@playwright/test';
