# Burn-down batch 1: 54 single-violation files

Scope: the 54 files that had exactly one `om-playwright/no-positional-locator`
suppression. Only `.first()` sites were in scope for this batch; `.last()`/`.nth()`
sites were deferred.

Result: **34 deleted, 2 scoped, 14 needs-judgement, 4 deferred.**

All line numbers below are the **original** line before editing.

## Fixed — `.first()` deleted

Deleted outright because the underlying locator resolves to exactly one element
in the context it's used (verified by reading the rendering component and/or the
test's fixture setup), so the position was defensive, not load-bearing.

| File | Original line | Why deletion preserves the element |
|---|---|---|
| `playwright/e2e/Pages/DomainDataProductsRightPanel.spec.ts` | 99: `rightPanel.getSummaryPanel().getByTestId('entity-link').first()` | `entity-link` comes from `EntityTitleSection`, rendered exactly once per `EntitySummaryPanel` (mutually-exclusive switch/if branches on `activeTab`/`isSideDrawer`). |
| `playwright/e2e/Pages/GlossaryTermRightPanel.spec.ts` | 156: same pattern | Same `EntityTitleSection` singleton. |
| `playwright/e2e/Pages/TagPageRightPanel.spec.ts` | 148: same pattern | Same `EntityTitleSection` singleton. |
| `playwright/e2e/Pages/TeamAssetsRightPanel.spec.ts` | 146: same pattern | Same `EntityTitleSection` singleton. |
| `playwright/e2e/Features/Tasks/TeamActivity.spec.ts` | 438: `page.locator('[data-testid="task-feed-card"]').first()` | `beforeAll` creates exactly one table and one task assigned to the team; the table's own Tasks tab shows only that task. |
| `playwright/e2e/Pages/TaskComments.spec.ts` | 531: `.locator('[data-testid="task-feed-card"], .task-feed-card-v1-new').first()` | Test creates exactly one task via API; the comma-selector is an OR between two mutually-exclusive UI-version class names, not a list disambiguator. |
| `playwright/utils/reviewerWorkflow.utils.ts` | 314: `dataConsumerPage.getByTestId('task-feed-card').first()` | Sole caller (`ArticleReviewerWorkflow.spec.ts`) creates exactly one article and one reviewer task. |
| `playwright/e2e/Features/Glossary/GlossaryMiscOperations.spec.ts` | 159: `page.getByTestId('rename-button').first()` | Single "Rename" action inside an already-opened manage dropdown menu. |
| `playwright/e2e/Features/KnowledgeCenterTextEditor.common.ts` | 127: `blockquoteWithText.first()` | Already filtered to the one blockquote containing the just-typed text. |
| `playwright/e2e/Features/ServiceAgentsLiveProgress.spec.ts` | 159: `agentCard.getByTestId('agent-run-dot').first()` | `beforeAll` comment: "Seed **one** finished run" — exactly one run-dot exists at this assertion point. |
| `playwright/e2e/Features/StorageMetadataAgentForm.spec.ts` | 41: `page.getByTestId('more-actions').first()` | `beforeAll` creates exactly one ingestion pipeline for a freshly-created service. |
| `playwright/e2e/Features/Workflows/NoOpWorkflowNodeConfig.spec.ts` | 104: `.locator('.react-flow__node').filter({ hasText: 'Run App' }).first()` | Already filtered by the unique node label; the workflow fixture defines exactly one `runAppTask` node named "Run App". |
| `playwright/e2e/Features/SSOTestLogin.spec.ts` | 35: `page.getByRole('radio', { name: /public/i }).first()` | Form has "Public"/"Confidential" radios; only "Public" matches `/public/i`. |
| `playwright/e2e/Features/SchemaDefinition.spec.ts` | 42: `.locator('.CodeMirror-line > [role="presentation"]').first()` | Proven singleton: the very next assertion (already in the file, unmodified) uses the **same** locator without `.first()` and asserts `toContainText` — that only works under Playwright strict mode if the locator already resolves to one element. |
| `playwright/e2e/Features/RTL.spec.ts` | 63: `...filter({ hasText: serviceType }).first()` | Already filtered to the one Explore-tree node whose label matches the exact (lowercased) service type just clicked. |
| `playwright/e2e/Features/RestoreEntityInheritedFields.spec.ts` | 376: `page.getByTestId('breadcrumb').getByRole('link').first()` | Inline comment in the file documents that for these entity types "every other entity uses the service crumb (the first crumb, which always stays inline)" — intermediate crumbs collapse into a non-link overflow menu, so exactly one `role=link` remains. |
| `playwright/e2e/Features/OntologyImportRdf.spec.ts` | 97: `page.getByText('Healthcare Provider').first()` | Newly-imported, uniquely-named glossary concept; single tree-node label match. |
| `playwright/e2e/Flow/CustomizeLandingPage.spec.ts` | 142: `adminPage.locator('[data-testid="loader"]').first()` | `AddWidgetModal.tsx` has a single conditional `return <Loader />;` for the whole modal body — not a per-item loader. |
| `playwright/e2e/Flow/IngestionBot.spec.ts` | 168: `ingestionBotPage.getByTestId('domain-link').first()` | Only one domain (`domain1`) is ever assigned to the service in this test (`addServicesToDomain` called once); services carry a single `domain` field. |
| `playwright/e2e/Flow/ObservabilityAlerts.spec.ts` | 375: `.getByTestId('alert-bar').filter({ hasText: 'Search failed' }).first()` | Already filtered to the specific alert text; alert banners are singleton per page. |
| `playwright/e2e/PageObject/Explore/RightPanelPageObject.ts` | 781: `getTabLocator()` — `...filter({ hasText: pattern }).first()` | Already scoped by the caller-supplied `tabName` (an owned identifier, converted to a regex match) — this is exactly the `.filter({ hasText })` pattern the rule recommends; the `.first()` was redundant on top of it. |
| `playwright/e2e/Pages/ServiceListing.spec.ts` | 187: `page.getByRole('cell', { name: serviceDisplayName }).first()` | `serviceDisplayName` is a uuid-suffixed, test-owned unique name. |
| `playwright/e2e/Pages/TaskFormSettings.spec.ts` | 38: `...filter({ hasText: option }).first()` | Already filtered by the caller-supplied `option` value passed into the reusable `selectAntOption` helper. |
| `playwright/e2e/Pages/Teams.spec.ts` | 881: `page.getByRole('switch').first()` | `TeamHierarchy.tsx` renders exactly one `<Switch>` ("Show Deleted"); no other `role=switch` control exists on the page. |
| `playwright/support/team/TeamClass.ts` | 85: `page.getByRole('link', { name: expectedDisplayName }).first()` | `expectedDisplayName` is a uuid-suffixed, test-owned unique team name; `searchTeam` already narrowed the results before this. |
| `playwright/utils/activityAPI.ts` | 66: `getActivityFeedItems(page).filter({ hasText: text }).first()` | `getFeedItemByText(page, text)` is explicitly a "find by content" helper — the `.filter({ hasText })` scoping (the pattern the rule recommends) is already the mechanism; `.first()` was redundant on top of it. |
| `playwright/utils/customMetric.ts` | 84: `page.locator(...).first()` | The ternary selects one of two mutually-exclusive single-instance container testids (column vs. table profiler view) — not a list. |
| `playwright/utils/dataContracts.ts` | 224: `suiteNameCell.locator('a').first()` | `suiteNameCell` is already scoped to one row via `getByRole('rowheader', { name: <exact contract name> })`; a single anchor lives inside that cell. |
| `playwright/utils/explore.ts` | 276: `...filter({ hasText: columnName }).filter({ hasText: tableName }).first()` | Already double-filtered by the two test-owned identifiers (column name + table name). |
| `playwright/utils/headerBreadcrumbUtils.ts` | 52: `inlineCrumb.first()` (`breadcrumb.getByText(name)`) | Already scoped by the caller-supplied `name`; `getByText` resolves to the innermost matching node, not every ancestor containing the substring. |
| `playwright/utils/permission.ts` | 143: `editDisplayNameButton.first()` | Single entity-header edit button; confirmed by the `else` branch a few lines down, which already asserts the **same** locator with `toHaveCount(0)` and no `.first()`. |
| `playwright/utils/searchRBAC.ts` | 67: `resultCard.first()` | Already scoped via `{ hasText: displayName }`, a test-owned unique entity display name. |
| `playwright/e2e/Features/ExploreQuickFilters.spec.ts` | 532: `highlightedSpan.first()` | Already scoped to one specific entity card's display-name header; the search term equals the full (uuid-suffixed) entity name, so it highlights as a single span. |
| `playwright/e2e/Features/GlobalPageSize.spec.ts` | 52: `rowsPerPageDropdown.locator('p').first()` | `rows-per-page-dropdown` is a closed `Select` trigger (`ui-core-components/pagination.tsx`); its option list only mounts in a portal on open, so the closed trigger contains exactly one `<p>`. |

