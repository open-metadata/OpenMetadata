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

4 tests. Evidence is failures observed across 11 merge_group runs sampled on
2026-09-04; the threshold for quarantining is **2 or more**, counted per
generated variant rather than per source line.

| Spec | Test | Seen | Symptom |
|---|---|---|---|
| `e2e/Pages/TestSuiteDetailsPage.spec.ts` | Add test case modal — filters and select | 3/11 | `waitForResponse` on the test-case search never resolves. |
| `e2e/Features/Glossary/GlossaryHierarchy.spec.ts` | should move term to root of different glossary | 2/11 | Drag-and-drop. |
| `e2e/Features/DataQuality/TableLevelTests.spec.ts` | Table Difference | 2/11 | |

### Triage, 2026-09-09

All three were run against a local stack (current UI via the Vite dev server,
`--repeat-each=3`) and all three passed 3/3, well inside their budgets: the test
suite modal at 12-21s under a `test.slow()` timeout, Table Difference at
10-19s, the glossary drag at 6-7s. Their recorded rates are 3/11 and 2/11, so
this is the expected result rather than a contradiction — these are
load-dependent and an idle laptop does not reproduce them. **More local runs
will not settle them** — but neither will waiting for CI: nothing under
`.github/` sets `PLAYWRIGHT_RUN_QUARANTINED`, so a quarantined test runs in no
lane at all and has produced no evidence since it was tagged. The soak lane this
file describes does not exist. Getting these three moving needs that lane (or a
one-off dispatch) first.

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

`PLAYWRIGHT_RUN_QUARANTINED=true` selects these 3 plus the 7 setup/teardown
fixture projects, which the soak lane deliberately leaves unfiltered so login and
entity seeding still happen — a project-level `grep` *is* applied to dependency
projects, so filtering them would make every quarantined test fail for want of
`admin.json` instead of for its flake.

Re-run `npx playwright test --list` after changing this file and update the
default-lane count here. It is **4567 of 4571** with these 4 entries; the
quarantined lane lists 11, which is the 4 plus the 7 fixture projects above.
(It was 4543 of 4555 when the list held 13.)

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
| `e2e/Pages/ExplorePageRightPanel_KnowledgeCenter.spec.ts` | Should remove user owner for knowledgeCenter | `openEntitySummaryPanel` always waited for `searchBox`, the NavBar `GlobalSearchBar`. `/explore` renders its own `ExploreSearchInput` and never mounts the NavBar one, so on that page the wait could only time out — `runSearch` returned false every attempt and the retry poll spun until its budget expired. The helper had never worked for callers landing on `/explore`, which is why this failed 11/11 rather than flaking. It now picks the field the page actually renders. |
| `e2e/Features/Glossary/GlossaryHierarchy.spec.ts` | should cancel drag and drop operation | `dragAndDropTerm` pressed at coordinates computed before the glossary page finished hydrating — the description block lands last and pushes every row down about a row height — and `force: true` skipped the actionability check that would have waited. It now holds both rows still before pressing. |

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
