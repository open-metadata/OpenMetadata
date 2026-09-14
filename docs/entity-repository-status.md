# Entity module implementation status

Checkpoint: integration with `main` at `68606d705a` and acceptance follow-up, 2026-09-14 UTC.
**Verification is in progress.**

The worktree no longer contains `EntityRepository.java`, originally 13,569 lines.
Its responsibilities now live in 209 focused components (23,239 lines), including seven startup
assemblies and entity policy interfaces. All 74 direct production subclasses use
`EntityPolicy`. All 69 updater subclasses use composed mutation policies;
13 service repositories implement `EntityServicePolicy` and share service components.
`ServiceEntityRepository` and `ColumnEntityUpdater` are removed. The shared
`EntityUpdater` is final and contains 496 lines, the largest extracted component.
Removing the file does not establish correctness or latency improvement.

| Deliverable | Status |
| --- | --- |
| Shared read, write, update, metadata, history, deletion and bulk components | Implemented |
| Native preparation, persistence, import and bulk consumers | Implemented |
| Single owning transaction per existing flush; retained DAO graph; replay and deferred cache effects | Implemented; expanded suites and service-connection/import rollback checks pass on both databases |
| Redis/L1/request cache contracts | Cold, L1-cold and unavailable Redis functional diagnostics pass; no-Redis critical suite passes |
| Entity policies and retirement of common repository and updater inheritance | Implemented; clean production compilation and packaged selection pass |
| Architecture and Java extension migration guide | Available in [entity-module-migration.md](entity-module-migration.md) |
| Final policy callers | Search/RDF offset readers and custom result pages migrated; 14 unused helpers and two migrated helpers removed |
| Main merge validation | Metrics-stage local service suite: 10,365 passes and one skip; MCP: 630 passes; all three integration CI profiles pass at native `49d9290397` |
| CI follow-up validation | Column/transaction/cache selection: 79 passes per database with Redis and 29 without Redis; pagination passes three local browser runs; RDF readiness recovery passes all 14 graph browser cases |
| Downstream Collate compilation | Implemented in companion PR #6639; paired backend and governance/data-access-request CI pass at native `49d9290397` / Collate `4def2335b1`; refreshed full service unit suite passes 4,193 cases with six skips |
| 90% changed-class coverage | Open |
| Final API latency, SQL, commit and allocation comparisons | Open |

## Current acceptance follow-up