## Scoped (locator narrowed instead of deleted)

| File | Original line | New locator | Why this identifies the intended element |
|---|---|---|---|
| `playwright/utils/bot.ts` | 177: `page.locator('[data-testid="breadcrumb-link"]').first().click()` | `.filter({ hasText: 'Bots' })` | `TitleBreadcrumb.component.tsx` stamps `data-testid="breadcrumb-link"` on **every** `<li>`, including the non-link current-page crumb — confirmed 2 elements exist (`Bots`, bot name). `.first()` happened to land on "Bots" only because it's index 0; filtering by the static, hardcoded root-crumb text "Bots" targets the same element deterministically instead of by position. |
| `playwright/utils/tag.ts` | 324: `page.locator('.ant-select-dropdown').first().waitFor({ state: 'detached' })` | `.ant-select-dropdown:visible` (no `.first()`) | Ant Design leaves closed dropdown portals mounted in the DOM (hidden, not removed), so multiple `.ant-select-dropdown` nodes can coexist. `:visible` scopes to the currently-open overlay — the one this code just interacted with — matching the same `:visible` pattern already used elsewhere in the suite (`ObservabilityAlerts.spec.ts`). |

## NEEDS-JUDGEMENT

Left untouched. In each case the locator plausibly/provably matches multiple
elements simultaneously, and either (a) there's no test-owned identifier to
scope by, or (b) the check is genuinely "does at least one of several exist" —
not "get the one specific element" — so deleting `.first()` wouldn't preserve
intent, it would just replace one incorrect selection with a guaranteed
`strict mode violation`, which is not the same as fixing it.

