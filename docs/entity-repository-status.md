# Entity module implementation status

Checkpoint: integration with `main` at `15b542e735c`, 2026-09-12 UTC.
**Verification is in progress.**

The worktree no longer contains `EntityRepository.java`, originally 13,569 lines.
Its responsibilities now live in 209 focused components (23,223 lines), including seven startup
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
| Main merge validation | 1,406 service passes; 620 MCP passes and ten upstream dependency setup errors; 220 integration passes per database with Redis |
| 90% changed-class coverage | Open |
| Final API latency, SQL, commit and allocation comparisons | Open |

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
