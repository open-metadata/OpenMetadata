# Playwright quarantine

Quarantined tests are excluded **from the merge queue only** —
`playwright.config.ts` adds the `grepInvert` when `GITHUB_EVENT_NAME` is
`merge_group`. PR checks, nightlies and local runs still execute them.

There are **two ways to quarantine**, and which one is right is not a matter of
taste:

| | Use when | Cost |
|---|---|---|
| `{ tag: '@quarantine' }` on the `test()` | the test is written once and runs once | none |
| an entry in [`quarantine-list.ts`](./quarantine-list.ts) | the `test()` is inside a loop and generates variants | none |

A tag sits on the `test()` **call**, so tagging a loop-generated test
quarantines **every variant that loop produces**. `Entity.spec.ts › Spreadsheet
› Tier Add, Update and Remove` is 1 of 12 entity variants;
`CustomProperties › table › Date` is 1 of dozens. Tagging those source lines to
chase two observations each is the mistake this file has warned about since the
first batch — "a tag on a `describe`-loop body is not a scalpel". The list
matches the full title instead, so it selects the single variant the evidence is
about.

A drifted title is a quarantine entry that silently matches nothing — it looks
quarantined and runs in the queue anyway. The guard against that runs in CI, in
UI Checkstyle, and locally:

```bash
yarn test:eslint-rules
```

It asserts every entry selects **exactly one** test. It lives in
`playwright/eslint-rules/tests/quarantine-list.test.mjs` because that directory
is already globbed by `test:eslint-rules` and is exempt from the corpus
guardrail that keeps `playwright/` TypeScript-only (Playwright's default
`testMatch` collects `.mjs`, so a check script beside the list would be run as
an unlinted test).

That split is the whole point: a flake in the queue ejects a batch and stalls
everyone, while the same flake on a PR costs nothing (`retries: 1` turns it
green) and keeps the test in front of the person who can fix it. Deleting the
coverage from PRs too would hide the bug instead of parking it.

Quarantine is a **holding pen, not a resting place**: each entry below is a bug
with an owner, and the fix is to diagnose it and delete the tag.

Run only the quarantined set to check whether an entry is still failing:

```bash
PLAYWRIGHT_RUN_QUARANTINED=true npx playwright test
```

Reproduce what the merge queue actually runs:

