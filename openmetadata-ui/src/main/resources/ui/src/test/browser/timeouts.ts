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

/** Set by vitest.browser.config.ts: 2 under `--coverage`, otherwise 1. */
declare const __BROWSER_TEST_TIME_SCALE__: number;

/**
 * A suite's own time limit, scaled for coverage runs. A limit set on a
 * `describe` overrides the CLI `--testTimeout`, so without this a coverage
 * run (istanbul slows a cold page load several times over) would hit the
 * same limit an uninstrumented run gets.
 */
export const suiteTimeout = (ms: number) => ({
  timeout: ms * __BROWSER_TEST_TIME_SCALE__,
});
