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
import { Page, test as playwrightTest } from '@playwright/test';
import { installServerLoadReducers } from './serverLoad';

/**
 * Errors that mean the application is dead rather than misbehaving: a chunk
 * that failed to link, or a lazy element that resolved to `undefined`. The
 * route is replaced by the error boundary, so whatever the test asks for next
 * never arrives and it dies on a timeout naming an unrelated locator — twice
 * on this branch that cost a trace download and a bundle teardown to work out
 * (chromium-04's "does not provide an export named 't'", chromium-08's #306).
 */
const FATAL_APP_ERROR =
  /does not provide an export named|Minified React error #(306|130)\b|Failed to fetch dynamically imported module|error loading dynamically imported module/i;

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
  context: async ({ context }, use, testInfo) => {
    await installServerLoadReducers(context);
    let closed = false;
    const onClose = () => {
      closed = true;
    };
    context.on('close', onClose);

    // Recorded, not thrown. Failing a test that otherwise passed would be a
    // behaviour change across every spec at once; what these cost was not
    // detection but diagnosis, so the aim is only to put the real error in the
    // report next to the timeout it caused.
    const fatalErrors: string[] = [];
    const watchPage = (page: Page) =>
      page.on('pageerror', (error) => {
        const text = error.stack ?? error.message;
        if (FATAL_APP_ERROR.test(text)) {
          fatalErrors.push(text);
        }
      });
    context.pages().forEach(watchPage);
    context.on('page', watchPage);

    try {
      await use(context);
    } finally {
      try {
        if (!closed) {
          await context.unrouteAll({ behavior: 'wait' });
        }
      } finally {
        context.off('close', onClose);
        context.off('page', watchPage);
        if (fatalErrors.length > 0) {
          await testInfo
            .attach('application-fatal-error', {
              body: fatalErrors.join('\n\n'),
              contentType: 'text/plain',
            })
            .catch(() => undefined);
        }
      }
    }
  },
});

export { expect } from '@playwright/test';
