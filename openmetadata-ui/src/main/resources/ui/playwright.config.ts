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
 * against the h2 connector configured in conf/openmetadata-h2-test.yaml on
 * https://localhost:8585 with the self-signed cert under
 * openmetadata-service/src/test/resources/localhost-h2.p12. The default
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
const hasDedicatedImportExportLane =
  Boolean(shardPlan) || process.env.PW_DEDICATED_IMPORT_EXPORT === 'true';
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
// Tests tagged @quarantine are known-flaky and must not run in any lane, so a
// flake cannot eject a PR from the merge queue while it is still being
// diagnosed. Each entry is listed with its evidence in
// playwright/QUARANTINE.md and is expected to be fixed and untagged, not to
// live there. PLAYWRIGHT_RUN_QUARANTINED=true flips this to run *only* the
// quarantined set, for a soak lane that tracks whether they are still failing.
//
// This has to be applied per project, not at the top level: Playwright replaces
// (never merges) a top-level grepInvert with a project's own, and the chromium
// project already sets one to route @basic/@ingestion/@data-insight into their
// dedicated lanes — so a top-level grepInvert is silently dropped for the very
// project that runs most of the suite.
const QUARANTINE_TAG = /@quarantine/;
const runQuarantinedOnly = Boolean(process.env.PLAYWRIGHT_RUN_QUARANTINED);
const asRegExpList = (value?: RegExp | RegExp[]) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const andQuarantine = (base: RegExp) =>
  new RegExp(
    `(?=.*(?:${base.source}))(?=.*(?:${QUARANTINE_TAG.source}))`,
    [...new Set(`${base.flags}${QUARANTINE_TAG.flags}`)].join('')
  );

// Fixture projects hold no @quarantine tests, so the soak lane must leave their
// grep alone. A project-level grep *is* applied to dependency projects (unlike
// a CLI --grep, which Playwright exempts them from), so grepping them would
// select zero tests and skip login and entity seeding entirely — every
// quarantined test would then fail for want of admin.json rather than for the
// flake being diagnosed, and `--list` cannot catch it because it neither runs
// setup nor lists dependency projects.
// Matched by file convention plus dataInsightApp.ts, which seeds the Data
// Insight app without following it. Deliberately keyed on testMatch and not on
// "is a dependency of something": chromium and DataAssetRulesEnabled are also
// dependencies, but they carry real tests and must still be filtered.
const FIXTURE_TEST_MATCH = /(?:\.(?:setup|teardown)\.ts|dataInsightApp\.ts)$/;
const isFixtureProject = (project: { testMatch?: unknown }) =>
  typeof project.testMatch === 'string' &&
  FIXTURE_TEST_MATCH.test(project.testMatch);

const applyQuarantine = <
  T extends {
    grep?: RegExp | RegExp[];
    grepInvert?: RegExp | RegExp[];
    testMatch?: unknown;
  }
>(
  projects: T[]
): T[] =>
  projects.map((project) => {
    // grepInvert is OR-matched, so appending the tag is enough to exclude it.
    if (!runQuarantinedOnly) {
      return {
        ...project,
        grepInvert: [...asRegExpList(project.grepInvert), QUARANTINE_TAG],
      };
    }

    if (isFixtureProject(project)) {
      return { ...project };
    }

    // grep is OR-matched too, which is the wrong operator for the soak lane —
    // replacing the project's lane-routing grep would let it pick up
    // quarantined tests belonging to other lanes, so each alternative is
    // AND-ed with the tag via lookaheads instead (same trick as combineGrep).
    return {
      ...project,
      grep:
        project.grep === undefined
          ? QUARANTINE_TAG
          : asRegExpList(project.grep).map(andQuarantine),
    };
  });

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
// Each conditional group is annotated separately: TypeScript does not propagate a
// contextual type into a spread expression, so inlining these ternaries would widen
// the tuples to arrays and break assignability to ReporterDescription.
const htmlReporter: ReporterDescription[] = isPlannedShard
  ? []
  : [['html', { outputFolder: './playwright/output/playwright-report' }]];

const blobReporter: ReporterDescription[] = isPlannedShard
  ? [
      [
        'blob',
        {
          outputDir: './playwright/output/blob-report',
          fileName: `report-${process.env.PW_SHARD_ID ?? 'local'}.zip`,
        },
      ],
    ]
  : [['blob']];

const performanceReporter: ReporterDescription[] = isPlannedShard
  ? [
      [
        './playwright/reporters/PerformanceReporter.ts',
        { outputFile: './playwright/output/playwright-timings.json' },
      ],
    ]
  : [];

const reporters: ReporterDescription[] = [
  ['list'],
  ...htmlReporter,
  [
    '@estruyf/github-actions-reporter',
    {
      useDetails: true,
      showError: true,
      showArtifactsLink: true,
    },
  ],
  ...blobReporter,
  ['json', { outputFile: './playwright/output/results.json' }],
  ...performanceReporter,
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
  /* Retry on CI only; PLAYWRIGHT_RETRIES (set per workflow via the reusable's
   * `retries` input) overrides the CI default of 1. The parens are semantic:
   * without them `?? CI ? 1 : 0` collapses every override to 1. */
  retries: Number(process.env.PLAYWRIGHT_RETRIES ?? (process.env.CI ? 1 : 0)),
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
  projects: applyQuarantine([
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
      name: 'ontology-rdf-setup',
      testMatch: '**/ontology-rdf.setup.ts',
      dependencies: ['entity-data-setup'],
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
        ...(hasDedicatedImportExportLane ? [/@import-export/] : []),
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
        '**/AdvancedSearch.spec.ts',
        ...dedicatedStateTestIgnore,
        '**/DomainIsolation/**',
        '**/VisualRegression/**',
      ],
    },
    {
      name: 'visual-regression',
      testMatch: '**/VisualRegression/**/*.spec.ts',
      dependencies: ['setup', 'entity-data-setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: 'playwright/.auth/admin.json',
      },
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
        '**/OktaSessionRenewalPublic.spec.ts',
        '**/SSOLogin.spec.ts',
        '**/SSORenewal.spec.ts',
        '**/SSOSessionLimit.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
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
      grep: combineGrep(/@data-insight/),
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
      dependencies: ['ontology-rdf-setup'],
      grep: /ontology-rdf/,
      teardown: 'entity-data-teardown',
      fullyParallel: false,
      workers: 1,
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
    ...(hasDedicatedImportExportLane
      ? [
          {
            name: 'ImportExport',
            grep: combineGrep(/@import-export/),
            testIgnore: '**/nightly/**',
            use: { ...devices['Desktop Chrome'] },
            dependencies: entityDependencies,
            fullyParallel: true,
            workers: 2,
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
    // AdvancedSearch runs in its own dedicated lane so its timing-sensitive
    // waitForResponse/debounce flow is not interleaved with other chromium shards.
    {
      name: 'AdvancedSearch',
      testMatch: '**/AdvancedSearch.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: entityDependencies,
      grep: shardGrep,
      fullyParallel: true,
      teardown: entityTeardown,
    },
  ]),

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
