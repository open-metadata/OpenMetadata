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
import { defineConfig } from '@playwright/test';

/**
 * Where this lane may write.
 *
 * CI runs these in a container that mounts the workspace read-only, so nothing
 * can be written next to the config -- not a trace, not a report. The workflow
 * bind-mounts a writable directory and names it here; locally the default is a
 * gitignored folder beside the tests.
 */
const artifactRoot =
  process.env.PW_BROWSER_HELPER_OUTPUT ?? './output/browser-helper-results';

/**
 * Playwright empties `outputDir` before a run by removing the directory
 * itself, tolerating only EBUSY if that fails. In CI `artifactRoot` is a
 * bind-mount point inside a --read-only container, where removing the mount
 * point fails with EROFS -- rmdir needs write permission on the parent, and
 * the parent is `/`. Keep the run's output one level inside the mount so the
 * removal targets an ordinary directory.
 */
const outputDir = `${artifactRoot}/test-results`;

export default defineConfig({
  captureGitInfo: { commit: false, diff: false },
  testDir: './browser-tests',
  retries: 0,
  workers: 3,
  fullyParallel: true,
  outputDir,
  use: {
    /* Failure-only, so a green run writes nothing. Without these a failure in
     * this lane is a single line of `list` output and the container is gone. */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [
    ['list'],
    /* Machine-readable failures, for the same reason the main config always
     * keeps a json reporter: stdout scrolls, `results.json` names the test. */
    ['json', { outputFile: `${artifactRoot}/results.json` }],
  ],
});
