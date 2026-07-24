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
import {
  defineConfig,
  devices,
  type ReporterDescription,
} from '@playwright/test';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
dotenv.config();

/**
 * HTTP/2 (TLS) mode is opt-in via PW_PROTOCOL=h2. When set, the suite runs
 * against the runtime h2 connector generated from conf/openmetadata.yaml on
 * https://localhost:8585 with the self-signed test certificate. The default
 * `yarn playwright:run` flow is unaffected and still targets HTTP/1.1.
 */
const isH2Mode = process.env.PW_PROTOCOL === 'h2';
const defaultBaseURL = isH2Mode
  ? 'https://localhost:8585'
  : 'http://localhost:8585';

const shardPlan = process.env.PW_SHARD_PLAN
  ? JSON.parse(readFileSync(process.env.PW_SHARD_PLAN, 'utf8'))
  : undefined;
const hasDedicatedIngestionLane =
  Boolean(shardPlan) || process.env.PW_DEDICATED_INGESTION === 'true';
const isPlannedShard = Boolean(shardPlan);
const hasPreseededState = process.env.PW_PRESEEDED_STATE === 'true';
const authDependencies = hasPreseededState ? [] : ['setup'];
const entityDependencies = hasPreseededState
  ? []
  : ['setup', 'entity-data-setup'];
const entityTeardown = hasPreseededState ? undefined : 'entity-data-teardown';
const shardGrep = shardPlan?.grep ? new RegExp(shardPlan.grep) : undefined;
const dedicatedStateTestIgnore = hasDedicatedIngestionLane
  ? [
      '**/SearchSettings.spec.ts',
      '**/SearchSeparation/**',
      '**/*AfterReindex.spec.ts',
    ]
  : [];
