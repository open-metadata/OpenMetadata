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
 * This configuration is specifically for Okta login tests with separate backend.
 */
export default defineConfig({
  testDir: './playwright/login-flows',
  outputDir: './playwright/output/okta-test-results',
  /* Run tests in files in parallel */
  fullyParallel: false, // Use single worker for Okta tests to ensure isolation
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Use single worker for Okta tests */
  workers: 1,
  maxFailures: 10,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright/output/okta-playwright-report' }],
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
    trace: 'on-first-retry',
    /* Screenshot on failure. */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for Okta login tests */
  projects: [
    {
      name: 'okta-login-tests',
      use: {
        ...devices['Desktop Chrome'],
        // Isolated storage state - no shared auth
        storageState: undefined,
        // Add arguments to make browser appear more like a regular user browser
        launchOptions: {
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-first-run',
            '--no-service-autorun',
            '--password-store=basic',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-field-trial-config',
            '--disable-back-forward-cache',
            '--disable-ipc-flooding-protection',
            '--enable-features=NetworkService,NetworkServiceLogging',
            '--disable-features=TranslateUI,BlinkGenPropertyTrees',
            '--flag-switches-begin',
            '--flag-switches-end',
          ],
        },
        // Set a regular user agent
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      // No dependencies - completely independent
      testMatch: '**/*.spec.ts',
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
