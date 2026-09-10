# Column-grid migration and remaining candidates

This implements the first family from the [September 10 audit](README.md). It does **not** remove all 211 candidates. The complete audit remains a historical snapshot at `44823acd`; implementation started from `e006fd96`. The six candidate spec files did not change between those commits.

| Disposition | Original queue cases | Meaning |
|---|---:|---|
| Migrated in this PR | 22 | Column-grid UI assertions now run in Jest with the real components and controlled HTTP responses |
| Retained column-grid browser contracts | 3 | Authenticated page, browser editor input, and real background update |
| Retained for follow-up | 186 | Permission, general pagination, and nested-entity matrices need their own real component/page replacements |
| **Reviewed first-migration set** | **211** | Every expanded case has a disposition in the ledger |

The [211-row migration ledger](migration-cases.csv) records the original queue case ID, source definition, title, disposition, replacement test name and follow-up rationale. One replacement may consolidate several overlapping browser cases. **The 19 new Jest cases are not 19 additional end-to-end journeys.**

## What changed

[ColumnGrid.integration.test.tsx](../../../openmetadata-ui/src/main/resources/ui/src/pages/ColumnBulkOperations/ColumnGrid/ColumnGrid.integration.test.tsx) renders the actual `ColumnGrid`, table rows, design-system controls, filters, edit drawer, rich-text editor, hooks, router and query provider. It uses the existing Jest/jsdom/Testing Library stack. No new runner or package dependency is introduced.

[HttpTestServer.utils.ts](../../../openmetadata-ui/src/main/resources/ui/src/test/unit/HttpTestServer.utils.ts) replaces the Axios transport adapter. The actual REST functions, query encoding and Axios interceptors still run. It rejects unexpected endpoints and reports them after the test even if application error handling catches the rejection. Request recording is bounded. Deferred responses and the existing fake clock control loading and request ordering without wall-clock sleeps.

The suite undoes the global `ToastUtils` mock and renders the real toast provider for validation and failure feedback. The repository's existing translation/DOM setup remains in use; these tests do not establish translation correctness, layout, hit-testing or native browser editor behavior. The grid, its children, state hooks, request builders and design-system controls are not replaced with mocks.

The migrated behavior includes:

- Exact statistics, real rows, empty search results and request/URL query encoding.
- Applying, restoring and clearing metadata/service/entity-type filters.
- Keeping totals while a request is pending and rejecting stale search responses.
- Selection, cancellation, aggregate occurrence counts, multiple independent selections, drawer fields and unsaved-edit discard.
- Exact outgoing update bodies for both occurrences; pending state; failure recovery; rejecting an unchanged submission without scheduling a job.
- Expanding a supplied STRUCT child and opening the correct child's edit form.
- Cursor navigation, rendering a different page, preserving overall totals, going back and resetting the cursor for a new search.

The retained [Playwright spec](../../../openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ColumnBulkOperations.spec.ts) covers:

1. The authenticated column page against its real endpoint and application routing.
2. Typing spaces into the real browser editor and closing its drawer.
3. Submitting a real bulk update, receiving its notification and observing both occurrences updated in the server index.

The page helper opens the feature route directly. Local validation showed the shared sidebar helper still expected the previous sidebar structure; repeatedly exercising that helper is not needed for the column-grid contract. Sidebar navigation deserves its own current component/browser coverage.

The ESLint suppression baseline drops five positional-locator allowances removed with the retired cases; the two remaining allowances belong to the retained browser spec.

## Assertion improvements

The old pagination case guarded its assertions with `if (isNextEnabled)`. The replacement supplies two deterministic pages and requires navigation to change the displayed column, transmit the cursor, preserve totals and reset on search.

The old nested-child case could skip all child assertions when the child checkbox was absent. The replacement requires the child row and checks the identity in its edit form.

The old progress case queried `pending-changes-progress-spinner`. `ColumnGrid` passes that attribute to `Loader`, but `Loader` does not forward it and renders `data-testid="loader"`. The replacement checks the actual loader inside the pending-changes card.

The old multi-occurrence update case accepted any request containing at least two matching-looking names. The replacement checks exactly one update for each of two distinct FQNs, including entity type, display name and absence of unintended fields. A real server-index assertion remains in Playwright.

## Why the other 186 cases remain

| Suite | Cases | Required replacement before retirement |
|---|---:|---|
| Entity permissions | 46 | Actual headers, descriptions, tags, management menus and entity-specific tabs with real permission providers; preserve backend enforcement tests |
| Service permissions | 44 | Actual service controls, AutoPilot affordances and child-list guards across service types |
| Data-quality permissions | 25 | Actual test-case/library/bundle/profiler controls and route guards under allowed and denied responses |
| General pagination | 35 | Actual listing consumers, search resets, page-size changes, cursor requests, URL restoration and version views |
| Nested entity updates | 36 | Actual mutation handlers and immediate nested-row updates across eight entity types, including distinct serializers/endpoints |

