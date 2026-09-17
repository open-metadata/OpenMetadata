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

3 tests. Most evidence is failures observed across 11 merge_group runs sampled on
2026-09-04; the threshold for quarantining is **2 or more**, counted per
generated variant rather than per source line.

| Spec | Test | Seen | Symptom |
|---|---|---|---|
| `e2e/Pages/ExplorePageRightPanel_KnowledgeCenter.spec.ts` | Should remove user owner for knowledgeCenter | 1/1 | Re-quarantined 2026-09-10 on fresh evidence, not the 2026-09-04 sample. The 11/11 failure it was first tagged for was real and is fixed (`openEntitySummaryPanel` waited for the NavBar `searchBox` on a page that renders `ExploreSearchInput`), but releasing it surfaced a second cause underneath. In PR #33054 it failed its first attempt and passed on retry: `expectOwnerInPanel` polled for the owner chip for the full 60s, re-navigating between attempts, and never saw it — even though `addOwnerInKCPanel` had already awaited the PATCH, so the owner was persisted. That is the *original* recorded symptom (owner chip not found), so the panel's read path lags the write rather than the navigation being wrong. A longer poll is not the fix; find what the panel reads and wait on that. |
| `e2e/Pages/DataContracts.spec.ts` | Create Data Contract and validate for Table | 2/2 | Quarantined 2026-09-11 (BE bug, not a test flake). On both merge_group attempts of run 34588697338 the contract's quality/test-suite run finished without writing a result: `GET /dataContracts/{id}/results/{resultId}` shows `schemaValidation` (5/5) and `semanticsValidation` (1/1) populated but **`qualityValidation` absent**, so the aggregate `contractExecutionStatus` hangs on `Running` and never reaches a terminal state. The test suite + DQ ingestion pipeline were created and deployed fine (`POST …/ingestionPipelines/deploy` → 200), but the triggered Airflow DagRun completed in ~0.03s executing zero test cases, so no test-case result came back. `waitForDataContractExecution` then polls the full 600s and the fallback derives `suiteStatus = 'Running'`, failing `expect(...).toMatch(/^(Aborted\|Success\|Failed)$/)`. Fix is in BE: reap contract validation to a terminal state (`Aborted`/`Failed`) when the quality run fails to trigger or returns no result, instead of hanging on `Running`; plus BE/Ingestion should confirm test cases are attached before the pipeline is triggered so the run isn't empty. Owner: BE team. |
| `e2e/Pages/TestSuiteDetailsPage.spec.ts` | Add test case modal — filters and select | 3/11 | `waitForResponse` on the test-case search never resolves. |

### Triage, 2026-09-09

All three were run against a local stack (current UI via the Vite dev server,
`--repeat-each=3`) and all three passed 3/3, well inside their budgets: the test
suite modal at 12-21s under a `test.slow()` timeout, Table Difference at
10-19s, the glossary drag at 6-7s. Their recorded rates are 3/11 and 2/11 so
this is the expected result rather than a contradiction — these are
load-dependent and an idle laptop does not reproduce them. **More local runs
will not settle them** — but neither will waiting for CI: nothing under
`.github/` sets `PLAYWRIGHT_RUN_QUARANTINED`, so a quarantined test runs in no
lane at all and has produced no evidence since it was tagged. The soak lane this
file describes does not exist. Getting these three moving needs that lane (or a
one-off dispatch) first.

Table Difference from this triage has since been root-caused and released — see
*Released from quarantine* below.

One unverified lead, for whoever picks up the test suite entry: its recorded
symptom is a `waitForResponse` that never resolves, and every listener in
`utils/addTestCaseList.ts` is correctly hoisted above the action that triggers
it — so a missed-because-registered-late response is not the cause.
`addTestCaseListFilterByFirstColumn` is the one that can genuinely never see its
request: it picks the Column dropdown's first `menuitem` and then waits for a
`testCases/search/list` carrying `columnName`. If the dropdown is still
populating, the first menuitem is not yet a real column, and the update it
submits produces a request without `columnName`. `addTestCaseListResetFilters`
repeats the same `.first()` menuitem pick. Confirm against a CI trace before
changing anything.

`PLAYWRIGHT_RUN_QUARANTINED=true` selects the quarantined tests plus the 7 setup/teardown
fixture projects, which the soak lane deliberately leaves unfiltered so login and
entity seeding still happen — a project-level `grep` *is* applied to dependency
projects, so filtering them would make every quarantined test fail for want of
`admin.json` instead of for its flake.

Re-run `npx playwright test --list` after changing this file and update the
default-lane count here. It is **4602 of 4619**; the quarantined lane lists 24,
which is 17 quarantined tests plus the 7 fixture projects above. The 17 are the
DataContracts and TestSuiteDetailsPage entries and the whole
`e2e/Pages/Lineage/LineageFilters.spec.ts` describe (15 tests), tagged in #33357
without an entry here yet. (It was 4575 of 4580 with 5 entries, and 4576 of 4580
with 4.)

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
| `e2e/Pages/EntityDataConsumer.spec.ts` | Update description (Table) | `updateDescription` resolved the editor with a page-global `descriptionBox` and `.first()`, so with the edit modal open it targeted the inline editor *behind* the overlay — visible, so the assertion passed, then the click failed on `ant-modal-wrap ... intercepts pointer events` until the test timed out. Now scoped to the dialog, asserting a single match. |
| `e2e/Features/DataQuality/TestLibrary.spec.ts` | should create, edit, and delete a test definition | `TestDefinitionFormBody` rebuilt `options: toOptions(Object.values(…))` on every render. Focusing a field re-renders it via `onActiveFieldChange`, and the new `items` identity made react-aria rebuild the listbox collection, detaching the option mid-click. The option lists are enum-derived and now built once at module scope. |
| `e2e/Features/DataQuality/TestLibrary.spec.ts` | should maintain page on edit and reset to first page on delete | Same select-option path as above. |
| `e2e/Features/PersonaAIContextRules.spec.ts` | knowledge entity type forces Fully rendered on and disables it | The evidence was already stale when it was written down. Every test in the file reached its subject through `navigateToAIContextTab`, which called `navigateToPersonaWithPagination` — a walk of up to 15 pages, each costing a `waitForAllLoadersToDisappear`, a `next` click and a `/api/v1/personas*` round trip, before the test touched anything it was asserting on. That is the timeout, and it is why the rate tracked shard load (7/11) rather than being deterministic: the walk grows with the personas the shard has accumulated. #32458 then moved the editor into Context Center on 2026-09-07, replacing the whole walk with `goto('/context-center/ai-context')` plus one card click, and made the list page follow its cursor to exhaustion server-side. Green 9/9 locally at ~5s against a 60s budget. |
| `e2e/Features/Glossary/GlossaryHierarchy.spec.ts` | should cancel drag and drop operation | `dragAndDropTerm` pressed at coordinates computed before the glossary page finished hydrating — the description block lands last and pushes every row down about a row height — and `force: true` skipped the actionability check that would have waited. It now holds both rows still before pressing. |
| `e2e/Features/Glossary/GlossaryHierarchy.spec.ts` | should move term to root of different glossary | `changeTermHierarchyFromModal` calls the `moveAsync` API, which returns 200 immediately while the actual move is processed asynchronously. The test navigated to glossary2 and asserted the moved term without waiting for the async move to complete — a race the test lost 9/11 times. Added an `expect.poll` that waits for the term's `glossary.fullyQualifiedName` to update (same pattern as the passing H-M05 test). The misleading "Drag-and-drop" symptom label was from the quarantine entry; this test uses the modal, not drag-and-drop. |
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
