# Pagination.spec.ts migration

`playwright/e2e/Features/Pagination.spec.ts` had 37 tests (8.2 worker-minutes per full
run, plus seeding 20+ entities per describe). It now keeps 2 real-server smoke tests
(~41 s). Everything else moved to UI integration tests built on
`paginationContract.ts`, which reproduces `testPaginationNavigation` and
`testCompletePaginationWithSearch` step by step.

## Where each Playwright test went

| Playwright test | Replacement | Server-side owner |
| --- | --- | --- |
| Users › pagination | `pages/UserListPage/UserListPageV1.browser.test.tsx` (navigation, reload, page size) | `PaginationIT`*, `UserResourceIT` |
| Users › complete flow with search | same file (search + deleted toggle) **and kept in Playwright** | `SearchResourceIT` |
| Database Schema Tables › normal / search | `pages/DatabaseSchemaPage/SchemaTablesTab.browser.test.tsx` | `PaginationIT.testTablePagination` |
| Table columns › pagination | `components/Database/SchemaTable/SchemaTable.browser.test.tsx` **and kept in Playwright** | `ChildFieldPaginationIT` |
| Table columns › search | `SchemaTable.browser.test.tsx` | `ChildFieldPaginationIT` |
| Service Databases › pagination / search | `pages/ServiceDetailsPage/ServiceDatabases.browser.test.tsx` | `PaginationIT`* |
| Classification Tags | `pages/TagsPage/TagsPage.browser.test.tsx` | `PaginationIT`* |
| Metrics | `pages/MetricsPage/MetricListPage/MetricListPage.browser.test.tsx` | `MetricGroupResourceIT` (hierarchy limit/offset) |
| Notification Alerts | `pages/NotificationListPage/NotificationListPage.browser.test.tsx` | `PaginationIT`* |
| Observability Alerts | `pages/ObservabilityAlertsPage/ObservabilityAlertsPage.browser.test.tsx` | `PaginationIT`* |
| API Collection › normal / search | `pages/APICollectionPage/APIEndpointsTab.browser.test.tsx` | `PaginationIT`* |
| Stored Procedures › normal / search | `pages/StoredProcedure/StoredProcedureTab.browser.test.tsx` | `PaginationIT`* |
| Database Schemas › normal / search | `pages/DatabaseDetailsPage/DatabaseSchemaTable.browser.test.tsx` | `PaginationIT`* |
| Data Models › normal / search | `pages/ServiceDetailsPage/ServiceDataModels.browser.test.tsx` | `PaginationIT`* |
| Directories › normal / search | `pages/ServiceDetailsPage/DriveServiceDirectories.browser.test.tsx` | `PaginationIT`* |
| Files › normal / search | `pages/ServiceDetailsPage/DriveServiceFiles.browser.test.tsx` | `PaginationIT`* |
| Files ↔ Spreadsheets tab reset | `DriveServiceFiles.browser.test.tsx` (tab-switch test) | none needed (client only) |
| Spreadsheets › normal / search | `pages/ServiceDetailsPage/DriveServiceSpreadsheets.browser.test.tsx` | `PaginationIT`* |
| Roles / Policies / Bots | `pages/RolesPage/...`, `pages/PoliciesPage/...`, `pages/BotsPageV1/...` | `PaginationIT`* |
| Pipeline Tasks (both) | `pages/PipelineDetails/PipelineTasks.browser.test.tsx` | none needed (client-side paging) |
| Table version columns (pagination, search) | `pages/EntityVersionPage/TableVersionColumns.browser.test.tsx` | none needed (client-side) |
| Service version page | `pages/ServiceVersionPage/ServiceVersionPage.browser.test.tsx` | `PaginationIT`* |
| Impact Analysis (search reset, quick filter reset) | `components/LineageTable/ImpactAnalysisPagination.browser.test.tsx` | `LineageImpactAnalysisIT` (filters); from/size paging is a gap |

\* **Gap:** `PaginationIT.testPaginationForEntityType` walks cursors forward and back
with several page sizes, but only `testTablePagination` calls it.
`BaseEntityIT.get_entityListWithPagination_200` only checks that a list is non-empty.
Before deleting more E2E coverage, call the cursor walk from `BaseEntityIT` (or add one
`@ParameterizedTest` over these entity types) so every list endpoint above is checked
against the real database.

## What the browser tests check that Playwright did not

- **Requests per page change.** Each click must cause exactly one list request.
- **Production router mode.** `AppRoot` routes with `useTransitions` on, but Playwright
  turns transitions off (`isPlaywrightEnv()`). The browser tests use production mode.
- **No unmocked API calls.** Any `/api/*` request without a handler fails the test.

## Known issues found during migration

Each is pinned in its test (`knownIssues`), so it is visible and the test flips red
once fixed, prompting cleanup.

| Page | Issue | Pinned as |
| --- | --- | --- |
| Data Models tab, Stored Procedures tab | URL-sync effect resets `currentPage` to 1 after Next under router transitions; reload shows the wrong page number and search starts from page 2 | `test.fails` |
| Roles, Policies, Bots, Notification alerts, Classification tags, Service version page | Page change fetches twice (click handler and URL effect) | `duplicateFetchOnPageChange` |
| Observability alerts | Table had no row-header column (react-aria error) | **fixed** in this change |

Also noticed: Metrics list requests `/metrics/{id}/observability` once per visible row.
`DataAssetsHeader` nests a `<button>` inside a `<button>`.