| File | Line | Why |
|---|---|---|
| `playwright/e2e/Features/Container.spec.ts` | 267: `page.getByTestId('copy-column-link-button').first()` | Container fixture has ≥3 columns (confirmed in `ContainerClass.ts`), each with its own copy-link button. The test doesn't care which column (generic URL-format check), so there's no owned identifier for "the" intended column — `.first()` is arbitrary by design. |
| `playwright/e2e/Features/DataProductRename.spec.ts` | 136: `page.getByTestId('entity-header-display-name').first()` | The original author explicitly left the comment "use first() as there may be multiple elements" — a known, deliberate multiplicity call I could not independently disprove within reasonable effort (the testid is also used by `LineageNodeLabelV1`). |
| `playwright/e2e/Features/DataQuality/TestCaseImportExportBasic.spec.ts` | 261: `page.getByText(/INVALID_HEADER/i).first()` | The invalid-header CSV fixture is missing/malforms 3 required columns (`name*`, `testDefinition*`, `entityFQN*`), so up to 3 separate `INVALID_HEADER` errors can render. Test only checks "an error is shown," not which one. |
| `playwright/e2e/Features/LineageExportPNGSnapshot.spec.ts` | 51: `.locator('.react-flow__node').first().waitFor({ state: 'visible' })` | Fixed entity with "known downstream lineage" — multiple nodes render together. Playwright's strict mode throws the instant 2+ elements match `waitForSelector`, **even for non-`visible` target states**, so this isn't a "loud failure is fine" case — it's a guaranteed break with no way to pick "the" node. |
| `playwright/e2e/Flow/MetricListSearch.spec.ts` | 103: `page.getByTestId('metric-name').first()` | Existence check before filtering ("results exist"); the very next line does `.count()` on the same unscoped locator, confirming the author expected N>1 matches. No owned identifier for "the" metric. |
| `playwright/e2e/PageObject/Explore/OverviewPageObject.ts` | 147: `...locator('[data-testid="select-owner-tabs"] [role="tab"]').first()` | The Users/Teams tab bar renders both tab headers simultaneously — genuine 2-element match, used only as an existence check (is the tab control visible), not to select a specific tab. |
| `playwright/e2e/PageObject/Explore/SchemaPageObject.ts` | 41: `schemaFieldsContainer.getByTestId('expand-icon').first()` | `schemaFields` in the same file confirms one `.field-card` (and expand icon) per schema field — genuinely a list. `shouldShowExpandButton()` is a generic, multi-call-site existence assertion with no owned field name to scope to. |
| `playwright/e2e/Pages/DataMarketplaceAnnouncements.spec.ts` | 85: `page.getByTestId(/^announcement-item-/).first()` | `beforeAll` deliberately creates **two** announcements (domain + data product). This is an existence check before the code branches to a specific, differently-scoped `domainItem` locator further down — not a "pick element N" case. |
| `playwright/e2e/Pages/TestSuiteDetailsPage.spec.ts` | 158: `dialog.locator('[data-testid^="checkbox-"]').first()` | Test step is literally "Select all then unselect all test cases in modal" — it deliberately picks *any* one checkbox as a representative sample to prove select-all/unselect-all propagates; there is no specific "intended" test case. |
| `playwright/e2e/VersionPages/EntityVersionPages.spec.ts` | 384: `.locator('[data-testid^="version-entry-"]').first()` | Comment in the file explains this directly: "Soft-delete is UI-only — no patch response to read the version from, so match any version URL and select the first (latest) panel entry." The author already documented that the exact version number is unobtainable here — "first" encodes real ordering semantics ("latest"), not laziness, and I have no substitute identifier. |
| `playwright/utils/auditLogs.ts` | 23: `page.locator('.ant-skeleton').first().waitFor({ state: 'detached' })` | `AuditLogList.component.tsx` renders 6 simultaneous `.ant-skeleton` nodes (1 header + `[1,2,3,4,5].map(...)` row skeletons) while loading. Verified against Playwright's `waitForSelector` source: strict mode throws as soon as 2+ elements resolve, for **any** target state including `detached` — so this is a guaranteed break, not an occasional one, with no owned identifier to scope by. |
| `playwright/utils/rightPanelNavigation.ts` | 40: `card.first().isVisible().catch(() => false)` | Generic polling helper (`cardTestId` is caller-supplied and can genuinely multi-match). Removing `.first()` risks `isVisible()` throwing a strict-mode error that the adjacent `.catch(() => false)` would silently swallow, converting "not visible yet" into a permanent false — a real behavior regression, not just a louder failure. |
| `playwright/utils/searchSettingUtils.ts` | 118: `page.getByTestId('field-container-header').first()` | Multiple field-configuration rows exist once the "Matching Fields" panel expands (confirmed by `FieldConfiguration.tsx`); used purely to detect "is the panel open," not to target a specific field. |
| `playwright/utils/widgetFilters.ts` | 297: `widget.getByTestId('task-feed-card').first()` | Generic, reusable `verifyTaskFilters()` helper; its one caller creates exactly one task, but the function is widget-content-existence-scoped, not entity-scoped, with no parameter to filter by. Changing its signature to accept a task name would be a restructuring beyond this batch's scope. |