A permission utility test does not establish that a page uses its result. A `usePaging` test does not establish that all 35 consumers request and render the correct page. A nested-array utility test does not establish that every entity applies the mutation response. Those gaps are why this PR implements one complete family rather than deleting the whole candidate set.

## Follow-up discovered during implementation

An exploratory component test delivered a successful bulk-job notification and supplied a refetched row with the **same ID** but updated values. The refetch ran and pending state cleared, yet the rendered data-type cell retained the previous value in jsdom. This is an investigation lead, not a confirmed browser defect or a regression introduced here.

Reproduce by rendering `customer_id` with `VARCHAR`, submitting its edit, delivering the active job's completion through `WebSocketContext`, and returning the same column ID with an updated display name and data type from the next grid GET. Assert the refreshed cell and reopened form separately. Inspect the interaction between `ColumnGridTableRow` and the core `Table.Row` collection: the column definitions are stable while the cell renderer closes over changing row data.

The real job/notification contract remains in Playwright. Establish browser behavior and add an isolated row-refresh regression before migrating that contract or changing collection invalidation. The exploratory same-ID assertion is not included among the 19 passing migration cases and is not used to justify any of the 22 removals.

## Cost and rollout

The 22 removed cases consumed **399,283 ms (6.65 cumulative worker-minutes)** in the audited queue run. This is **0.49% of the 4,488 planned product cases**. It is historical test-worker duration, including attempts, not measured queue wall-clock savings. Retained setup, shard tails and replacement execution still cost time.

Run the pilot through the existing required frontend and browser lanes. Compare actual queue verdict latency, worker time and retry counts before widening the migration. No workflow, branch-rule, retry-budget or shard-allocation changes are included.

## Validation

The final targeted Jest run passed **33 tests across four suites** (19 new integration cases plus the existing row, pagination control and paging-hook suites). The **three retained Playwright cases passed in the repository's Chromium project against the workspace Vite UI and the local backend**, including the new assertion that both occurrences reached the server index; their local run took 52.7 seconds with one worker and no retries. Admin authentication was prepared separately without changing server security configuration. The full CI provisioning/sharding workflow was not rerun.

Three temporary source faults were checked: disabling the stale-response guard, omitting the search query from the HTTP request, and omitting the second occurrence from the update payload. Each made its corresponding integration test fail. All modified production files were restored byte-for-byte before the passing final run.

Changed-file ESLint/Prettier, license/pre-commit checks, all 114 lint-rule tests and i18n validation pass. Application-doc generation produces no diff, and the generated Playwright rule table is current. The suppression baseline and its exact-count guard both decrease by five.

Whole-repository TypeScript checks remain red. A compiler-API comparison against the same checkout with the original spec and without the two new test-support files produced **identical diagnostics**: 599 for the UI project and 165 for Playwright, with no additions or removals. This is a baseline limitation, not a claim that type checking passes. The CLI checks were also attempted; their incremental diagnostic counts differed, so the like-for-like compiler comparison is the attribution evidence.

Validation results and reproduction commands are recorded in the PR description. The new suite's initial coverage run passed **19 cases**. It measured **69.51% line coverage of `ColumnGrid`**, **62.67% of its listing hook**, **83.01% of its filter hook**, **94% of `ColumnGridTableRow`** and **100% of `ColumnGridRow`**. These are the pilot's coverage numbers, not whole-application coverage or proof that all grid behavior migrated. No production implementation changes are included, so a changed-production-class coverage target does not apply.

Before expanding the migration, preserve the case-level mapping, demonstrate failure for an intended regression, run the retained browser contracts, and measure the resulting gate rather than extrapolating queue speed from test counts.

Run the frontend tests from `openmetadata-ui/src/main/resources/ui`:

```sh
yarn test --runInBand --runTestsByPath \
  src/pages/ColumnBulkOperations/ColumnGrid/ColumnGrid.integration.test.tsx \
  src/pages/ColumnBulkOperations/ColumnGrid/components/ColumnGridTableRow.test.tsx \
  src/components/common/NextPrevious/NextPrevious.test.tsx \
  src/hooks/paging/usePaging.integration.test.tsx
```

For the isolated browser run, use a prepared local stack and `playwright/.auth/admin.json` containing authentication state, including IndexedDB, for the same UI origin. The spec creates and deletes its own edit fixtures. This command skips shared authentication/entity setup:

```sh
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3001 PW_PRESEEDED_STATE=true \
  PLAYWRIGHT_IS_OSS=true yarn playwright:run \
  playwright/e2e/Features/ColumnBulkOperations.spec.ts \
  --project=chromium --workers=1 --no-deps
```