```bash
GITHUB_EVENT_NAME=merge_group npx playwright test --list
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

62 tests, in three batches. The threshold for quarantining is **2 or more**
observed failures, counted per generated variant rather than per source line.

### Batch 1 — 11 merge_group runs sampled 2026-09-04

| Spec | Test | Seen | Symptom |
|---|---|---|---|
| `e2e/Pages/Lineage/LineageInteraction.spec.ts` | Verify node panel opens on click | 11/11 | `clickLineageNode` → `entity-header-display-name` never visible (15s). The topic node is not in the graph the `beforeEach` renders. |
| `e2e/Pages/ExplorePageRightPanel_KnowledgeCenter.spec.ts` | Should remove user owner for knowledgeCenter | 11/11 | `entity-summary-panel-container` → owner chip not found (10s). Regressed around #31853, which removed the welcome-banner dismiss helpers. |
| `e2e/Features/PersonaAIContextRules.spec.ts` | knowledge entity type forces Fully rendered on and disables it | 7/11 | Test timeout. |
| `e2e/Features/Table.spec.ts` | should persist page size | 6/11 | Test timeout after `waitForAllLoadersToDisappear`. |
| `e2e/Pages/TestSuiteDetailsPage.spec.ts` | Add test case modal — filters and select | 3/11 | `waitForResponse` on the test-case search never resolves. |
| `e2e/Features/Glossary/GlossaryHierarchy.spec.ts` | should move term to root of different glossary | 2/11 | Drag-and-drop. |
| `e2e/Features/DataQuality/TableLevelTests.spec.ts` | Table Difference | 2/11 | |
| `e2e/Features/ActivityStream.spec.ts` | activity stream API is called when visiting entity page | 2/11 | |

### Batch 2 — 56 merge_group runs over 24 h, 2026-09-09

From the merge-queue ejection analysis in #ci-cleanup: 352 flaky occurrences
across 202 distinct tests, of which these were the ones that actually ejected
PRs from the queue. `Seen` is ejections attributed to the test, not flake count.

| Spec | Test | Seen | Symptom |
|---|---|---|---|
| `e2e/Features/SampleDataDomainDataProduct.spec.ts` | Verify TestDomain exists from sample data ingestion | 37 | **Not a flake — see below.** |
| `e2e/Features/SampleDataDomainDataProduct.spec.ts` | Verify TestDataProduct exists under TestDomain | 37 | **Not a flake — see below.** |
| `e2e/Features/SampleDataDomainDataProduct.spec.ts` | Verify TestDataProduct shows correct details and domain association | 37 | **Not a flake — see below.** |
| `e2e/Features/DataQuality/TestLibrary.spec.ts` | should handle supported services field correctly | 5 | |
| `e2e/Features/Glossary/GlossaryAdvancedOperations.spec.ts` | should create term with custom style color | 5 | |
| `e2e/Features/Glossary/GlossaryAdvancedOperations.spec.ts` | should update term style to set color | 5 | |
| `e2e/Pages/Tag.spec.ts` | Add and Remove Assets for Data Steward | 3 | |

The three `SampleDataDomainDataProduct` tests fail **together** and account for
~41% of all queue ejections, but they are not flaky — they assert that the
`TestDomain` / `TestDataProduct` fixtures exist, so they fail whenever
sample-data ingestion is missing or broken in the environment. Quarantine here
buys merge-queue time and nothing else; it does **not** make the underlying
ingestion problem go away, and these three should come out as soon as that is
fixed rather than being treated as flakes to re-time.

### Batch 3 — the same 56 merge_group runs, flake (not ejection) data

Batches 1 and 2 are tests that **ejected PRs**. Batch 3 is the other list from
that analysis: 352 flaky occurrences over 202 distinct tests, **all of which
passed on retry** — no run in the sample concluded anything but `success`. They
cost the queue retry time, not merged PRs.

58 entries flaked in **2 or more** of the 56 runs; **11 were fixed by #33060
before this landed** and never needed quarantining, leaving **47** in
[`quarantine-list.ts`](./quarantine-list.ts) with their run counts. The other
144 flaked exactly once and are deliberately left in, for the reason this file
has always given: one observation is not evidence.

The two heaviest entries in the batch — `TasksUIFlow` at 33/56 and 19/56 runs,
together ~15% of every flake occurrence in the window — were **not flakes**, and
#33060 confirmed it: a click that landed during the feed re-render was dropped,
so the task detail panel never mounted. That is the outcome this file wants.
Quarantine buys queue time; it never diagnoses anything.

`PLAYWRIGHT_RUN_QUARANTINED=true` selects these 85 plus the 7 setup/teardown
fixture projects (69 in total), which the soak lane deliberately leaves
unfiltered so login and entity seeding still happen — a project-level `grep`
*is* applied to dependency projects, so filtering them would make every
quarantined test fail for want of `admin.json` instead of for its flake.

After changing the tags or the list, re-list both lanes and update the counts
here. With the discover step's own environment —
`PW_DEDICATED_INGESTION=true PW_DEDICATED_IMPORT_EXPORT=true
PLAYWRIGHT_IS_OSS=true` (that last one gates the whole
`WorkflowOssRestrictions` describe, so without it two entries look dead) and no
`--project` filter — `npx playwright test --list` reports **4601** tests and
`GITHUB_EVENT_NAME=merge_group npx playwright test --list` reports **4539** —
the 62 above. The difference is the check that the tag is wired up; the absolute
numbers drift with every new spec.

## Not quarantined — fixed instead

These were failing their first attempt in ~every run and are root-caused, so
they were repaired rather than parked:

| Spec | Root cause |
|---|---|
| `e2e/Pages/Glossary.spec.ts` 128 / 198 / 421 | `utils/glossary.ts` used `page.textContent()` — waits for the element, not its text — so a cold first attempt read `""`. #32333 (a revert of #30896) had reintroduced this after it was already fixed. Restored to `toContainText`. |
| `e2e/Features/ContextCenterArticles.spec.ts:670` | #32283 removed a `waitForTimeout(500)` that was covering the zustand → localStorage flush of `recentlyViewed`. Navigating away before the flush meant the Recently Viewed panel had no entry to render, so the trailing assertion had nothing to auto-wait for. Replaced with `waitForRecentlyViewed`, which polls the persisted store. |
| `e2e/Features/ClassificationImportExport.spec.ts:64` | `beforeAll` POSTed fixtures whose names were generated at module scope, so a second pass in the same worker 409'd on every create. Fixtures are now rebuilt inside `beforeAll`, and an `afterAll` was added — the spec previously leaked two classifications, a tag and a user into the shard on every run. |

### Released from quarantine

**#33060 — root-caused and fixed before this branch merged (12 tagged tests + 11
list entries).** Karan's fixes landed on `main` while this was in review, so the
entries came straight back out rather than being carried in. Each is a real race,
not a timeout bump:

| Spec | Test(s) | Root cause fixed in #33060 |
|---|---|---|
| `Pages/TasksUIFlow.spec.ts` | resolve description (Pipeline), reject tag (Dashboard) | `openFirstTaskCard` clicked the task card but never confirmed the detail panel mounted; a click dropped during the feed re-render left `selectedTask` unset. Now retries under `toPass` until `task-tab` is visible. |
| `Pages/ExplorePageRightPanel.spec.ts` | deleted **user** (all 10 entity variants), deleted **tag** (container, dashboardDataModel, mlmodel), deleted **glossary term** (dashboardDataModel, searchIndex) | The deleted-entity verify helpers asserted absence with a page-wide `getByTitle`, which also matched the entity's still-assigned chip on the panel. Scoped to `selectOwnerTabs` / `selectableList`. |
| `e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts` | both "assets are removed" tests | The asset count is fetched once per page load with no refetch, so the assertion polled a frozen stale DOM. Gated on the counts aggregation via `waitForDomainAssetCount`, and `test.slow()` restored. |
| `Features/GlobalPageSize.spec.ts` | Page size should persist across different pages | `waitForAllLoadersToDisappear` passed in the frame before the Explore search loader mounted. Hoisted `search/query` waiters keyed on the exact size param. |
| `Features/PersonaAIContext.spec.ts` | View in Explore link href reflects the selected entity type | react-aria closed the entity-type listbox mid-click and detached the option. Now `selectOptionWithRetry`. |
| `Features/PersonaAIContextRules.spec.ts` | changing entity type clears an incomplete filter and unblocks save | Same react-aria listbox race. |
| `Flow/CustomizeWidgets.spec.ts` | KPI Widget | Two point-in-time `isVisible()` reads before the debounced `ResponsiveContainer` painted. Replaced with a web-first `expect(chart.or(empty))`. |

Deliberately **not** released, because #33060 did not touch them: `Flow/CustomizeWidgets.spec.ts › Data Assets Widget` (a different test in the same spec), `ExplorePageRightPanel › Overview panel CRUD and Removal operations › … for dashboard` (a different describe from the deleted-entity helpers), and `ExplorePageRightPanel_KnowledgeCenter › Should remove user owner` (a different spec and a different symptom).

Diagnosed and fixed, so the tag came off. If any of these flakes again the fix
was wrong — re-quarantine it with the new evidence rather than restoring the old
entry.

| Spec | Test | Root cause |
|---|---|---|
| `e2e/Pages/EntityDataConsumer.spec.ts` | Update description (Table) | `updateDescription` resolved the editor with a page-global `descriptionBox` and `.first()`, so with the edit modal open it targeted the inline editor *behind* the overlay — visible, so the assertion passed, then the click failed on `ant-modal-wrap ... intercepts pointer events` until the test timed out. Now scoped to the dialog, asserting a single match. |
| `e2e/Features/DataQuality/TestLibrary.spec.ts` | should create, edit, and delete a test definition | `TestDefinitionFormBody` rebuilt `options: toOptions(Object.values(…))` on every render. Focusing a field re-renders it via `onActiveFieldChange`, and the new `items` identity made react-aria rebuild the listbox collection, detaching the option mid-click. The option lists are enum-derived and now built once at module scope. |
| `e2e/Features/DataQuality/TestLibrary.spec.ts` | should maintain page on edit and reset to first page on delete | Same select-option path as above. |
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
on new entries. That closes the hole these came through; quarantine only stops
them costing merge-queue time today.
