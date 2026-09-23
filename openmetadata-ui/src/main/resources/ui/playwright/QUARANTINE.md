# Playwright quarantine

Tests tagged `@quarantine` are excluded from every lane by
`grepInvert` in `playwright.config.ts`. Quarantine is a **holding pen, not a
resting place**: each entry below is a bug with an owner, and the fix is to
diagnose it and delete the tag — not to leave it here.

Run only the quarantined set to check whether an entry is still failing:

```bash
PLAYWRIGHT_RUN_QUARANTINED=true npx playwright test
```

## Why quarantine instead of retries

`retries: 1` was converting first-attempt failures into `status: "flaky"`, so
the shard exited 0 and the required `playwright-summary` check went green. Over
11 sampled merge_group runs (4487 tests each) that hid ~15 first-attempt
failures per run, ~1 of which also lost its retry and ejected a PR from the
merge queue. The flake-rate budget in
`.github/scripts/evaluate_playwright_performance.py` could not catch it: it is a
*budget* target (advisory by design), and 0.5% of 4487 tests is 22 tests, so
the failures were inside budget the whole time.

Quarantine makes the cost visible — a skipped test is obviously missing
coverage, a retried one looks green.

## Entries

1 entry. The threshold for quarantining is **2 or more** failures, counted per
generated variant rather than per source line. The 11 merge_group runs sampled
on 2026-09-04 that seeded this list are all released now; the entry below was
tagged separately, on 2026-09-11.

| Spec | Test | Seen | Symptom |
|---|---|---|---|
| `e2e/Pages/DataContracts.spec.ts` | Create Data Contract and validate for Table | 2/2 | Quarantined 2026-09-11 (BE bug, not a test flake). On both merge_group attempts of run 34588697338 the contract's quality/test-suite run finished without writing a result: `GET /dataContracts/{id}/results/{resultId}` shows `schemaValidation` (5/5) and `semanticsValidation` (1/1) populated but **`qualityValidation` absent**, so the aggregate `contractExecutionStatus` hangs on `Running` and never reaches a terminal state. The test suite + DQ ingestion pipeline were created and deployed fine (`POST …/ingestionPipelines/deploy` → 200), but the triggered Airflow DagRun completed in ~0.03s executing zero test cases, so no test-case result came back. `waitForDataContractExecution` then polls the full 600s and the fallback derives `suiteStatus = 'Running'`, failing `expect(...).toMatch(/^(Aborted\|Success\|Failed)$/)`. Fix is in BE: reap contract validation to a terminal state (`Aborted`/`Failed`) when the quality run fails to trigger or returns no result, instead of hanging on `Running`; plus BE/Ingestion should confirm test cases are attached before the pipeline is triggered so the run isn't empty. Owner: BE team. |

### Triage, 2026-09-09

All three were run against a local stack (current UI via the Vite dev server,
`--repeat-each=3`) and all three passed 3/3, well inside their budgets: the test
suite modal at 12-21s under a `test.slow()` timeout, Table Difference at
10-19s, the glossary drag at 6-7s. Their recorded rates are 3/11 and 2/11 so
this is the expected result rather than a contradiction — these are
load-dependent and an idle laptop does not reproduce them. **More local runs
will not settle them** — but neither will waiting for CI: the only thing under
`.github/` that sets `PLAYWRIGHT_RUN_QUARANTINED` is the *Inventory existing
quarantined coverage* step in `playwright-e2e-reusable.yml`, and it runs
`playwright test --list`. Listing is not executing, so a quarantined test still
runs in no lane at all and has produced no evidence since it was tagged. The
soak lane this file describes does not exist; the inventory step only makes the
dropped coverage countable. Getting these three moving needs that lane (or a
one-off dispatch) first.

The test suite modal and Table Difference entries from this triage have since
been root-caused and released — see *Released from quarantine* below. The lead
recorded here for the test suite entry had the timing backwards and has been
removed.

`PLAYWRIGHT_RUN_QUARANTINED=true` selects the quarantined tests plus the 7 setup/teardown
fixture projects, which the soak lane deliberately leaves unfiltered so login and
entity seeding still happen — a project-level `grep` *is* applied to dependency
projects, so filtering them would make every quarantined test fail for want of
`admin.json` instead of for its flake.

To see what quarantine currently costs, run `npx playwright test --list` with and
without `PLAYWRIGHT_RUN_QUARANTINED=true` and compare the totals. That pair of
numbers used to be written out here; nothing checks them, so they went stale on
every release — derive them when you need them instead.

## Not quarantined — fixed instead

These were failing their first attempt in ~every run and are root-caused, so
they were repaired rather than parked:

| Spec | Root cause |
|---|---|
| `e2e/Features/ActivityStream.spec.ts` — activity stream API is called when visiting entity page | Released without a code change: 3/3 green locally, and no load-dependent symptom was ever recorded for it. |
| `e2e/Features/Table.spec.ts` — should persist page size | Released without a code change: 3/3 green locally. Its recorded symptom (timeout after `waitForAllLoadersToDisappear`) is load-dependent, so local runs are weak evidence — re-tag it if it ejects a PR. No mechanism was identified for why it now passes. |
| `e2e/Pages/Lineage/LineageInteraction.spec.ts` — Verify node panel opens on click | Two causes, and the symptom recorded here was only the second. (1) `fitToScreen` returned before its menu popover finished its exit animation, leaving a second `[role="dialog"]` in the DOM, so the test's unscoped `[role="dialog"]` assertion tripped strict mode. (2) `Verify edge delete button in drawer` deletes the shared `table1 → topic` edge and never restores it, so every later test in the file saw a graph without the topic — that is the "node is not in the graph" symptom. Fixed by having `fitToScreen` wait for the menu to detach, scoping the assertion to `lineage-entity-panel`, and restoring the edge in a `finally`. |
| `e2e/Pages/Glossary.spec.ts` 128 / 198 / 421 | `utils/glossary.ts` used `page.textContent()` — waits for the element, not its text — so a cold first attempt read `""`. #32333 (a revert of #30896) had reintroduced this after it was already fixed. Restored to `toContainText`. |
| `e2e/Features/ContextCenterArticles.spec.ts:670` | #32283 removed a `waitForTimeout(500)` that was covering the zustand → localStorage flush of `recentlyViewed`. Navigating away before the flush meant the Recently Viewed panel had no entry to render, so the trailing assertion had nothing to auto-wait for. Replaced with `waitForRecentlyViewed`, which polls the persisted store. |
| `e2e/Features/ClassificationImportExport.spec.ts:64` | `beforeAll` POSTed fixtures whose names were generated at module scope, so a second pass in the same worker 409'd on every create. Fixtures are now rebuilt inside `beforeAll`, and an `afterAll` was added — the spec previously leaked two classifications, a tag and a user into the shard on every run. |

### Released from quarantine

Diagnosed and fixed, so the tag came off. If any of these flakes again the fix
was wrong — re-quarantine it with the new evidence rather than restoring the old
entry.

