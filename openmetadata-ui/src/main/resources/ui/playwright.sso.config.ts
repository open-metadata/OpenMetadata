/*
 *  Copyright 2025 Collate.
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
 * Playwright configuration for SSO Authentication E2E tests.
 *
 * These tests require:
 *   1. Mock OIDC provider running on port 9090
 *      docker compose --profile sso-test up -d mock-oidc-provider
 *
 *   2. OM server configured with custom-oidc auth (use .env.sso-test):
 *      cd docker/development
 *      docker compose --env-file .env.sso-test up -d
 *
 *   3. Run tests:
 *      npx playwright test --config=playwright.sso.config.ts
 *
 * This config is fully isolated from the basic-auth playwright.config.ts.
 * It does NOT depend on auth.setup.ts or entity-data setup.
 */
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './playwright/e2e/Auth',
  outputDir: './playwright/output/sso-test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  maxFailures: 10,
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright/output/sso-playwright-report' }],
    ['json', { outputFile: './playwright/output/sso-results.json' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:8585',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 60000,
  },
  projects: [
    {
      name: 'sso-chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/*.spec.ts',
    },
    {
      name: 'sso-webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: '**/*.spec.ts',
    },
  ],
  timeout: 90000,
  expect: { timeout: 15_000 },
});