## DEFERRED (`.last()` / `.nth()` — out of scope for this batch)

| File | Line | Method |
|---|---|---|
| `playwright/e2e/Features/AdvancedSearchSuggestions.spec.ts` | 57 | `page.locator('.rule').nth(0)` |
| `playwright/e2e/Features/MetricCustomUnitFlow.spec.ts` | 123 | `page.locator("pre[role='presentation']").last()` |
| `playwright/e2e/Features/PersonaAIContext.spec.ts` | 517 | `adminPage.getByTestId('delete-condition-button').last()` |
| `playwright/utils/service.ts` | 56 | `page.getByRole('tab').nth(1)` |

## Verification

- `yarn lint:playwright:full` (pre-prune): 0 errors, 186 pre-existing warnings, exit non-zero only because of the expected "suppressions to prune" notice.
- `yarn lint:playwright:suppressions`: exit 0, 0 errors, 186 pre-existing warnings.
- `yarn test:eslint-rules`: 7/7 pass.
- `yarn tsc:playwright`: 163 errors both before and after this change — confirmed via `git stash`/`git stash pop` that the sorted error list is **byte-identical** before and after (`diff` empty). 5 of the touched files (`RestoreEntityInheritedFields.spec.ts`, `TeamActivity.spec.ts`, `IngestionBot.spec.ts`, `TaskComments.spec.ts`, `tag.ts`) already carried pre-existing, unrelated TS errors at different lines than the ones edited here; no new or shifted error was introduced by this batch.
- Suppression total: 1446 → 1410, a drop of exactly 36 (34 deletions + 2 scoped rewrites), matching the fix count.
- `git status --porcelain`: 37 files changed — the 36 edited source files plus `eslint-suppressions.json`. (Corrected from an earlier "36 files changed" — see Fix round 1 below.)

