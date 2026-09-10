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
      },
    ],
    ['blob'],
    ['json', { outputFile: './playwright/output/results.json' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:8585',

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
        '**/Auth/**',
        '**/DataAssetRulesEnabled.spec.ts',
        '**/DataAssetRulesDisabled.spec.ts',
        '**/SystemCertificationTags.spec.ts',
        '**/SearchRBAC.spec.ts',
        // Toggles the global enableAccessControl search setting in beforeAll/afterAll —
        // same reason SearchRBAC.spec.ts is isolated below; runs in the SearchRBAC
        // project instead so it never races other chromium tests on that setting.
        '**/DomainIncidentIsolation.spec.ts',
        '**/SSOLogin.spec.ts',
        // Runs in its own post-chromium project to prevent IntakeForm.spec.ts's
        // per-test beforeEach (which deletes all intake forms) from racing against
        // the domain intake form this spec creates in beforeAll.
        '**/IntakeFormCustomPropertyFields.spec.ts',
        // IntakeForm.spec.ts sets required intake-form fields that cause other
        // chromium tests (e.g. DomainDataProductsWidgets) to fail with 400 when
        // they create domains or data products. Isolate it post-chromium so those
        // parallel tests never see active required fields.
        '**/IntakeForm.spec.ts',
      ],
    },
    {
      name: 'sso-auth',
      testMatch: ['**/SSOLogin.spec.ts', '**/SSORenewal.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
      fullyParallel: false,
      workers: 1,
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
      // Also runs DomainIncidentIsolation.spec.ts (1.13 backport of the #31740 domain-RBAC
      // fix) — it toggles the same global enableAccessControl setting in beforeAll/afterAll,
      // so it needs the same isolation from chromium. workers:1 serializes the two spec
      // files against each other too (a second file here would otherwise be free to run
      // on a separate worker and race the same setting within this one project).
      name: 'SearchRBAC',
      testMatch: [
        '**/SearchRBAC.spec.ts',
        '**/DomainIncidentIsolation.spec.ts',
      ],
      dependencies: ['DataAssetRulesDisabled'],
      use: { ...devices['Desktop Chrome'] },
      teardown: 'entity-data-teardown',
      workers: 1,
    },
    // Compatibility shim for PR workflows that still pass --project=DomainIsolation.
    // The DomainIsolation E2E suite is not backported to 1.13, so this project intentionally
    // matches no tests while allowing the workflow argument to resolve.
    {
      name: 'DomainIsolation',
      testMatch: [],
    },
    // Compatibility shim for PR workflows that still pass --project=search-nightly.
    // The dedicated search nightly suite is not backported to 1.13, so this project
    // intentionally matches no tests while allowing the workflow argument to resolve.
    {
      name: 'search-nightly',
      testMatch: [],
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
    // IntakeFormCustomPropertyFields creates a domain intake form in beforeAll
    // and relies on it persisting across its serial tests. IntakeForm.spec.ts
    // has a per-test beforeEach that deletes ALL intake forms, so the two specs
    // race if they run concurrently.
    //
    // We deliberately do NOT declare the chromium project as a dependency here:
    // forcing the entire chromium suite to run before this single file is huge
    // wasted work (blows the CI job timeout, and no one wants to wait 40+ min
    // locally either). Instead, run this project by itself with
    // `--project=IntakeFormCustomPropertyFields` — or with `--project=IntakeForm`,
    // which pulls this in as its dep.
    //
    // DO NOT run `--project=chromium --project=IntakeFormCustomPropertyFields`
    // (or the full suite with no filter) concurrently — it will race with
    // chromium tests that create domains/data-products and fail with 400s.
    {
      name: 'IntakeFormCustomPropertyFields',
      testMatch: '**/IntakeFormCustomPropertyFields.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      fullyParallel: false,
    },
    // IntakeForm.spec.ts has a per-test beforeEach that deletes ALL intake forms.
    // While active, its required fields also break parallel chromium tests that
    // create domains or data products (400 errors).
    //
    // Same rule as IntakeFormCustomPropertyFields above — the chromium project
    // is NOT declared as a dep. Run only `--project=IntakeForm` (which chains
    // IntakeFormCustomPropertyFields via its dep) on a dedicated shard.
    //
    // DO NOT run this project concurrently with the chromium project.
    {
      name: 'IntakeForm',
      testMatch: '**/IntakeForm.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup', 'IntakeFormCustomPropertyFields'],
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