const combineGrep = (base?: RegExp) => {
  if (!base) {
    return shardGrep;
  }
  if (!shardGrep) {
    return base;
  }

  return new RegExp(
    `(?=.*(?:${base.source}))(?=.*(?:${shardGrep.source}))`,
    [...new Set(`${base.flags}${shardGrep.flags}`)].join('')
  );
};
const reporters: ReporterDescription[] = [
  ['list'],
  ...(!isPlannedShard
    ? [['html', { outputFolder: './playwright/output/playwright-report' }]]
    : []),
  [
    '@estruyf/github-actions-reporter',
    {
      useDetails: true,
      showError: true,
      includeResults: ['skipped', 'fail', 'flaky'],
      showArtifactsLink: true,
    },
  ],
  ...(isPlannedShard
    ? [
        [
          'blob',
          {
            outputDir: './playwright/output/blob-report',
            fileName: `report-${process.env.PW_SHARD_ID ?? 'local'}.zip`,
          },
        ],
      ]
    : [['blob']]),
  ['json', { outputFile: './playwright/output/results.json' }],
  ...(isPlannedShard
    ? [
        [
          './playwright/reporters/PerformanceReporter.ts',
          { outputFile: './playwright/output/playwright-timings.json' },
        ],
      ]
    : []),
];

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
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI
    ? Number(process.env.PW_WORKERS ?? shardPlan?.workers ?? 3)
    : undefined,
  // Stop catastrophically broken shards after enough failures to establish
  // that the run cannot be useful. Healthy runs never approach this limit.
  maxFailures: 50,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: reporters,
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
    {
      name: 'bundle-smoke',
      testMatch: '**/bundle.smoke.ts',
      dependencies: authDependencies,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
    },
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
      grep: shardGrep,
      // Added admin setup as a dependency. This will authorize the page with an admin user before running the test. doc: https://playwright.dev/docs/auth#multiple-signed-in-roles
      dependencies: entityDependencies,
      grepInvert: [
        /@data-insight/,
        /@basic/,
        ...(hasDedicatedIngestionLane ? [/@ingestion/] : []),
        /@knowledge-graph/,
        /@ontology-rdf/,
      ],
      teardown: entityTeardown,
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
        ...dedicatedStateTestIgnore,
        '**/DomainIsolation/**',
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
      testMatch: [
        '**/OktaSelfSignupClaims.spec.ts',
        '**/SSOLogin.spec.ts',
        '**/SSORenewal.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'] },
      fullyParallel: false,
      workers: 1,
    },
    {
      name: 'search-nightly',
      testMatch: ['**/Search/**'],
      grep: shardGrep,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: authDependencies,
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
      name: 'Ontology RDF',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup', 'entity-data-setup'],
      grep: /ontology-rdf/,
      teardown: 'entity-data-teardown',
    },
    {
      name: 'DataAssetRulesEnabled',
      testMatch: '**/DataAssetRulesEnabled.spec.ts',
      grep: shardGrep,
      use: { ...devices['Desktop Chrome'] },
      dependencies: authDependencies,
      fullyParallel: true,
    },
    {
      name: 'DataAssetRulesDisabled',
      testMatch: '**/DataAssetRulesDisabled.spec.ts',
      grep: shardGrep,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['DataAssetRulesEnabled'],
      fullyParallel: true,
    },
    {
      name: 'search-rbac-setup',
      testMatch: '**/search-rbac.setup.ts',
      dependencies: authDependencies,
      teardown: 'search-rbac-teardown',
    },
    {
      name: 'search-rbac-teardown',
      testMatch: '**/search-rbac.teardown.ts',
    },
    {
      name: 'Basic',
      grep: combineGrep(/@basic/),
      testIgnore: dedicatedStateTestIgnore,
      use: { ...devices['Desktop Chrome'] },
      dependencies: entityDependencies,
      fullyParallel: true,
    },
    ...(hasDedicatedIngestionLane
      ? [
          {
            name: 'Ingestion',
            grep: combineGrep(/@ingestion/),
            testIgnore: '**/nightly/**',
            use: { ...devices['Desktop Chrome'] },
            dependencies: entityDependencies,
            fullyParallel: false,
            workers: 1,
            teardown: entityTeardown,
          },
        ]
      : []),
    {
      name: 'SearchRBAC',
      testMatch: '**/SearchRBAC.spec.ts',
      grep: shardGrep,
      dependencies: ['search-rbac-setup'],
      use: { ...devices['Desktop Chrome'] },
      fullyParallel: false,
      workers: 1,
    },
    // Domain isolation E2E suite (issue #24180). Runs in its own shard because several specs
    // toggle the global `enableAccessControl` search setting; serial execution (workers: 1)
    // prevents cross-file races on that shared setting.
    {
      name: 'DomainIsolation',
      testMatch: '**/DomainIsolation/**',
      grep: shardGrep,
      use: { ...devices['Desktop Chrome'] },
      dependencies: authDependencies,
      fullyParallel: false,
      workers: 1,
    },
    ...(hasDedicatedIngestionLane
      ? [
          {
            name: 'Reindex',
            testMatch: [
              '**/SearchSeparation/*.spec.ts',
              '**/*AfterReindex.spec.ts',
            ],
            grep: shardGrep,
            use: { ...devices['Desktop Chrome'] },
            dependencies: authDependencies,
            fullyParallel: false,
            workers: 1,
          },
          {
            name: 'GlobalSettings',
            testMatch: '**/SearchSettings.spec.ts',
            grep: shardGrep,
            use: { ...devices['Desktop Chrome'] },
            dependencies: authDependencies,
            fullyParallel: false,
            workers: 1,
          },
        ]
      : []),
    // Each planned matrix job restores its own database/search clone. These projects
    // share one single-worker job, while legacy runs retain the Chromium dependency
    // because they share one mutable environment.
    {
      name: 'SystemCertificationTags',
      testMatch: '**/SystemCertificationTags.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: isPlannedShard ? authDependencies : ['setup', 'chromium'],
      grep: shardGrep,
      fullyParallel: false,
    },
    {
      name: 'IntakeForm',
      testMatch: '**/IntakeForm.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: isPlannedShard ? authDependencies : ['setup', 'chromium'],
      grep: shardGrep,
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