At native `49d9290397`, all three backend integration profiles, RDF browser CI,
the main and nightly UI browser checks, and formatting checks pass. The matching
companion `4def2335b1`
[backend build](https://github.com/open-metadata/openmetadata-collate/actions/runs/34783136491)
and [governance/data-access-request build](https://github.com/open-metadata/openmetadata-collate/actions/runs/34783137512)
also pass. All 37 applicable companion checks pass. Collate's 13 repository families
and their callers use the composed APIs.
The native wrappers still dispatch Collate `main`; coordinated rollout remains necessary
until both pull requests are merged. No workflow changes or status overrides were made.

The ten MCP setup errors described below reproduce on the current dependency graph.
`IdTokenValidatorTest` now serves its JWKS responses through the JDK HTTP server,
removing the incompatible MockWebServer test dependency while retaining real HTTP and
cryptographic validation. All 630 MCP tests and module Spotless checks pass.

The native pagination trace showed a dropdown option detaching while Playwright waited
for actionability. Its unbounded click prevented the outer retry from reopening the menu.
The click now has a bounded timeout, and retries preserve an already open menu. All three
local browser runs verify table page size 25, Explore page size 50, and persistence on the
Users page. Full Playwright lint passes with no errors.

At checkpoint `bdfba3c88e`, all three native integration profiles pass, but Chromium
planning fails before browser execution: current timing history requires at least
30 shards under the existing 19-minute budget, exceeding the previous cap of 28.
The planner cap is now 32, retaining three workers, the time budget and every test.
All 114 planner regressions pass. Local discovery with the same timing artifacts
plans all 3,947 Chromium tests in 30 shards, with a maximum prediction of 18.45 minutes.
The new cap still requires CI validation. No workflow definition changes were made.

Collate's hybrid-runner failure occurs before its browser tests: MinIO cannot pull the
configured Docker Hub image. An isolated ARM64 Kind cluster reproduces `ImagePullBackOff`.
The companion fix pins the same server release and a matching client release from Quay,
updates the obsolete bucket-policy command, and stops setup immediately on failure with
pod/event diagnostics. Shell regressions preserve the original failure exit codes; a real
Argo workflow uploads an artifact that can be retrieved with the expected contents.
The follow-up companion CI successfully completes Argo setup in the hybrid runner
and all three PostgreSQL browser shards. These checks also pass at companion
`4def2335b1` with the current native implementation.

The new native RDF failure occurs in a readiness probe: an HTTP 500 makes the
assertion inside the polling callback abort immediately. The probe now returns
the HTTP status and body to the polling matcher, retaining the 60-second bound
and requiring a successful response with the relationship present. An isolated
HTTP proxy reproduces the original failure, then verifies recovery after one
injected 500 against a real PostgreSQL/Redis/Fuseki application. All 14 Knowledge
Graph browser tests pass, including the live graph case. The local query succeeds
with CI's inference configuration. The full
[RDF browser CI](https://github.com/open-metadata/OpenMetadata/actions/runs/34775785322)
also passes at native `47786d0cdc`. This fixes readiness recovery; the underlying
cause of the earlier server error remains unconfirmed.

The paginated table-column endpoints no longer resolve owners when profiles are
unrequested. Their authorization still runs. Eight real API cases cover both ID
and FQN lookups, omitted/empty fields, metadata, persisted profiles, owner access
and non-owner PII masking. The expanded transaction/cache selection passes 79 cases
per database with Redis (one cache-mode assumption abort) and 29 without Redis
(two cache-mode assumption aborts), with no failures. Single owning commits,
rollback/replay and deferred Redis publication remain covered.

Table and column custom metrics now share one batched extension query. Classification
uses the persisted extension key, preserving table identity, overlapping column names
and table-only field selection. The original implementation fails all four new
one-query budgets; the replacement passes widths 3/100/1,000 and multi-table loading
on both databases. The metrics-stage full service suite passes 10,365 cases with one
skip. Governance and search selections add 363 and 411 passes respectively, with
their recorded skips and cache/configuration assumption aborts.

RDF indexing now retains the fields required by dedicated mappers, including table
constraints used for foreign-key triples. A focused test and the real foreign-key
projection test reproduce the missing-field regression before the fix. The final
RDF/CSV unit selection passes all 890 cases, and the real RDF selection passes all
115 cases. Two existing SQL access assertions also fail on the original artifact
and are excluded from that selection. RDF teardown restores the suite configuration;
inference fixtures use the same named graph as persisted entity projections.

Two application-trigger tests now await completion of their own indexing run before
returning. Their previous early return interfered with later column-grid reads.
The combined application/column-grid selection passes all 44 cases on each database;
the earlier broad suites with that failure remain recorded as failed runs.

The current service package is
`854c3d28e74c6284f768cda27801c78b164249500577a2969b495b3e32ca34ae`.
The [current SQL comparison](entity-repository-performance.md#metrics-and-rdf-follow-up-2026-09-13)
retains the original artifact and separately records the preceding stage. Both
databases have no higher SQL totals against the original in warm, cold, L1-cold,
unavailable and recovered Redis read comparisons; all 54 synchronous mutation/CSV
totals fall. Four additional Redis-disabled comparisons pass on the same artifacts:
each database has 69 lower and nine equal read totals, while synchronous writes have
53 lower and one equal total on PostgreSQL and 54 lower totals on MySQL. The sixteen
comparisons contain 10,320 successful measured responses. Single-entity mutations
retain one owning commit. Background-worker SQL remains outside this matrix.
Instrumented SQL runs do not establish latency acceptance.

The latest native coverage report matches all 506 changed service sources and 1,109
executable classes without class-file warnings. All 455 executable classes belonging
to the 209 extracted component source files reach 90%, but 364 other changed executable
classes remain below the whole-class
threshold. The diagnostic report includes completed failing broad suites and is not
regression acceptance. Collate's refreshed unit data plus matching historical API
executions cover 51.82% of changed-source lines; 113 of 168 executable classes remain
below 90%. Neither coverage gate is complete.

Ten lineage API classes pass 184 cases on each database with Redis, with three skips
and no failures or assumption aborts. Ten additional unit cases cover invalid hydration
requests, malformed graph identities, dangling edges and synthetic counts restricted
to authorized aggregations. `LineageHydrator` reaches 97.16% line coverage, up from
4.26%; these executions move five more classes above the threshold. Production class
bytes remain identical to the frozen `854c3d28…` package.

A further 48-class consumer selection passes 1,837 cases on each database, with
23 skips, 132 configuration assumption aborts and no failures. It covers service
overview, entity policies, bulk metadata, optimistic locking, orphan references and
cache invalidation. Together with matching native executions from the Collate modal
checks, this moves 13 more native classes above the coverage threshold.

Collate's Slack Test Details modal previously loaded every test case and all fields,
then displayed ten, including tests belonging to other tables. It now requests only
the table's suite and one page of ten suite-filtered results, preserving the full
count and latest result status. Real API regressions reproduce the scope error and
57 SQL statements for a 12-test fixture; the fix uses at most six statements on
both databases. All 15 modal cases and five owning-transaction/cache compatibility
cases pass on each database, and all 628 existing Slack unit cases pass.
`SlackComponents` reaches 97.04% coverage. Only its production class bytes change
between companion service packages `9b48a927…` and `1ac10d52…`; native service bytes
remain unchanged.

The Collate refresh also aligns its JUnit modules through one BOM, rebuilds the local
spec dependency and corrects stale default-value/date expectations. All 4,193 service
unit cases pass, with six skips; all 28 MCP cases pass and 76 integration sources
compile. The final coordinated backend and governance CI runs pass for these changes
and the new native pin.

The remaining acceptance work is the current-artifact performance matrix and whole
changed-class coverage. Fresh five-pair warm single-client comparisons cover column
and relationship reads at width 100 on each database, with 80,000 measured responses
and no errors. MySQL column p50 is initially slower in all five pairs (median paired
ratio 1.033); a second five-pair run adds 50,000 successful responses and is faster in
four pairs. Baseline p99 varies from 4.99 to 37.05 ms, so repeatability remains unresolved.
Relationship paired medians improve, but baseline variability and the unmeasured
configurations preclude complete acceptance. Earlier
column and relationship tail measurements remain open;
pool acquisition inside JDBI's synchronized lazy-handle initialization is an investigation
lead, not an established fix or a latency acceptance result. The historical measurements
and failures below retain their original revision and artifact scope.

## Main integration checkpoint

The merge incorporates 162 commits from `main` and resolves 28 conflicted paths.
The retired repository stays removed. Upstream certification validation and server dates,
history pagination during concurrent hard deletion, and nested column lineage reconciliation
now live in the corresponding composed services. Consolidation replays reconcile lineage
only against the persisted baseline, with search effects deferred until the owning commit.
Context Center, RDF, role synchronization and bulk field consumers use the native ports.

The merged service compiles all 2,291 production and 1,039 test sources with Java 21.
The focused service selection passes 1,406 tests with one skip, including all 128 entity
component test classes, certification, history, Context Center, lineage, RDF and role sync.
The packaged service SHA-256 is
`afd6ca053034a63b72d21fb284f3f011187b6c863ec43d41c9a87456b8d420b6`.

MCP compiles cleanly and runs 630 tests: 620 pass, while ten
`IdTokenValidatorTest` cases fail during `MockWebServer` construction. Upstream's
OkHttp 4.12 test server encounters the OkHttp 5.5 `TaskRunner` from the logging
interceptor dependency. A minimal probe reproduces the same `NoSuchMethodError`
using only third-party JARs. The relevant POMs and authentication sources match
`main`; this is an upstream dependency limitation of the merged build.
The repository pre-commit checks pass.

All 567 integration sources compile. The PostgreSQL/OpenSearch/Redis and
MySQL/Elasticsearch/Redis merge selections each pass 220 tests with 18 skips or
assumption aborts and no failures. They cover the
owning transaction, deadlock replay and rollback, deferred cache publication, column
lineage reconciliation, certification creation, history, role/team/type bulk fields,
page mutations and extracted-memory cleanup.

The coverage and latency measurements below belong to the frozen pre-merge artifacts.
They do not establish acceptance for the merged artifact; both gates remain open.

## CI failure follow-up

CI at `4b5a10a96e` found four failures in `EntityPreparationTest` and
`EntitySummaryWriterTest`. The local generated models had null enum defaults,
whereas CI's spec artifact applied the schema's `Unprocessed` and `Manual` defaults.
Using the spec JAR from integration build `34704112158` reproduced all four failures
locally before the fix. Its SHA-256 is
`9078c39693bef59d9620cc417b3dfa3b537f53b8a3151d205bcc2fd57335e549`.

The fixtures now set their initial state explicitly, and invalid-tag preparation is
checked with every lifecycle status and an explicit null status. The attribution test
preserves an existing source, author and timestamp. `EntityBulkPreparationTest` uses a
`long` counter for stream counts, removing the narrowing conversion flagged by CodeQL.
All 26 targeted cases pass against CI's spec artifact.
The full service suite also passes: 10,346 passes, one skip, zero failures/errors
across 1,157 suites, using Java 21 and CI's JaCoCo 0.8.10. Spotless and repository
pre-commit checks pass. That follow-up changes only tests and this status document.

The [Collate Maven build](https://github.com/open-metadata/openmetadata-collate/actions/runs/34704141262)
and [data-access-request build](https://github.com/open-metadata/openmetadata-collate/actions/runs/34704151401)
fail during Java compilation, before their tests start. Collate `main` still has 13
repository families extending `EntityRepository` and 47 source/test files directly
referencing retired types. Those builds require a coordinated downstream migration
using the [Java extension migration guide](entity-module-migration.md).

### Parallel integration and guided-tour follow-up

At `0417b5c9e4`, all three parallel integration lanes reported the same 102 failures
across 25 classes. `SessionMultiNodeCluster`, also used by `CsvExportMultiNodeIT`,
started additional applications in the test JVM. Their startup replaced the static
`Entity` Jdbi and DAO references while composed repositories retained the primary
application's dependencies. SQL and commit probes consequently observed the wrong
Jdbi, and cross-repository writes could leave the primary transaction boundary.

Additional test servers now run in separate JVMs with separate temporary directories
and the same database, search and cache configuration. The owning test process waits
for startup and closes each child at suite shutdown; EOF also stops a child when the
parent exits. Production transaction ownership and Redis implementations are unchanged.
`SessionMultiNodeIsolationIT` reproduced both failures before the fix: two nested
repository writes survived rollback, and a metadata read registered zero queries.
Both regressions pass with process isolation. The first PostgreSQL/OpenSearch/Redis
selection passed all 17 session, CSV, isolation and transaction tests.

The expanded 31-class selection includes every class that failed in CI, plus session,
CSV, single-transaction and post-commit recovery cases, using the parallel Failsafe
execution with four workers. MySQL/Elasticsearch and PostgreSQL/OpenSearch each
pass 158 tests with ten expected Redis-only skips and no failures or errors;
PostgreSQL/Elasticsearch/Redis passes 157 tests with 11 expected cache-mode skips
and no failures or errors. In total, the completed matrix has 473 passes and
31 skips across 504 cases.

The first Redis matrix run exposed four additional assertions in
`EntityHardDeletionAtomicityIT`: they required negative-cache markers to remain
present after deletion, although peer invalidation handlers can evict those shared
markers. All 12 original deletion cases pass with one Redis-backed application.
The tests now warm both ID and FQN aliases and assert HTTP 404 after successful
deletion or deadlock replay, while retaining the row, metadata, commit and rollback
assertions. The updated deletion suite also passes all 12 cases on both MySQL
and PostgreSQL/OpenSearch in separate follow-ups. All 569 integration sources compile
with Java 21, and repository pre-commit checks pass. The production cache invalidation
behavior is unchanged.

The Playwright guided-tour failure was a separate permission regression after the
table page adopted `useEntityPermissions`: the demo table received the hook's default
denials, so the profiler target for step 13 never appeared. The page now supplies the
existing tour permissions locally and disables real permission requests during the
tour, leaving real entities and their permission cache unchanged. `Tour.spec.ts`
explicitly checks that the profiler target is visible before advancing.

All three production-bundle tour flows pass, with recordings and traces retained under
`.context/ci-fixes-2/tour-production-2-results/`; the profiler step was visually checked.
The [captured Help-entry tour](assets/entity-repository-tour.webm) shows the complete
guided flow, including the profiler target at step 13, against the local test fixture.
The table page and permission-hook suites pass all 31 unit tests. The production UI
build, changed-file formatting and full Playwright lint pass. The broad TypeScript
check still fails, with identical diagnostics when the changed files are replaced
by their `0417b5c9e4` versions; this fix adds no diagnostics. This functional regression
evidence does not close the original coverage or API latency gates.

The latest [Collate Maven build](https://github.com/open-metadata/openmetadata-collate/actions/runs/34706402352)
still fails before tests because its extensions reference the retired Java types;
the companion migration remains required.

## Pre-merge verification provenance

The frozen pre-merge package, `policy-surface-v2-service.jar`, has SHA-256
`7c3bd8bbb349252fa5a7dee232a9dc7034c17e460f2634fe5bb292955ce8b866`.
The service selection passed 2,405 tests with one skip across 246 classes;
MCP passed all 616 tests. Both modules compile with Java 21, and service/integration
Spotless checks pass. The final cleanup migrates eight calls in the search and RDF
indexers, context files and ingestion pipelines to typed pages or result constructors.
Search reindex paging retains its known total without recounting, including resumed
pages. The RDF reindex regression passed with Fuseki enabled.

The expanded 17-class PostgreSQL/OpenSearch/Redis run found 1,076 tests: 1,036 passed,
38 assumption aborts, two skips and no failures. The equivalent MySQL/Elasticsearch/Redis
run had 1,035 passes and one failure: the new relationship-failure injector matched
PostgreSQL's `INSERT INTO` but missed MySQL's `INSERT IGNORE INTO`. After correcting
the test matcher, all five create-many tests passed on each database. The original
failed invocation remains recorded. These tests cover one owning chunk commit,
whole-chunk rollback, the existing 100-row chunk limit, enclosing transactions and
cached ID/FQN aliases. The final no-Redis critical suite passed 37 tests with one
cache-mode assumption abort. Four additional cursor/search/incident tests passed.

The final 16-class consumer selection passed on both databases: 1,628 tests found,
1,486 passed, 140 assumption aborts, two skips and no failures on each. It covers
context memory, AI entities, personas, metrics, drive entities, users and policy
reads. The new reindex test corrupts one row's custom metric and verifies that
healthy rows survive, error rows clear unrequested fields, and repairing the
extension restores the complete page. The identical test passes on the original
artifact. Table columns remain default fields; schema definitions are cleared.

The first consumer invocation exposed two test assumptions, reproduced against
the original artifact: the new reindex fixture treated columns as optional, and
the existing persona deletion test required a null default even with a configured
system default. The corrected persona test requires the deleted persona to be
absent and any fallback to be live. Both corrected cases also pass together on
the original artifact with a system default explicitly configured. Production
deletion and fallback behavior are unchanged; earlier failed runs remain recorded.

Another 37 whole consumer classes passed on each database: 4,916 tests found,
4,464 passed, 396 assumption aborts, 56 skips and no failures. This selection
includes column APIs, applications, search indexing, test cases, subscriptions,
dashboards, queries, database/schema resources, policies and roles. Together with
the preceding 16-class selection, these final-artifact follow-ups add 5,950 passes
on each database.

New Knowledge Center page probes also exposed existing behavior on both artifacts.
A URL-only QuickLink PATCH returns the new URL, but a subsequent GET returns the
previous URL. Pages are indexed with data-product references, yet the data-product
asset listing omits them; its `deleted=false` filter does not match a page's absent
deletion marker. These findings are recorded separately from refactor regressions;
production behavior is unchanged. The page fixture uses the configured
`knowledge_page_search_index` alias and a persisted editor account, since the
built-in admin's existing fast path intentionally has no user ID. The completed
first page selection had the same 168 passes, 22 assumption aborts and three
failures on the original and both candidate databases. After correcting the
fixtures and adding QuickLink PUT coverage, the page API suite passed 171 tests
with 22 assumption aborts on the original. The candidate passed those tests plus
three page transaction tests on both databases: 174 passes and 22 assumption
aborts each, with no failures. The transaction tests assert one owning commit for
a parent move, rollback after a real history insertion, and participation in an
enclosing rollback. They check the stored FQN, parent links, version history and
cached ID/FQN responses. Native integration compilation and Spotless pass.

The final 39-class RDF/lifecycle follow-up found 277 tests on each candidate
database and on the original PostgreSQL artifact: 272 passed, five failed, and
none were skipped or aborted. The five failure cases are identical across all
three runs: graph traversal depth, ontology version, two SQL authorization
assertions, and empty semantic-query validation. They remain baseline findings;
these invocations retain their nonzero exits.

The first 38-class run exposed four RDF tag/certification timeouts after earlier
test classes disabled the shared updater. All four passed in isolation on the
candidate. Six test teardowns now restore the suite's RDF configuration. A graph
readiness assertion also uses its own glossary instead of a limited catalog-wide
page. The completed follow-up verifies both fixture corrections on both candidate
databases and the original artifact. Production RDF behavior is unchanged.

The benchmark now supports 24 additional ID/FQN, default/expanded-field and
regular-user variants. Per-request credentials replace the default Authorization
header; the new HTTP test reproduced the previous duplicate-header behavior.
All 23 benchmark protocol tests pass. All 42 read workloads also passed on both
real server artifacts, with 168 measured HTTP 200 responses and no errors.
Native Java 21 compilation of 550 integration sources and Spotless pass.

The full current service rerun found 9,839 tests: 9,836 passed, one skipped and
the two known baseline failures listed below. The preceding run also had an
Airflow local-HTTP error in
`AirflowRESTClientTest.deletePipelineRefreshesCsrfTokenAndRetriesExpiredDeleteRequests`.
Its production class is byte-identical in the original and current JARs. All 20
tests in that class passed in isolated runs against both artifacts and in the
full-suite rerun. The first failed invocation remains recorded.

The preceding `inheritance-empty-service.jar` has SHA-256
`7c61b161aa3a070146c2c6896ab80b2b6dacba88d30f73668e255987dee4c3ec`.
It removes a repeated parent lookup after a complete relationship projection has
already established that no parent exists. Its service selection passed 2,328
tests with one skip. MySQL and PostgreSQL each passed 773 API tests, with 21
assumption aborts, two skips and no failures. The hierarchy regression and API
diagnostics establish three relationship queries instead of four at all three widths.
The final policy package retains this optimization.

The preceding frozen `mutation-policy-service.jar` has SHA-256
`693d67209dc0a931fbc8b7479b91126b0f7bb437942aaf5321d001c9d98bd187`.
The JAR contains none of the three retired bases. The packaged selection passed
2,319 tests with one skip across 228 test classes. The full service suite found
9,830 tests: 9,827 passed, one skipped and two reproduced baseline failures remained:
`TaskWorkflowLifecycleResolverTest.workflowStartVariablesTolerateNullOptionalFields`
and `OntologyDocumentTest.testServeTurtle`. There were no new service failures.
MCP passed all 616 tests. Both service and integration modules passed Spotless.

The expanded database selection includes all 13 service families and whole Table,
Chart, GlossaryTerm, Team, Container, DashboardDataModel, File and Worksheet suites.
Its 349 selectors include 89 whole classes. Both MySQL/Elasticsearch/Redis and
PostgreSQL/OpenSearch/Redis runs completed with 7,686 tests found: 7,019 passed,
641 assumption aborts, 26 skips and zero failures on each database. Both use the
frozen production artifact and isolated test classpaths. The MCP service API
placeholder is now a real `BaseServiceIT`
fixture, including cached ID/FQN invalidation after connection tests.

The preceding expanded runs each found 6,847 tests: 6,247 passed, 572 assumption
aborts, 20 skips and eight failures. Seven failures came from the local runner
including an archived class directory, which caused duplicate event-descriptor
discovery; one test assumed a shared user existed. A separate column suite found
a Worksheet test that queried an unfiltered first page and assumed its own new
rows were present. All three causes reproduced against the preceding artifact.
The runner now has an isolated classpath, the authorization fixture creates its
own DataConsumer user, and the worksheet fixture uses the spreadsheet filter.
No production changes were required for these corrections.

The six-test PostgreSQL confirmation passed all corrected event/user cases and
three new service-connection transaction tests. Those assert one owning commit,
rollback after the canonical row write, and participation in an enclosing
transaction, including history and cached ID/FQN responses. Three import tests
passed on each database: ordinary PUT retains empty metadata fields, import
removes them, and a failed import restores owners, domains, tags and version.
Eight audit-event contract tests also pass, including explicit and inferred
previous versions and unsupported asset-tag operations. Three new policy-read
tests passed on each database, asserting duplicate/missing reference behavior,
batched child hydration and derived authorization tags with actual SQL budgets.
These runs preceded the empty-parent lookup optimization.

The supplemental PostgreSQL selection covered eight whole pipeline, data-contract,
permission, knowledge-page and CSV classes: 657 tests found, 618 passed,
38 assumption aborts, one skip and zero failures. This run also collected coverage
for the common `org.openmetadata.csv` package omitted by the earlier API probe.

The inheritance-empty artifact's PostgreSQL critical suite with Redis disabled found 47 tests:
46 passed, one cache-mode assumption abort and zero failures. Cold and L1-cold
diagnostics validated 26 workloads per mode on both revisions. Redis-outage
diagnostics validated the same 26 workloads on each revision, followed by an
acknowledged cache recovery. These are correctness and SQL diagnostics, not
latency measurements.

## Coverage scope

The merged completed-run report covers 502 changed or new service Java source files.
The scope is the branch merge-base against the worktree plus untracked sources;
it excludes unrelated changes arriving on `origin/main`. This corrects an earlier
two-way diff that included incoming upstream changes.

At least 90% line coverage is reached by all 209 extracted component source
files and all 452 executable component classes, including nested classes.
Across the changed service-source scope, 288 of 502 source files reach 90%.
The class-level parser counts 1,097 executable classes, including nested classes,
of which 353 are below 90%. Empty interface elements
must not consume the following class's counters. The report includes completed
expanded and supplemental runs, the current full service run and final policy
follow-ups, with no JaCoCo class mismatches. The final RDF/lifecycle runs are
included with their five reproduced baseline assertion failures and recorded
nonzero exits. Earlier failed API selections with runner or fixture issues are
excluded. Evidence is retained in `policy-surface-v18-completed-coverage.*` under the workspace's
`.context/entity-repository/` directory. No exception to the coverage rule is approved.
**The changed-class coverage gate is not satisfied.**

## Performance assessment

The original runtime baseline is the task's `b50e9277f9655df9e43138e24216180cb57371cd`
snapshot, whose service JAR has SHA-256
`306263df42c131d28daa4a5c189591e2f5563937501dddd105c8221ee1cdfdf5`.
It is not the later `origin/main` commit mentioned in the saved plan. Both runtime
artifacts and their compatible test fixtures are frozen separately.

The [performance record](entity-repository-performance.md) documents measured SQL
and CPU work reductions. The final package and original artifact each passed all
78 warm SQL diagnostic workloads: 75 totals decreased, three stayed equal and
none increased. Cached column reads issued zero SQL at all three widths.
The 24 added lookup/authorization workloads also had no SQL increases: 18 totals
decreased and six stayed equal. Expanded 100-column reads use eight queries per
admin request instead of 207, and nine per regular-user request instead of 208.
Async poll totals do not establish a budget for background mutation work. Unchanged
bulk updates commit one nonempty owning transaction; changed bulk updates retain
one owning mutation transaction plus the existing post-commit feed transaction.

**The complete API latency and absence-of-regression gate has not been established.**
The final six-read comparison validated 60,000 responses across five alternating
pairs at 50 offered requests per second. Metrics, extensions and metric listings
improved at all three percentiles in every pair. History improved at p50 and p95;
columns and relationships retained unstable tails, with median paired p99 ratios
of 2.278 and 1.111. The earlier tail concern remains open. The completed final
PUT comparison validated 20,000 responses; unchanged PUT improved at all three
percentiles in every pair, while changed PUT improved at p50 and p95.
The saved acceptance plan requires five alternating pairs with sufficient tail
samples, cache-mode coverage, equal offered loads and overload recovery. A warm
20-sample screen is insufficient for that gate. Instrumented allocation profiles
and timings collected alongside builds or regression suites do not count as
latency evidence.

The final policy package completed changed/unchanged PUT comparisons on 100-column
fixtures: five alternating pairs, 1,000 measured requests after 200 warmups per
workload per round, at 20 offered requests per second with Redis and fixed 1 GB
heaps. All 20,000 responses succeeded. Unchanged PUT had median paired p50/p95/p99
ratios of 0.551/0.328/0.830, lower in every pair. Changed PUT had ratios of
0.519/0.856/0.988; p50 and p95 were lower in every pair, while p99 was higher in
two pairs and remained close to baseline. All ordered request traces match the
ranked samples. This completes two workloads in one configuration, with the
remaining matrix still open.

The first final-artifact timing comparison completed six 100-column read workloads
with Redis enabled, five alternating pairs, 200 measured requests and 50 warmups
per workload per round, at ten offered requests per second. All 12,000 measured
responses passed their checks: 1,000 requests per workload per revision. Median
paired p50 ratios were 0.261 for metrics, 0.388 for extensions, 0.534 for history,
and 0.308 for list metrics. Columns and relationships were close to baseline,
with median paired p50 ratios of 1.045 and 1.014; their tail variability needs
investigation. These six results are partial evidence, not latency sign-off.
Other widths, mutation workloads and cache/load combinations remain to be measured.

A larger repeat for columns and relationships used five alternating pairs of
1,000 measured requests after 200 warmups at 50 offered requests per second.
All 20,000 responses passed. Columns and relationships had median paired p50
ratios of 0.961 and 0.998. Relationship p99 was slower in all five pairs, with a
median paired ratio of 1.230. Server access logs corroborate the long tails;
their clusters coincide with garbage-collection activity. A fixed 1 GB heap did
not remove the short-run regression. A longer relationship-only repeat used
4,000 measured requests after 400 warmups per round at the same offered rate:
all 40,000 responses passed, with median paired p50/p95/p99 ratios of
0.958/0.928/0.840. Its p99 ratios ranged from 0.132 to 1.292, so tail behavior
remains inconclusive. These preceding-artifact comparisons do not establish the
full cache/load latency gate for the final policy package.
