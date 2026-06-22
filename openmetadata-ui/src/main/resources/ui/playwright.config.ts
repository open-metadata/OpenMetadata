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
 * HTTP/2 (TLS) mode is opt-in via PW_PROTOCOL=h2. When set, the suite runs
 * against the h2 connector configured in conf/openmetadata-h2-test.yaml on
 * https://localhost:8585 with the self-signed cert under
 * openmetadata-service/src/test/resources/localhost-h2.p12. The default
 * `yarn playwright:run` flow is unaffected and still targets HTTP/1.1.
 */
const isH2Mode = process.env.PW_PROTOCOL === 'h2';
const defaultBaseURL = isH2Mode
  ? 'https://localhost:8585'
  : 'http://localhost:8585';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './playwright/e2e',
  outputDir: './playwright/output/test-results',
  // Omit {projectName} and {platform} from snapshot filenames so a single
  // reference image works on both macOS dev machines and Linux CI runners.
  // Edge lines in the lineage PNG are pure bezier geometry (no text/fonts)
  // and render identically across platforms; the threshold in toMatchSnapshot
  // absorbs any minor anti-aliasing differences in the node-card text areas.
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/__snapshots__/{testFileName}-snapshots/{arg}{ext}',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 3 : undefined,
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
        includeResults: ['skipped', 'fail', 'flaky'], // skip pass to reduce noice
        showArtifactsLink: true,
      },
    ],
    ['blob'],
    ['json', { outputFile: './playwright/output/results.json' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || defaultBaseURL,

    /* Self-signed cert in h2 mode — accept it. No effect on HTTP/1.1 runs. */
    ignoreHTTPSErrors: isH2Mode,

    /* Collect trace and video on every failure (not just retries) for debugging */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',

    /* Add navigation timeout to prevent infinite hangs on networkidle waits.
     * This ensures page.goto() and waitForLoadState() calls timeout after 60s
     * instead of hanging indefinitely under resource pressure. */
    navigationTimeout: 60000,
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
      grepInvert: [/@data-insight/, /@basic/, /@knowledge-graph/],
      teardown: 'entity-data-teardown',
      testIgnore: [
        '**/nightly/**',
        '**/Search/**',
        '**/Auth/**',
        '**/Http2/**',
        '**/DataAssetRulesEnabled.spec.ts',
        '**/DataAssetRulesDisabled.spec.ts',
        '**/SystemCertificationTags.spec.ts',
        '**/SearchRBAC.spec.ts',
        '**/SSOLogin.spec.ts',
        '**/IntakeForm.spec.ts',
      ],
    },
    // Only register the h2 project when explicitly opted in. Always-on registration would force
    // Playwright to do discovery for it on every default run even though its spec files are
    // skipped — small cost, but pointless when the h2 server isn't running.
    ...(isH2Mode
      ? [
          {
            name: 'chromium-h2',
            testMatch: '**/Http2/**',
            use: { ...devices['Desktop Chrome'] },
            fullyParallel: true,
          },
        ]
      : []),
    {
      name: 'sso-auth',
      testMatch: ['**/SSOLogin.spec.ts', '**/SSORenewal.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
      fullyParallel: false,
      workers: 1,
    },
    {
      name: 'search-nightly',
      testMatch: ['**/Search/**'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
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
      name: 'Knowledge Graph',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup', 'entity-data-setup'],
      grep: /knowledge-graph/,
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
    {
      name: 'Basic',
      grep: [/@basic/],
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      fullyParallel: true,
    },
    {
      name: 'SearchRBAC',
      testMatch: '**/SearchRBAC.spec.ts',
      dependencies: ['DataAssetRulesDisabled'],
      use: { ...devices['Desktop Chrome'] },
      teardown: 'entity-data-teardown',
    },
    // System Certification Tags tests modify global shared state (system tags like Gold, Silver, Bronze)
    // They must run in isolation after the main chromium project to avoid flakiness
    {
      name: 'SystemCertificationTags',
      testMatch: '**/SystemCertificationTags.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup', 'chromium'],
      fullyParallel: false,
    },
    {
      name: 'IntakeForm',
      testMatch: '**/IntakeForm.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup', 'chromium'],
      fullyParallel: false,
    },
  ],

  // Increase timeout for the test
  timeout: 60000,
  expect: { timeout: 15_000 },

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