| Spec | Test | Root cause |
|---|---|---|
| `e2e/Pages/TestSuiteDetailsPage.spec.ts` | Add test case modal on Test Suite details page - filters and select | A product bug, not a test race. `SearchDropdown` re-synced its pending selection from the `selectedKeys` prop on every identity change, *including while open*. In the Add Test Case modal that prop is a memo over the Column options, which the modal fetches once on mount with a catalog-wide `search/aggregate` over `columns.name.keyword`. Under shard load that request lands late — after the test has clicked a column but before Update — the memo gets a new identity, the effect wipes the click, and Update emits `[]`. No request ever carries `columnName`, so the hoisted `waitForResponse` never matches. A real user loses the click the same way. The earlier lead here assumed the options were still *populating*; the failure actually needs a valid option clicked first and the fetch to land *after*. Fixed by syncing from props only while closed (regression test in `SearchDropdown.test.tsx`), and the helper now searches for a uuid-suffixed column by name instead of taking `.first()` from an unscoped list. `TestSuite.spec.ts` shared the helper and the exposure. A second, independent cause surfaced while verifying: `TestSuiteListPanel` never cancelled its 500ms search debounce on unmount, so when the spec opened a suite within that window — which happens when its `testSuites/search/list*` wait resolves on the slow initial list request rather than the search — the stale `navigate({ search })` resolved against the list route and bounced the page back, failing `verifyBundleSuitePageLoaded`. Fixed by cancelling the debounce on unmount (regression test in `TestSuiteListPanel.test.tsx`). |
| `e2e/Pages/EntityDataConsumer.spec.ts` | Update description (Table) | `updateDescription` resolved the editor with a page-global `descriptionBox` and `.first()`, so with the edit modal open it targeted the inline editor *behind* the overlay — visible, so the assertion passed, then the click failed on `ant-modal-wrap ... intercepts pointer events` until the test timed out. Now scoped to the dialog, asserting a single match. |
| `e2e/Features/DataQuality/TestLibrary.spec.ts` | should create, edit, and delete a test definition | `TestDefinitionFormBody` rebuilt `options: toOptions(Object.values(…))` on every render. Focusing a field re-renders it via `onActiveFieldChange`, and the new `items` identity made react-aria rebuild the listbox collection, detaching the option mid-click. The option lists are enum-derived and now built once at module scope. |
| `e2e/Features/DataQuality/TestLibrary.spec.ts` | should maintain page on edit and reset to first page on delete | Same select-option path as above. |
| `e2e/Features/PersonaAIContextRules.spec.ts` | knowledge entity type forces Fully rendered on and disables it | The evidence was already stale when it was written down. Every test in the file reached its subject through `navigateToAIContextTab`, which called `navigateToPersonaWithPagination` — a walk of up to 15 pages, each costing a `waitForAllLoadersToDisappear`, a `next` click and a `/api/v1/personas*` round trip, before the test touched anything it was asserting on. That is the timeout, and it is why the rate tracked shard load (7/11) rather than being deterministic: the walk grows with the personas the shard has accumulated. #32458 then moved the editor into Context Center on 2026-09-07, replacing the whole walk with `goto('/context-center/ai-context')` plus one card click, and made the list page follow its cursor to exhaustion server-side. Green 9/9 locally at ~5s against a 60s budget. |
| `e2e/Features/Glossary/GlossaryHierarchy.spec.ts` | should cancel drag and drop operation | `dragAndDropTerm` pressed at coordinates computed before the glossary page finished hydrating — the description block lands last and pushes every row down about a row height — and `force: true` skipped the actionability check that would have waited. It now holds both rows still before pressing. |
| `e2e/Features/Glossary/GlossaryHierarchy.spec.ts` | should move term to root of different glossary | `changeTermHierarchyFromModal` calls the `moveAsync` API, which returns 200 immediately while the actual move is processed asynchronously. The test navigated to glossary2 and asserted the moved term without waiting for the async move to complete — a race the test lost 9/11 times. Added an `expect.poll` that waits for the term's `glossary.fullyQualifiedName` to update (same pattern as the passing H-M05 test). The misleading "Drag-and-drop" symptom label was from the quarantine entry; this test uses the modal, not drag-and-drop. |
| `e2e/Pages/ExplorePageRightPanel_KnowledgeCenter.spec.ts` | Should remove user owner for knowledgeCenter | Released in #33395. The Explore summary panel renders owners from the search document, which is refreshed asynchronously after the owner PATCH, so polling the DOM and re-navigating raced the index refresh in both the add and remove steps. The test now gates on `/api/v1/search/query` through `waitForOwnerIndexed` (a nested `owners.id` query filter, since `owners` is nested in `knowledge_page_search_index`; removal waits on a `must_not` of the same clause), then navigates once and asserts. |
| `e2e/Pages/Lineage/LineageFilters.spec.ts` | the whole describe (15 tests) | Tagged in #33357 on 2026-09-15 without an entry here, released in #33336 on 2026-09-18. A product bug: `LineageMap` cleared its `loading` state as soon as the scene response arrived, before ELK had positioned the nodes, so `waitForAllLoadersToDisappear` returned on a graph that was not on screen yet. `setLoading(false)` now runs in the layout's `.then()`, and a `pendingFetchRef` tracks an in-flight fetch so a cache hit racing that fetch cannot leave the loader stuck instead. The lineage export test was fixed in the same PR (`ExportUtils`). |
| `e2e/Features/DataQuality/TableLevelTests.spec.ts` | Table Difference | A test-side race, not a product bug. The key-column selects sit in the Add Test Case drawer's scroll container; when a trigger is partly clipped by it, Playwright's click scrolls it just before `pointerdown`. The browser delivers that `scroll` event a frame later, after react-aria has opened the non-modal popover, and react-aria closes a popover when an ancestor of its trigger scrolls — so the option click timed out against a list that had already gone. A trace from a local repro showed the list open with the wanted option, then closed 160ms later with no click in between. `selectOptionWithRetry` now centres the trigger and lets two frames run before clicking (`scrollIntoViewAndSettle` in `utils/common.ts`; `scrollIntoViewIfNeeded` reveals only the minimum and could leave the click point clipped), and every key- and use-column pick in the test goes through one of the two. Before table 2's pick the test waits for every listbox to detach with `toHaveCount(0)`: table 1's popover and table 2's search popover can both still be exiting, and `not.toBeVisible` fails on strict mode with two matches rather than waiting. The evidence is thinner than for the rows above. The flake reproduced locally only at 4 workers (about 1 run in 12-20), which also runs the local stack out of memory; at 1 worker the unfixed test passed 20/20, and 10/10 under 4x CPU throttling, so there is no local A/B. The fixed test passed 20/20 at 1 worker and 10/10 throttled. Run it with tracing off: tracing slows each action enough to hide the strict-mode failure above, which failed 17/20 untraced and 0/10 traced. CI is the soak — if it fails at a column pick again, re-quarantine it with the trace. |

## Left running deliberately

**Single-observation tests.** 50 further tests failed exactly once across the 11
sampled runs. One observation is not evidence of a flake, and quarantining them
would drop real coverage for noise.

**Two specs that looked worse than they are.**
`e2e/Pages/CustomProperties.spec.ts` and
`e2e/Features/RestoreEntityInheritedFields.spec.ts` each showed 2 failures at
the source line, but those were *different generated variants* (`database` +
`tableColumn`, and `Topic` + `MlModel`) — one observation each. Tagging the
shared line would have quarantined 28 and 12 test instances respectively to
chase two single failures, so they stay in.

That distinction is the reason the threshold is counted per variant: a tag on a
`describe`-loop body is not a scalpel.

**What should catch the rest.** A per-test flake ledger that fails a PR when a
test flakes that does not flake on `main` — snapshot the flaking set from
merge_group runs into a baseline file (the same shape as
`.github/playwright/timing-baseline.json`, refreshed by the same job) and gate
on new entries. That closes the hole these 13 came through; quarantine only
stops them costing merge-queue time today.
