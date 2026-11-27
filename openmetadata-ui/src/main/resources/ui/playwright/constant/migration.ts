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
 * Marks a Playwright test whose coverage now lives in a cheaper layer. The
 * test keeps running until the replacement is validated, then it is deleted.
 * `npx playwright test --list --grep @migrated-browser` (or
 * `@migrated-java-it`) lists what moved; `--reporter=json` adds where.
 *
 *   test('Tier Add, Update and Remove', migratedTo.browser(
 *     'src/test/browser/entity-matrix/EntityDataSteward.browser.test.tsx'
 *   ), async ({ page }) => { ... });
 */
const marker = (tag: string, replacement: string) => ({
  tag,
  annotation: { type: 'migrated-to', description: replacement },
});

export const migratedTo = {
  /** UI behaviour now covered by a Vitest browser test (path from the UI root). */
  browser: (testFile: string) => marker('@migrated-browser', testFile),
  /** API behaviour now covered by a Java integration test (`Class#method`). */
  javaIT: (testRef: string) => marker('@migrated-java-it', testRef),
  /** UI part in a browser test, API part in a Java integration test. */
  split: (testFile: string, testRef: string) => {
    const ui = marker('@migrated-browser', testFile);
    const api = marker('@migrated-java-it', testRef);

    return {
      tag: [ui.tag, api.tag],
      annotation: [ui.annotation, api.annotation],
    };
  },
};