---

## Fix round 1

Review found 5 wrong conversions and a missed rewrite pattern (count-based
assertions) that unlocked most of the parked sites. All fixes below were
independently re-verified against the rendering source before applying —
not just patched to match the reviewer's suggested snippet.

### Part A — 5 wrong conversions, fixed

| File | Original wrong fix | Root cause | Correct fix |
|---|---|---|---|
| `playwright/e2e/Features/RTL.spec.ts:63` | `.locator('span').filter({ hasText: serviceType })` | `filter({ hasText })` matches **ancestors** too — `ExploreTree.tsx` nests `.ant-tree-node-content-wrapper` ⊃ `.ant-tree-title` ⊃ `.ant-typography`, all containing the text, so this matches 3 elements and the removed `.first()` was load-bearing (it picked the outer span, the only one carrying `ant-tree-node-selected`). | `.locator('.ant-tree-node-content-wrapper').filter({ has: page.getByTestId(`explore-tree-title-${serviceType}`) })` — scopes by the node's own testid (`ExploreTree.tsx:96`, `dataId: bucket.key`) via `has`, not `hasText`, so it can't ancestor-match. |
| `playwright/utils/permission.ts:143` | `expect(editDisplayNameButton).toBeVisible()` | `edit-displayName-button` renders once per column row (`SchemaTable.component.tsx:735`); the Table fixture (`Permission.spec.ts`) has ≥4 columns → ≥4 matches. The `else` branch's `toHaveCount(0)` proves nothing about the positive case (0 of N vs N of N). | `expect(editDisplayNameButton).not.toHaveCount(0, { timeout: 30_000 })` — `validateViewPermissions` is a generic policy check with no owned column, so "at least one edit button renders" is the actual intent. |
| `playwright/e2e/Flow/IngestionBot.spec.ts:167` | `expect(page.getByTestId('domain-link'))` | This assertion runs on the **service details page**. `ServiceMainTabContentUtils.tsx` puts `domainTableObject()` in the child-asset table columns, so there's a `domain-link` per child row *plus* the header one — confirmed `DataAssetsHeader.component.tsx:909` renders one via `DomainLabel`/`renderDomainLink`, and the child table renders one per row. | Scoped to `ingestionBotPage.getByTestId('data-assets-header').getByTestId('domain-link')` — the service only has one domain (single `addServicesToDomain` call), so within the header container this resolves to exactly one. |
| `playwright/utils/tag.ts:324` | `.locator('.ant-select-dropdown:visible').waitFor({ state: 'detached' })` | `:visible` swaps "removed from DOM" for "nothing visible," reintroducing a strict-mode hazard if two overlays are visible mid-transition, and doesn't match the original's "resolves at zero matches" semantics. | `await expect(page.locator('.ant-select-dropdown')).toHaveCount(0);` — byte-for-byte the old wait-for-detached semantics, no position, no visibility hazard. |
| `playwright/e2e/Features/ExploreQuickFilters.spec.ts:531` | `expect(highlightedSpan).toBeVisible()` | Backwards: the search term is the *entire* uuid-suffixed entity name, so the ES highlighter wraps each matched token in its own span — matching the full name **maximizes**, not minimizes, the span count. The real intent is "some highlighting occurred." | `await expect(highlightedSpan).not.toHaveCount(0);` |

