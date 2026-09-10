# Playwright test-design audit — September 9, 2026

The audit scope is the complete suite, not the nine retry-pass tests in one
report: **394 E2E spec files and 660 TypeScript files**, including configuration,
setup, teardown, fixtures, page objects, utilities, and four browser-helper specs.
There are 2,892 static test declarations; parameterized declarations expand into
more runtime tests. This is source review and focused regression validation, not
a claim that every end-to-end scenario has been executed or proven stable.

- [Every source file, fingerprint, and detected pattern](merge-queue-playwright-file-audit.csv)
- [Every static test declaration](merge-queue-playwright-test-inventory.csv)
- [32 non-green executions in the two referenced reports](merge-queue-observed-failures.csv)
- [Queue diagnosis, load measurements, and rollout criteria](merge-queue-recovery.md)

The inventories cover every source file. Shared infrastructure and the flagged
failure patterns received additional contextual review. A pattern is a review
candidate, not evidence that a test is flaky; the file inventory deliberately
does not label files without matches as “safe.”

## Confirmed defects and repairs

| Failure mechanism | Repair | Evidence and limits |
|---|---|---|
| Fixture collections retained entities deleted by an earlier `beforeAll`/`afterAll` cycle | Reset collections before repopulating them in TasksUIFlow and other fixture-heavy suites; reset cleanup registries | A local lifecycle reproduction failed before the fix. The current TasksUIFlow trace searched an old, deleted dashboard; its 404 took 18 ms, while fresh dashboards had different IDs. This was not a slow response. |
| Parallel fixture setup ignored rejected promises; support helpers accepted error bodies as entities | Await and report all setup/cleanup failures; validate responses; check 50 support-class DELETE calls, accepting an already-absent fixture without repeating the DELETE | HTTP-boundary tests exercise setup failures, malformed responses, cleanup 403/503, and one request per mutation. User/ML-model PATCH helpers now return the parsed entity instead of the response body's function. |
| A status predicate could discard the first failed response and accept a later success | Separate request identity from status validation at 159 response waits; match methods independently; preserve the first response | Real-browser HTTP 503→200 reproduction failed before the fix. Regressions cover exact statuses, allowed status sets, and any 2xx. A new lint rule rejects status/`ok()` filtering. |
| Indexing readiness meant only “some hit exists,” or accepted an entity's pre-PATCH version | Validate the exact entity and, when required, its updated version before issuing the UI search | The old-version reproduction returned after one stale response; the corrected helper waits for the requested version. Facet, owner, domain/product listing, summary-panel, and asset-picker helpers no longer replay searches to establish fixture readiness. |
| Old search responses overwrote newer results | Guard request generations in AdvancedSearch, the alert team/user picker, and the data-product picker; reject stale pagination results and refresh an active query when its fetch scope changes | Product regressions reproduced stale success and error ordering, stale pagination, and a changed fetch scope. These were product races, not merely test-selector issues. |
| An in-flight GET could repopulate a configuration cache after a write | Invalidate on write start and completion; only store a GET if its generation is still current | Two real-browser regressions cover a read starting before a write and a read during a write. Subsequent repeated reads still use the bounded cache. |
| Editing a task could click its current primary action, including Accept, before looking for Edit | Select the intended primary or menu action once and wait for its modal | The Accept/Edit reproduction failed before the fix; workflow and legacy controls pass afterward. |
| The bulk-import helper tried multiple editors and could fill an unrelated textbox while reporting success | Focus the selected grid cell, open its editor once, and fill/commit the scoped editor; remove Enter/F2/double-click recovery loops | A reproduction with the real React Data Grid left the cell unchanged and altered the unrelated input before the fix; the repaired helper updates only the cell. |
| Dropdowns and sliders were acted on during scrolling, focus changes, or animation | Scroll and establish focus before opening; scope popup options; verify the selected value; measure slider geometry after layout settles | Local Select/ComboBox and slider reproductions pass. This does not establish that every historical dropdown failure had the same cause or that the underlying Select component needs no further investigation. |
| Awaiting `.isVisible()` discarded its boolean rather than asserting readiness | Replace 28 discarded state queries with assertions; add a lint guard | A standalone `await locator.isVisible()` neither asserts visibility nor waits for it to become true. |
| Ingestion tests repeated triggers/deploys or converted request failures into pending state | Trigger once, pin a fresh execution, poll read-only status, and fail on HTTP errors or unsuccessful terminal states | HTTP regressions verify one trigger, execution identity, malformed responses, and terminal failures. A failed AutoPilot or Airflow execution remains red. |
| Contract result-by-ID returned the latest execution instead | Query the requested result ID within its contract; return 404 for unknown or other-contract IDs | Two new integration tests failed against the old implementation. All four targeted result tests pass on PostgreSQL and Elasticsearch. |

