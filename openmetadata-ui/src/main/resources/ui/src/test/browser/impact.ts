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
import { afterAll, beforeAll } from 'vitest';
import { commands } from 'vitest/browser';

declare module 'vitest/browser' {
  interface BrowserCommands {
    recordImpact: (used: string[]) => Promise<void>;
  }
}

type FileCoverage = {
  path: string;
  f: Record<string, number>;
  s: Record<string, number>;
};

const total = (counts: Record<string, number>) =>
  Object.values(counts).reduce((sum, count) => sum + count, 0);

/**
 * Hits per instrumented file: function calls, or statement hits for a file
 * with no functions (constants). Imported-but-unused code never counts.
 */
const hits = () => {
  const store =
    (globalThis as { __VITEST_COVERAGE__?: Record<string, FileCoverage> })
      .__VITEST_COVERAGE__ ?? {};

  return new Map(
    Object.values(store).map((file) => [
      file.path,
      Object.keys(file.f).length ? total(file.f) : total(file.s),
    ])
  );
};

/**
 * Records which source files this test file executed, for test selection.
 * Only active on main's full run with coverage (BROWSER_IMPACT_DIR). Workers
 * reuse modules across files (`isolate: false`), so code that only runs at
 * load time is attributed to the first file; the selection script covers that
 * by also matching the direct imports of every executed file.
 */
export const recordImpact = () => {
  let before = new Map<string, number>();

  beforeAll(() => {
    before = hits();
  });

  afterAll(async () => {
    const used = [...hits()]
      .filter(([path, count]) => count > (before.get(path) ?? 0))
      .map(([path]) => path);

    await commands.recordImpact(used);
  });
};