### Part B — count-based rewrite, unparked 13 of 14 sites

The missed pattern: `expect(locator).not.toHaveCount(0)` / `toHaveCount(0)` /
`await locator.count()` need no single element, so they carry no strict-mode
risk and no position — they were the correct fix for every "does at least
one exist" site, which was most of what got parked in batch 1.

| File | Conversion | Note |
|---|---|---|
| `playwright/utils/auditLogs.ts:23` | `await expect(page.locator('.ant-skeleton')).toHaveCount(0);` | Identical semantics to the old `.first().waitFor({ detached })`, which already only resolved at zero matches — now correct even though 6 skeleton nodes render simultaneously. |
| `playwright/utils/rightPanelNavigation.ts:40` | `count > 0 && (await card.filter({ visible: true }).count().catch(() => 0)) > 0` | Reuses the `count` already computed one line above; avoids the original risk of `isVisible()` throwing on strict-mode violation and having `.catch(() => false)` silently swallow it. |
| `playwright/utils/searchSettingUtils.ts:118` | `(await fieldHeaders.filter({ visible: true }).count().catch(() => 0)) > 0`, and the matching `waitFor({ visible })` at the end of the function converted to `expect(fieldHeaders).not.toHaveCount(0)` | Both call sites on the same (now-unscoped) `fieldHeaders` locator converted together. |
| `playwright/e2e/Flow/MetricListSearch.spec.ts:103` | `await expect(page.getByTestId('metric-name')).not.toHaveCount(0);` | The very next line already calls `.count()` on the same unscoped locator. |
| `playwright/e2e/PageObject/Explore/OverviewPageObject.ts:147` | Field left unscoped; all 3 call sites (`waitFor({visible})` ×2, `expect().toBeVisible()` ×1) converted to `expect(this.selectOwnerTabsRoleTab).not.toHaveCount(0)` | Users/Teams tabs render together — existence check only, never a specific-tab target. |
| `playwright/e2e/PageObject/Explore/SchemaPageObject.ts:41` | Field left unscoped; `shouldShowExpandButton()` converted to `not.toHaveCount(0)` | One expand icon per nested field card; the assertion never targeted a specific field. |
| `playwright/e2e/Pages/DataMarketplaceAnnouncements.spec.ts:85` | `await expect(page.getByTestId(/^announcement-item-/)).not.toHaveCount(0);` | `beforeAll` deliberately creates 2 announcements; the code branches to specifically-scoped `domainItem`/`dpItem` locators right after — this line is purely "did the list render." |
| `playwright/utils/widgetFilters.ts:297` | `await expect(widget.getByTestId('task-feed-card')).not.toHaveCount(0);` | Generic, multi-caller existence check on a widget's task list. |
| `playwright/e2e/Features/DataQuality/TestCaseImportExportBasic.spec.ts:261` | `await expect(page.getByText(/INVALID_HEADER/i)).not.toHaveCount(0, { timeout: 30000 });` | The invalid CSV fixture is missing/malforms 3 required headers, so up to 3 error messages can render; kept as a count check rather than guessing which exact message text to scope to. |
| `playwright/e2e/Features/Container.spec.ts:267` | `getRowByName(page, firstColumnName).getByTestId('copy-column-link-button')`, where `firstColumnName = container.entity.dataModel.columns[0].name` | Owned-identifier fix, not a count fix: the container fixture has ≥3 columns; scoping by the fixture's own first column name (array index 0, which the pre-existing follow-up assertion at the same test already trusted to match the clicked row) replaces the position with a name. Renamed to `firstColumnName` to avoid a `columnName` redeclaration further down the same test (caught by `tsc`). |
| `playwright/e2e/Features/LineageExportPNGSnapshot.spec.ts:51` | `page.getByTestId(\`lineage-node-${ROOT_ENTITY_FQN}\`).waitFor({ state: 'visible' })` | Reassessed per the coordinator's hint: `CustomNodeV1.component.tsx:345` renders `data-testid="lineage-node-${fullyQualifiedName}"`, and the test already hardcodes the root entity's FQN in `LINEAGE_URL` — an owned identifier was available after all. |
| `playwright/e2e/Features/DataProductRename.spec.ts:136` | `expect(page.getByTestId('entity-header-display-name')).toHaveText(newName)` | Reassessed: `EntityHeader`/`EntityHeaderTitle` renders this testid exactly once on this page (traced `EntityTitleSection`/`EntityHeader` call sites), and the test already owns `newName` (the just-set uuid-suffixed name) — scoping by asserting its text is both non-positional and a stronger check (confirms the rename actually took effect, not just "a header exists"). |