Additional source repairs remove whole-filter and tour replay loops, repeat
drag/keyboard actions, weak page-size selection, reused waits, and response waits
registered after navigation. Team-move confirmation now scopes the Confirm button
and parses query parameters instead of assuming their order. Navigation-blocker
checks target the actual unsaved-changes dialog and await the resulting URL.
These changes preserve the assertions; they do not prove that each historical
timeout is eliminated without the affected full scenario running in CI.

Three new lint rules prevent the confirmed fixture-array, discarded-state-query,
and status-filter patterns from returning. Existing suppressions shrink from
1,302 to 1,266 positional-locator violations; none are added. No test retries,
new quarantine, or replay of failed mutations is introduced.

## Why PRs and merge groups can differ

The measured full PR and merge-group examples had similar request volume and
mean server latency: roughly 72 API requests per attempt and 115–116 ms per API
request. Those examples use different commits and do not rule out tail latency.
Targeted PR checks run less coverage, and different shard composition changes the
fixtures, mutations, and resource contention encountered by a test. Each shard
starts its own server, database, and search containers; the five candidate builds
do not all use one OpenMetadata server. See the linked recovery report for the
run URLs and measurement definitions.

Latency can expose an ordering bug without being its underlying cause. An old
search response winning a race, a click scrolling a popup closed, or a discarded
boolean check can all pass on a fast run and fail on a slower run. Replaying those
actions hides the defect and increases request volume. Readiness checks should
observe the specific pending state, then perform the action once.

The existing request reductions remain enabled. Browser routing disables native
HTTP caching, including for static assets; narrowing the route does not restore
that cache. The existing cache experiment and routing documentation are linked in
the recovery report. Repeated full-page navigation remains a performance target,
but removing routes without measuring the extra API calls would trade one cost
for another.

## What still needs runtime evidence

The nine retry-pass cases are recorded separately from terminal failures. The
two reports also contain actual ingestion failures and a pipeline cleanup socket
hang-up. There is no evidence that a selector fix repairs those backend/transport
failures. The recent AutoPilot execution returned `FAILURE`; its failure state
must not be treated as success, and the available diagnostics do not establish
its current server-side cause.

The final static inventory retains candidates such as read-only polling,
virtualized-list traversal, explicit expiry tests, forced actions, and broad or
possibly reused response waits. Examples requiring full-scenario attention are
InputOutputPorts hydration, inherited-field propagation, glossary hierarchy
dialogs, team drag/drop, navigation blocking, and negative permission scenarios.
Existing quarantine and lint debt are visible; passing this audit does not
certify that coverage as healthy. The generated findings contain exact locations
for continued investigation.

For each remaining or recurring failure, retain the first failing action, its
request method/URL/status, execution or fixture ID, and server timing. Compare
the same commit and shard plan under cold and warm conditions, with normal CI
concurrency. Measure p95/p99/max latency and 5xx/429 alongside request counts,
application boots, fixture preparation, and total workflow duration. Means alone
cannot distinguish server contention from browser ordering errors.

## Verification and acceptance

Local verification covers product, HTTP, browser, backend, and lint boundaries;
the PR description records the final command results. Reproductions deliberately
control response ordering or focus so they exercise the defect rather than
depending on it happening randomly. The browser helper regressions also run as a
required CI step. PR diagnostic uploads remain enabled; a JSON transport failure
does not rewrite a shard's test outcome, while missing execution evidence still
fails the required summary. Merge groups keep local coverage verification and
avoid diagnostic artifact uploads.

Operational acceptance remains **50 repetitions of affected full scenarios with
zero test retries**, at normal CI concurrency in cold and warm environments,
followed by 20 complete consecutive merge-group validations without avoidable
ejection and monitoring of the next 100. Those runs belong on GitHub's actual
runner topology. Local boundary tests do not satisfy that requirement, and no
100% first-pass or throughput improvement is claimed yet.

Regenerate the complete inventory from the repository root after installing UI
dependencies:

```sh
node .github/scripts/audit_playwright_design.cjs --output .context/playwright-design-audit
```

The command writes source hashes, imports, calls, test declarations, all pattern
locations, a file matrix, and a test inventory. The CSV files linked above are a
snapshot of the audited working tree; later source changes require regeneration.
