# Merge queue recovery and verification

The objective is zero avoidable ejections with complete execution evidence. A
100% first-enqueue merge rate over an observed window is useful; incompatible
changes, test regressions, manual removals, and conflicts must remain visible.
Queue concurrency stays at five. Required coverage and test retries are unchanged.

## Current failures on September 9

The supplied September 2–9 weekday totals count candidate merge-group builds,
not individual PRs or merge batches. Each candidate includes the target branch
and preceding queued changes. The maximum merge batch of three does not limit a
candidate to three PRs. Of 1,182 attempts, 527 were fully green on the first pass
(44.6%, rounded from these counts), and 655 failed. Playwright alone blocked 401
attempts, or 33.9% of all attempts and 61.2% of failed attempts. This denominator
differs from the earlier 41% of merged PRs that entered the queue only once.

At the September 9 audit snapshot, the most recent 60 Playwright merge-group
workflow runs included six in progress, 44 successful, and ten failed. Each of
the ten failed workflows had one terminal failed test among approximately 4,490
product tests. All ten failed in the test step, with no artifact transport failure
classified in their outcome reports. Together they also had 77 retry-pass tests.
This sample does not classify the full week's 401 Playwright-only failures or
measure overall queue success.

| Terminal scenario | Failed workflows | Evidence |
|---|---:|---|
| GlobalPageSize persistence | 3 | [Option missing/detached during selection](https://github.com/open-metadata/OpenMetadata/actions/runs/34350081016/job/102469409217) |
| DomainDataProductsWidgets asset removal | 3 | [Widget predicate returns null, then exhausts the test timeout](https://github.com/open-metadata/OpenMetadata/actions/runs/34349824126/job/102468608470) |
| TestLibrary external definition edit | 1 | [PATCH omits the expected dimension](https://github.com/open-metadata/OpenMetadata/actions/runs/34372649228/job/102547301713) |
| MetricListSearch clear search | 1 | [Expected one row, observed two](https://github.com/open-metadata/OpenMetadata/actions/runs/34343073335/job/102446571563) |
| AutoPilot MySQL service | 1 | [Metadata ingestion times out connecting to shared MySQL; workflow reaches FAILURE](https://github.com/open-metadata/OpenMetadata/actions/runs/34361441865/job/102508694784) |
| TestSuitePipelineRedeploy bulk redeploy | 1 | [One deployment returns HTTP 400 on both attempts](https://github.com/open-metadata/OpenMetadata/actions/runs/34354609470/job/102486313959) |

The TestLibrary retry trace identifies a false-positive selection assertion. The
visible trigger still reads `Select Data Quality Dimension`, and the hidden
native select's selected value is empty. `toContainText('Accuracy')` on the whole
field passes because its hidden select includes every option's text. The PATCH
contains only description and display-name changes and returns HTTP 200 in
48.4 ms. A local Chromium replay of that failed field snapshot reproduces the old
assertion passing and the corrected trigger assertion rejecting the empty field.
The recovery scopes entity-type and dimension assertions to the visible trigger
and selects the dimension with a locator after focus/scroll preparation. This
reproduces the assertion defect; complete browser stability still needs CI runs.

The redeploy retry trace contains HTTP 400 after 133.8 ms, wrapping an Airflow
internal-server error. That is an ingestion failure, not a browser timeout. The
spec also selects the first two rows of a global listing instead of its created
pipelines; its retry selected an unrelated existing pipeline. Fixture selection
and cleanup are now corrected locally. The available response does not establish
the cause of that deployment's HTTP 500; CI collected the scheduler's output but
omitted `api-server.log`. The workflow now retains bounded API-server and
DAG-processor logs, and the spec reports each selected pipeline ID and error body.

The AutoPilot artifact contains a PyMySQL connection timeout against the shared
external connector database while reading stored procedures. Both attempts show
the failure banner, not a successful workflow awaiting a late UI refresh. The
retry's workflow `120a3a06-59f8-409c-82c1-62097c7e79e5` reaches `FAILURE` while
workflow-status GETs take approximately 5–35 ms. The old helper accepted
`FAILURE` and `EXCEPTION` as completion; its later success-banner assertion hid
the ingestion failure behind a timeout. This is evidence of an external source
failure, not evidence that OpenMetadata request latency caused this incident.

All three relevant PRs were open at the failure-audit snapshot. A subsequent
September 9 check confirms that
[#33046](https://github.com/open-metadata/OpenMetadata/pull/33046) merged at
17:12:26 UTC and [#33060](https://github.com/open-metadata/OpenMetadata/pull/33060)
merged at 17:13:02 UTC. [#33058](https://github.com/open-metadata/OpenMetadata/pull/33058)
remains open at head `7b134d8e83ab7d3253cca0486fcaca3ff3d0d484`. The failed runs
above predate those merges and cannot measure their effectiveness. Additional
changes in this workspace remain local.

### Coverage of the three PRs

This comparison reads the net diffs at #33046 head
`b7351e0c5a59ffb2574561e16e77749c8b51898b`, #33058 head
`7b134d8e83ab7d3253cca0486fcaca3ff3d0d484`, and #33060 head
`5e902c757ed3a4655be992542e16870def63e11c`.

| PR | Included changes | Scope limits |
|---|---|---|
| #33046 | Fresh `-retry` name for shard results-JSON upload; summary prefers the retry copy | No download recovery, general upload recovery, commit/attempt integrity, or independent planned/native coverage reconciliation |
| #33058 | GlobalPageSize dropdown targeting and selected-value checks | Only page-size interactions; needs the complementary search-response waits from #33060 |
| #33060 | Page-size response waits; domain counts; metric search counts; task panels; deleted-entity picker assertions; PersonaAIContext/Rules; CustomizeWidgets; IngestionBot indexing | No TestLibrary or ContextCenterMemories changes, contract polling, AutoPilot completion, or bulk redeploy fix; owner-picker opening still uses the existing forced click |

Together their changes target three of the six recent terminal-failure scenarios
(GlobalPageSize, DomainDataProductsWidgets, MetricListSearch), corresponding to
seven of the ten observed incidents. That is overlap with known failure areas,
not a prediction that seven future failures are prevented. TestLibrary's confirmed
hidden-option assertion bug, AutoPilot execution checks and MySQL source
isolation, and pipeline fixture selection/cleanup are fixed only in this workspace.

This workspace also adds the missing ContextCenterMemories request matching,
owner-picker opening check, execution-aware contract polling, retry-worker
lifecycle isolation, transport/evidence validation, cache-warmer completion, and
failure/latency reporting. None of those additions is supplied by these three
PRs. The older Entity/Tag/Glossary/InputOutputPorts failures and the full CI
repetition acceptance remain outside their verified coverage.

### Recurrence and local fix coverage

GlobalPageSize persistence and DomainDataProductsWidgets asset removal are the
same exact scenarios in three failed workflows each: together, six of the ten
recent terminal failures. GlobalPageSize, TestLibrary, and AutoPilot also appeared
in the earlier September 8–9 removal audit. Recurrence at the spec level does not
imply an identical cause: the earlier AutoPilot failure involved selecting a
backend connection, while this sample waits for agent completion.

The 77 retry-pass incidents span 65 distinct scenarios. The Pipeline description
task in TasksUIFlow required a retry in eight of these ten workflows; it also
appeared six times in the earlier audit. Other exact repeats in this sample are
BulkImport's Database scenario (three), CustomizeDetailPage navigation (two),
ExplorePageRightPanel's deleted container-tag selection (two), and
GlossaryCRUDOperations' mutually exclusive glossary creation (two). These counts
are conditional on the ten failed workflows, not all merge-group validations.

| Current terminal scenario | What changed locally | Remaining uncertainty |
|---|---|---|
| TestLibrary external edit | Verify visible selected value; focus before locator-based selection | False-positive assertion reproduced from the failure snapshot; full selection stability still needs CI verification |
| GlobalPageSize persistence | Target the Records button; select and verify the value; wait for the matching page-size search request | Detachment observed; component-level dismissal cause not reproduced |
| DomainDataProductsWidgets removal | Wait for the search index count before reloading; allow this multi-step test a longer timeout | Addresses index-readiness and test-budget risks; the original missing-widget timeout still needs reproduction |
| MetricListSearch clear | Compare rendered rows with the actual clear-search response rather than an earlier global count | Removes a shared-state assumption; concurrent mutation in the original run is not independently established |
| AutoPilot completion | Pin a newly created workflow; require FINISHED; report failed/invalid/HTTP results; shard-local MySQL source in fast ingestion environments | External MySQL timeout identified; full browser/agent runs on the local source still need CI validation; other connectors retain their existing sources |
| Pipeline bulk redeploy | Select fixture-owned rows; wait for each exact deploy ID; report HTTP bodies; use on-demand fixtures and clean up even on failure | Original Airflow HTTP 500 needs the newly collected API-server log; concurrent valid/invalid DAG loading is tested locally |

Additional local changes address ContextCenterMemories' overly broad search waits,
ExplorePageRightPanel's forced owner click and selectors that also matched chips
outside the picker, TasksUIFlow's task-panel opening race, and DataContracts'
polling that could hide HTTP failures as pending execution. Backend retry-worker
isolation and artifact transport are handled separately below.

The earlier terminal-failure inventory also includes Entity's unsorted owner list,
SampleDataDomainDataProduct, Tag's Data Steward asset changes, and
GlossaryAdvancedOperations' term colors. This recovery does not claim new direct
fixes or completed reproduction for those scenarios. Previously merged fixes for
sample domain/product navigation and Tag still require verification. InputOutputPorts
collapse/expand also appeared repeatedly in the earlier retry-pass inventory and
has no direct fix here. Absence from this smaller sample is not evidence of repair.

## Server load versus browser races

These September 9, 2026 observations use the existing request and timing artifacts.
They compare different commits, so they are diagnostic examples, not a controlled
experiment. “Per attempt” includes lifecycle attempts, matching the performance
report's denominator. Server duration comes from the OpenMetadata access log and
does not include browser queuing or search-index propagation.

| Run | Product tests | API requests | API requests / attempt | Mean API server time | Application boots / UI scenario |
|---|---:|---:|---:|---:|---:|
| [Targeted PR, passed](https://github.com/open-metadata/OpenMetadata/actions/runs/34344480309) | 557 | 43,316 | 77.49 | 103.40 ms | 2.82 |
| [Full PR, passed with five retry-pass tests](https://github.com/open-metadata/OpenMetadata/actions/runs/34365816422) | 4,490 | 323,805 | 71.92 | 116.38 ms | 2.31 |
| [Merge group, owner-picker failure](https://github.com/open-metadata/OpenMetadata/actions/runs/34317122165) | 4,485 | 324,924 | 72.09 | 115.41 ms | 2.31 |

The full PR and merge-group examples have similar traffic and average latency.
They do not establish a queue-specific server slowdown, and averages cannot rule
out a slow tail. Targeted PR selection can expose only a fraction of the scenarios
that the full merge-group validation runs. Different shard packing also changes
the mutations and contention each scenario encounters.

Each shard starts its own OpenMetadata, database, and search containers. Queue
builds do not share one OpenMetadata process. Workers within a shard share those
services and indexed data. The fast environment defaults to a 1 GiB OpenMetadata
heap and a 2 GiB search heap; capacity changes require CPU/GC/heap evidence rather
than inferring contention from aggregate server milliseconds.

The earlier API reductions remain in `playwright/support/fixtures/serverLoad.ts`.
The full PR and merge-group examples still issued about 657,000 static requests
each, roughly two thirds of their traffic. Repeated navigation remains material:
there were about 2.31 application boots per UI scenario.

Playwright documents that [enabling routing disables HTTP caching](https://playwright.dev/docs/api/class-browsercontext#browser-context-route).
The pinned Chromium implementation sends `Network.setCacheDisabled` when routing
is enabled, including with a narrow regular expression. Narrow matching reduces
driver interception overhead; it does not restore the browser's asset cache.
A local Chromium experiment using the actual load reducer, two visits, and a
cacheable script observed:

| Context | Script requests reaching the server | Configuration API requests reaching the server |
|---|---:|---:|
| No routes | 1 | 2 |
| Existing load reducer | 2 | 1 |

This confirms a cache tradeoff, not its contribution to queue failures. Do not
cache mutable entity, permission, identity, or background-status responses to
reduce the numbers. The existing opt-in static cache also incurs driver overhead;
evaluate it against the same commit, shard plan, and workload before changing its
default. Prefer reducing repeated full-page navigation where the scenario allows.

## Changes in this recovery

- Artifact downloads have bounded recovery. Critical uploads use a fresh fallback
  name to avoid the failed-finalization name reservation. Native reports and shard
  status are validated against the tested commit before aggregation. Identical
  duplicate uploads count once; conflicting evidence within one execution or
  invalid evidence fails validation. For workflow reruns, a verified newer attempt
  supersedes that shard's older fallback; untouched successful shards can retain
  their earlier evidence for the same commit. First-attempt ledgers remain separate.
- Coverage reconciles planned identities independently with native results and
  timing records. An optional HTML/report upload problem is a reporting warning;
  missing execution evidence or a coverage mismatch remains a failure.
- Page-size, owner-picker, asset-search, task-panel, and widget tests use scoped
  interactions and observable completion. Search-dependent setup waits for the
  index; it does not assume REST creation makes an asset immediately searchable.
- Contract polling records the validation execution ID, checks HTTP status and
  result identity, and waits for a terminal result. `Queued` is pending. HTTP
  errors are no longer presented as `Running`, and unrelated data-quality results
  cannot substitute for a missing contract result.
- Retry-queue DAO tests stop the application's managed retry worker and restore
  it afterward. JUnit isolation prevents other test classes from depending on the
  worker during that interval. Tests that exercise a worker still start their own.
- Active fixture warming completes instead of being cancelled by the next merge.
  Existing fingerprint validation remains required.
- The digest paginates check runs, deduplicates workflow/report pairs, links failed
  scenarios and signatures, and separates cancellation evidence from direct
  failure. Raw first-attempt outcomes, retries, reruns, bypasses, skips, quarantine
  inventory, and unavailable measurements are reported separately.
- Access-log metrics include bounded latency histograms, API/static request
  counts, HTTP 5xx/429 counts, and the endpoints consuming the most server time.
  Workflow p95/p99 values are upper bounds from merged histogram counts, never
  averages of shard percentiles. The report identifies how many shards supplied
  latency evidence; old artifacts do not become zero-latency measurements.

## Candidate builds, merge batches, and throughput

A read-only September 9 ruleset check confirms `grouping_strategy: ALLGREEN`,
`max_entries_to_build: 5`, `max_entries_to_merge: 3`, and
`min_entries_to_merge: 1`. The five candidate futures for queued PRs A–E can be
`M+A`, `M+A+B`, through `M+A+B+C+D+E`. They overlap; each has its own validation.
The merge cap governs landing changes in the base branch after validation.
GitHub explicitly documents that merge limits do not combine merge-group builds.
If A is removed, downstream candidate branches must be rebuilt without it; their
PRs can remain queued. If C fails, A/B can still merge and D/E need candidates
without C. With a minimum of one, the maximum of three does not require GitHub
to wait for a three-PR batch. [GitHub merge-queue behavior](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue).

Define `N` as all required checks other than Playwright being green and `P` as
Playwright failing. This assumes resolved required-check outcomes and that
“Playwright-only” means the other required checks actually passed. Pending,
cancelled, and missing checks must remain separate from green results.
The supplied counts partition into 527 all-green attempts,
401 Playwright-only failures, and 254 attempts with at least one other failing
check (possibly also Playwright). Therefore:

- `P(N) = (527 + 401) / 1182 = 78.51%`.
- `f = P(P | N) = 401 / 928 = 43.21%`.
- `P(all green) = P(N) × (1 − f) = 527 / 1182 = 44.59%`.

This product uses a **conditional** failure probability and needs no independence
assumption. Playwright-only failures across all attempts are 33.93%; the overall
Playwright failure rate also needs the overlap among those 254 other failures.
The table's approximately 44% input should therefore be labelled “Playwright
failure given the other checks are green”. Eliminating Playwright failures alone
leaves a 78.51% green rate if the other-check outcomes stay fixed.

Assuming the supplied **189 merges count individual PRs merged through the
queue**, the observed conversion is `y = 189 / 527 = 0.3586` merged PRs per
first-pass green candidate. It is not `527 / 189`. Five green candidates that
land A–E give `5 / 5 = 1`, even if landing happens in batches of three, one and
one. Consequently, three is not a target for this ratio under the current
ALLGREEN strategy. Green candidates invalidated later, duplicate runs, end-of-
window censoring, and a mismatch between merge and validation cohorts can all
change the observed conversion. If 189 instead counts merge batches or includes
bypasses, PR counts must be reconstructed before using this coefficient.

Using the six supplied weekdays gives `A = 1182 / 6 = 197` attempts/day. The
following reproduces the capacity calculation with `A`, `y`, and the other-check
success probability held fixed. The arrival rate of approximately **33.3 PRs/day
is inferred from the user's utilization table**, not measured in this audit.
The starting backlog is the supplied 24 PRs.

| Conditional Playwright failure | Green attempts | PR merges/day | Utilization | Backlog drains with continuing arrivals |
|---|---:|---:|---:|---|
| Observed 43.21% | 44.59% | 31.5 | 1.06 | No sustained draining at these average rates |
| 20% | 62.81% | 44.4 | 0.75 | 2.17 days |
| 5% | 74.59% | 52.7 | 0.63 | 1.24 days |
| 0% | 78.51% | 55.5 | 0.60 | 1.08 days |

`mu = A × P(N) × (1 − f) × y` is a scenario model. In practice **both A and y
can change with f**. Fast cancellations inflate the number of attempts dispatched
without producing completed validations. Fewer invalidations can improve y while
longer-lived attempts reduce A. Treat the rows as conditional scenarios, not a
lower bound or a forecast of future throughput. At the stated fixed coefficients,
conditional Playwright failures below approximately 39.9% put capacity above the
assumed arrival rate; a much lower failure rate is needed for useful headroom.

For backlog `B`, merge capacity `mu`, and arrival rate `lambda`:

- `B / mu` clears the current backlog if no new PRs arrive. At zero Playwright
  failures this is about 10.4 hours; it is not an individual PR latency forecast.
- `B / (mu − lambda)` estimates net backlog draining under constant rates, only
  when `mu > lambda`. That gives about 1.08 days at zero Playwright failures.
- The table's approximately 1.1-hour value after the backlog drains matches the
  M/M/1 mean time in the system, `1 / (mu − lambda)`, converted to hours. That
  model assumes one server and exponential service times; it does not establish
  latency for five overlapping, dependent builds and batched merges. Measure
  enqueue-to-merge latency or replay real queue events with check durations and
  invalidations before accepting these time-to-merge estimates. [MIT M/M/1 model](https://www.ocw.mit.edu/courses/2-854-introduction-to-manufacturing-systems-fall-2016/927056a1af54772a587fd84ad4951e71_MIT2_854F16_Mm1Queue.pdf).

Above utilization one, backlog grows on average under the assumed stationary
rates; individual PRs can still merge and a quiet arrival period can drain the
queue. Weekday-average counts also do not establish weekend or hour-by-hour
arrival/service rates. Report the actual PR merge rate separately from candidate
throughput, merge batch size, green-candidate conversion, rebuild count, and CI
minutes discarded by invalidations. Attribute candidates to the same eventual
merge cohort before interpreting y as validation reuse.

## AutoPilot and deployment recovery additions

Fast ingestion shards now start a bounded, Docker-network-only MySQL 8.0.42
source before Airflow. Its read-only fixture user sees two schemas and three
populated tables, preserving MySQL metadata/profiler/classification and the
AutoPilot SSE assertions. Other MySQL connector specs retain their configured
source. The SQL and startup script participate in the existing fingerprint;
startup fails explicitly if initialization fails, and teardown removes the
container. Cold and warm fixture restoration use the same source initialization.

AutoPilot polling uses one disposed API context, the service's exact entity link,
a creation-time boundary, and a pinned execution ID. It retains the existing
5/15/30-second polling intervals. It accepts only `FINISHED`;
HTTP errors, missing/invalid identity, changed executions and terminal failure
states are explicit errors. Polling fits inside the existing eight-minute test
budget. Cleanup runs after failed creation/completion tests as well as successful
ones. Backend-connection and ingestion-runner helpers now focus the trigger and
verify its selected text or selected tab, avoiding hidden-option false positives.
The unused pass-through Markdown route was removed from service creation; this
does not establish that all other test routing permits browser HTTP caching.

The redeploy spec keeps both requests concurrent and selects only its two named
fixtures, checks their selected state, and waits for responses matching each
pipeline ID. The fixtures have no automatic schedule, so an hourly run cannot
race deployment and cleanup. Setup and cleanup dispose their API contexts, and
cleanup attempts both fixtures even when one fails.

Airflow diagnostics also show task-history foreign-key failures during deletion.
The old operation deleted `DagModel` before `TaskInstance`/`DagVersion`. A real
Airflow database reproduces the constraint failure. Deletion now delegates to
Airflow's own routine, which orders dependent rows correctly and refuses a
running task before files are removed. The deployed-DAG check also rejects a DAG
that failed to load; previously that case returned HTTP 200. These are confirmed
backend defects, but neither is established as the cause of the original bulk
redeploy HTTP 500. The separate DagContext race fix already exists in
`workflows/ingestion/common.py` and was not duplicated.

## Local evidence and remaining checks

- Nine new AutoPilot HTTP-boundary tests pass with three workers and zero retries.
  The extracted old completion behavior fails the failure/exception, HTTP-error,
  and stale-execution checks. These are helper regressions, not the full browser
  acceptance run.
- Airflow 3.3.1 tests run against an isolated PostgreSQL database: versioned task
  cleanup, running-task rejection with files preserved, invalid-DAG rejection,
  and concurrent valid/invalid deployment results, plus existing deployment,
  diagnostics and DagBag regressions. The original deletion/invalid-DAG tests
  were red before the changes and green afterward on SQLite as well.
- The actual MySQL fixture starts successfully. The ingestion image's SQLAlchemy
  client confirms two accessible schemas and three tables using the fixture
  credentials, with no host database port exposed.

- The retry-queue pending-record test failed with the application worker running.
  The full class passed all 36 tests after lifecycle isolation on PostgreSQL and
  Elasticsearch. MySQL/Elasticsearch also passed all 36 retry-queue tests and both
  conversation migration tests in the global-state lane.
- The five contract polling boundary scenarios passed 50 repetitions each with
  three workers and zero retries: completion, HTTP failure, wrong execution,
  pending timeout, and malformed status. These are HTTP-helper tests, not 50 runs
  of the complete DataContracts browser scenario.
- Two Select-in-modal component tests cover pointer and keyboard opening from an
  unfocused trigger, selection, dismissal, and restored focus. They pass on the
  existing component. The original browser detachment failure is not reproduced
  by this component test; no Select product fix is claimed.
- Existing history-pagination tests cover deletion during hydration and cursor
  preservation. The production fix was already present and was not duplicated.
- Full UI and core-component builds pass. Playwright TypeScript comparison found
  no introduced diagnostics against the same checkout and dependency set; the
  existing full type check has baseline errors.

The current result-by-ID endpoint returns the latest contract result. Polling
checks its identity and fails explicitly if a newer execution supersedes the one
being tested. Reproduce overlapping validations before deciding whether historical
result lookup needs a separate backend correction.

For a controlled latency comparison, pin the commit, full shard plan, runner
resources, worker counts, fixture fingerprint, and data population. Compare cold
fixture preparation with warm restoration separately. Record request counts,
latency histogram coverage, p95/p99/max, 5xx/429, phase durations, retries, and GC/CPU
evidence. Correlate failing requests with Playwright traces and server timestamps:
a successful empty search response followed by index propagation is different
from an HTTP timeout or a detached dropdown.

Before accepting individual UI fixes, reproduce their original failures and run
the affected scenarios 50 times with zero retries in both cold and warm CI
environments, retaining each project's normal worker count. On a provisioned CI
environment, for example, from the UI directory:

```bash
CI=true PLAYWRIGHT_IS_OSS=true PLAYWRIGHT_RETRIES=0 PW_WORKERS=3 \
  yarn playwright test --project=chromium --repeat-each=50 --retries=0 \
  --trace=retain-on-failure \
  playwright/e2e/Features/GlobalPageSize.spec.ts \
  playwright/e2e/Features/ContextCenterMemories.spec.ts
```

Run serial/global-state and ingestion projects in their existing lanes. Include
TestLibrary, DataContracts, TasksUIFlow, ExplorePageRightPanel, Entity, Tag,
GlossaryAdvancedOperations, AutoPilot, and the affected widget scenarios; a helper
soak cannot stand in for those browser runs. Keep setup/teardown and native report
collection enabled. Repeated tests on one reused fixture are only the warm half
of this check.

Run acceptance on GitHub using the same runner resources and services as the
queue; use short local runs for diagnosis. Preserve representative neighboring
tests and background work in the affected shards. Repeating an isolated scenario
on an otherwise idle server does not reproduce contention from a full shard.
Use a separate diagnostic run with bounded concurrency, not 50 simultaneous queue
builds. The normal `on-first-retry` trace setting records no trace with zero
retries, so the diagnostic command explicitly retains first-failure traces.

The transport acceptance exercise must include interrupted uploads/downloads,
primary-only and fallback-only artifacts, identical duplicate uploads, conflicting
duplicates, invalid JSON, missing reports, and wrong-commit evidence. Real test
failures and missing planned identities must remain red. Local fault tests cover
the evidence checks; GitHub transport interruption still requires CI validation.

After rollout, retain the existing five-build limit and require 20 consecutive
complete merge-group validations without avoidable ejections. Then inspect the
next 100 for recurrence and throughput. Record run IDs and commit identities;
exclude neither retries nor missing evidence from the record. Classify genuine
regressions and conflicts explicitly instead of forcing them to pass. These live
acceptance windows have not been completed by local verification.