`playwright/e2e/VersionPages/EntityVersionPages.spec.ts:384` is the one
genuine ordinal case, left parked but now explicitly justified rather than
silently suppressed via `eslint-suppressions.json`:

```ts
// Soft-delete has no patch response to read the exact version number
// from (see comment above), so "latest" is expressed via DOM order —
// a genuine ordinal, not a defensive position pick.
// eslint-disable-next-line om-playwright/no-positional-locator -- version panel entries are rendered newest-first with no other way to identify "latest" here
```

`playwright/e2e/Pages/TestSuiteDetailsPage.spec.ts:158` remains parked,
untouched — it needs a single concrete element for `toBeChecked()`/
`not.toBeChecked()` state assertions, which a count check cannot express,
and the test deliberately doesn't care which test case it picks.

### Part C — cleanup

- Deleted the dead `verifyColumnSuggestion` function from `playwright/utils/explore.ts` (no callers anywhere in `playwright/`; neither `[data-testid="suggestion-box"]` nor `.suggestion-item` exists in `src/`).

### Fix round 1 — verification

- `yarn lint:playwright:full`: 0 errors, 186 pre-existing warnings (unchanged from batch 1).
- `yarn test:eslint-rules`: 7/7 pass.
- `yarn tsc:playwright`: 163 errors. First pass showed **165** — a real regression from the `Container.spec.ts` fix (`firstColumnName` collided with a pre-existing `columnName` declared later in the same test, `TS2451`); fixed by renaming, then reconfirmed **163** with a byte-identical `diff` against the pre-batch-1 baseline (one cosmetic union-member-order difference in an untouched file, `ConditionalPermissions.spec.ts`, not a real change).
- No `.first()`/`.last()`/`.nth()` reintroduced (grepped and eslint-confirmed 0 `om-playwright/no-positional-locator` hits across all 19 files touched this round); the only `eslint-disable` added is the justified one in `EntityVersionPages.spec.ts`.
- Suppression total: 1410 → 1397, a drop of exactly 13, matching the 13 sites unparked in Part B (the dead-code deletion in Part C removed no suppression entry — its violation was already fixed, and pruned, in batch 1).
- `git status --porcelain`: clean after commit — 19 files changed (18 from Parts A/B + `explore.ts` from Part C) plus `eslint-suppressions.json`.
