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

9 tests. Evidence is failures observed across 11 merge_group runs sampled on
2026-09-04; the threshold for quarantining is **2 or more**, counted per
generated variant rather than per source line.

| Spec | Test | Seen | Symptom |
|---|---|---|---|
| `e2e/Pages/Lineage/LineageInteraction.spec.ts` | Verify node panel opens on click | 11/11 | `clickLineageNode` → `entity-header-display-name` never visible (15s). The topic node is not in the graph the `beforeEach` renders. |
| `e2e/Pages/ExplorePageRightPanel_KnowledgeCenter.spec.ts` | Should remove user owner for knowledgeCenter | 11/11 | `entity-summary-panel-container` → owner chip not found (10s). Regressed around #31853, which removed the welcome-banner dismiss helpers. |
| `e2e/Features/PersonaAIContextRules.spec.ts` | knowledge entity type forces Fully rendered on and disables it | 7/11 | Test timeout. |
| `e2e/Pages/Domains.spec.ts` | Verify domain tags and glossary terms | 6/11 | Fails both attempts more often than it flakes — likely a real defect, not timing. |
| `e2e/Features/Table.spec.ts` | should persist page size | 6/11 | Test timeout after `waitForAllLoadersToDisappear`. |
| `e2e/Pages/TestSuiteDetailsPage.spec.ts` | Add test case modal — filters and select | 3/11 | `waitForResponse` on the test-case search never resolves. |
| `e2e/Features/Glossary/GlossaryHierarchy.spec.ts` | should move term to root of different glossary | 2/11 | Drag-and-drop. |
| `e2e/Features/DataQuality/TableLevelTests.spec.ts` | Table Difference | 2/11 | |
| `e2e/Features/ActivityStream.spec.ts` | activity stream API is called when visiting entity page | 2/11 | |

`PLAYWRIGHT_RUN_QUARANTINED=true` selects these 9 plus the 7 setup/teardown
fixture projects, which the soak lane deliberately leaves unfiltered so login and
entity seeding still happen — a project-level `grep` *is* applied to dependency
projects, so filtering them would make every quarantined test fail for want of
`admin.json` instead of for its flake.

Re-run `npx playwright test --list` after changing this file and update the
default-lane count here; it was 4543 of 4555 when the list held 13 entries.

## Not quarantined — fixed instead

These were failing their first attempt in ~every run and are root-caused, so
they were repaired rather than parked:

| Spec | Root cause |
|---|---|
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
