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

// Records the product tour's fixtures; never part of a test run, which is why
// it lives outside playwright/. See
// recordProductTourFixtures.ts.
export default defineConfig({
  testDir: './',
  testMatch: 'recordProductTourFixtures.ts',
  retries: 0,
  workers: 1,
  timeout: 10 * 60 * 1000,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:8585',
    viewport: { width: 1440, height: 900 },
  },
});
