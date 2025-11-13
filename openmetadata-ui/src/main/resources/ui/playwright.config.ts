/*
 *  Copyright 2024 Collate.
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
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
dotenv.config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './playwright/e2e',
  outputDir: './playwright/output/test-results',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 4 : undefined,
  maxFailures: 500,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright/output/playwright-report' }],
    [
      '@estruyf/github-actions-reporter',
      {
        useDetails: true,
        showError: true,
      },
    ],
    ['blob'],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:8585',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
    /* Screenshot on failure. */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    // Admin authentication setup doc: https://playwright.dev/docs/auth#multiple-signed-in-roles
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    {
      name: 'entity-data-setup',
      testMatch: '**/entity-data.setup.ts',
      dependencies: ['setup'],
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Added admin setup as a dependency. This will authorize the page with an admin user before running the test. doc: https://playwright.dev/docs/auth#multiple-signed-in-roles
      dependencies: ['setup', 'entity-data-setup'],
      grepInvert: /data-insight/,
      teardown: 'entity-data-teardown',
      testIgnore: [
        '**/nightly/**',
        '**/DataAssetRulesEnabled.spec.ts',
        '**/DataAssetRulesDisabled.spec.ts',
      ],
    },
    {
      name: 'entity-data-teardown',
      testMatch: '**/entity-data.teardown.ts',
    },
    {
      name: 'data-insight-application',
      dependencies: ['setup', 'entity-data-setup'],
      testMatch: '**/dataInsightApp.ts',
    },
    {
      name: 'Data Insight',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['data-insight-application'],
      grep: /data-insight/,
      teardown: 'entity-data-teardown',
    },
    {
      name: 'DataAssetRulesEnabled',
      testMatch: '**/DataAssetRulesEnabled.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      fullyParallel: true,
    },
    {
      name: 'DataAssetRulesDisabled',
      testMatch: '**/DataAssetRulesDisabled.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['DataAssetRulesEnabled'],
      fullyParallel: true,
    },
  ],

  // Increase timeout for the test
  timeout: 60000,

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
