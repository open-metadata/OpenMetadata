# Should OpenMetadata move Playwright coverage into frontend tests?

Audited 10 September 2026 at commit `44823acde1c85ccc20d9f62c588169567fc28c90`. This follow-up classifies every frontend Playwright product-test definition in this checkout and maps the classification to an actual full merge-queue run at the same commit. It supplements the [overall Playwright and merge-queue audit](QUEUE-ANALYSIS.md).

## Decision

**Yes. This is a worthwhile route: 1,589 of 4,488 queue cases, or 35.4%, are strong candidates for frontend component/page integration tests.** Another **1,778 cases, or 39.6%, combine extractable UI checks with real backend behavior**. Those need splitting while preserving integration coverage. Together they form a **75.0% candidate pool for some frontend extraction; 75.0% is not the percentage of whole tests that can safely be deleted.**

Counting unique source definitions instead of expanded queue cases, **1,239 of 2,884, or 43.0%, are strong candidates**. The difference matters: several expensive mixed suites repeat the same code across many entities and roles.

The preferred destination is usually **a real React component or page integration test**, exercising real children, form logic, providers, routing and request construction against controlled HTTP responses. A large collection of shallow tests that mock the component's own behavior would lose coverage.

The strong candidates account for **23.2% of recorded test-worker duration** in the measured run. The opportunity is substantial, but removing 35.4% of queue cases would not make the queue 35.4% faster. Backend setup, shard scheduling, retained long journeys and replacement-test cost all matter.

## Complete inventory and how the review was performed

| Inventory | Count | Meaning |
|---|---:|---|
| Frontend Playwright `.spec.ts` files | 394 | All product spec files in the inventoried Playwright tree |
| Additional files defining product tests | 2 | Shared search-separation factory and production-bundle smoke |
| Unique source test definitions reviewed | 2,884 | Each inline test definition counted once, before entity/role loops expand |
| Definitions instantiated by the 394 spec files | 2,903 | Includes 22 factory instances in 11 specs; excludes standalone bundle smoke |
| Distinct planned product cases in the measured queue run | 4,488 | Parameterized and project-expanded cases, each counted once |
| Queue cases mapped to a reviewed definition | 4,488 / 4,488 | Exact source-location match using native Playwright JSON results |
| Owning spec files represented in that run | 365 | Some SSO, visual and other specialized suites use separate lanes |
| Unique definitions represented in that run | 2,747 | The source review also covers the remaining 137 definitions |

The source denominator needs care. There are 2,881 inline definitions inside the specs. Eleven specs instantiate two shared factory definitions each, producing 2,903 spec-instantiated definitions. Counting each factory definition once and adding the standalone bundle smoke instead produces 2,884 unique definitions. The strong numerator is 1,239 under either approach: **42.7% of spec-instantiated definitions**, or **43.0% of unique definitions**.

The runtime evidence is [queue run 34355232120][run], at the audited source commit. Its native results were collected across 37 shards. The 4,488 product cases comprise 4,483 expected outcomes, four cases rescued by retry and one skipped case. Two Data Insight lifecycle invocations in the reporter's 4,490 total are excluded. Retries contribute duration but do not add cases to the denominator.

I parsed every inventoried source file using the TypeScript AST, extracted each definition's title, enclosing suites/loops, actions, helper calls and assertions, and reviewed every definition at that level. Ambiguous cases were followed into full bodies, hooks, helpers and relevant application code. Examples include pagination, permissions, entity CRUD, right-panel validators, graph instrumentation, chart clicks, token helpers and contract import parsing. All 396 files parsed without diagnostics. All 2,884 definitions have a recorded classification; none remain unclassified.

This is an assertion-and-behavior audit, not a filename heuristic or a sampled percentage. It is also not a claim to have manually read every line of every transitive helper, proved every assertion correct, or implemented equivalent replacements. Classification remains engineering judgment about the appropriate testing boundary. Java Playwright UIITs, runner/reporting unit tests and authentication/setup lifecycle files are outside this frontend product-test denominator.

The full suite was **not rerun locally**. The percentages use reviewed source and existing hosted execution evidence, not a migration benchmark.

## Classification results

| Category | Unique definitions | Queue cases | Queue share | Recorded worker-time share |
|---|---:|---:|---:|---:|
| **U — Strong frontend component/page integration candidate** | **1,239** | **1,589** | **35.4%** | **23.2%** |
| **M — Mixed: extract UI checks, preserve backend integration** | **839** | **1,778** | **39.6%** | **41.9%** |
| B — Retain browser; potentially isolate from backend | 138 | 145 | 3.2% | 2.4% |
| A — Backend/API contract, outside UI component migration | 231 | 254 | 5.7% | 2.4% |
| E — Retain integrated journey during initial migration | 437 | 722 | 16.1% | 30.1% |
| **Total** | **2,884** | **4,488** | **100.0%** | **100.0%** |

Percentages are rounded. Category A includes API-only tests already using the Playwright runner and browser-driven tests whose primary assertions concern server contracts. It is not an exact count of tests that currently launch no browser. Category E is a conservative decision for the first frontend migration, not proof that every variant must remain an end-to-end test forever.

**What earns U:** the important assertion can still fail for a frontend regression when API responses are supplied at the HTTP boundary. Examples are required-field validation, permission-derived controls, URL construction, stale-request handling, tab/selection state, and rendering a supplied response. Creating entities through real APIs merely to prepare those states does not itself make the assertion end to end.

**What earns M:** replacing the server would remove a meaningful assertion about persistence, actual search results, permission propagation or another backend result. Move the UI matrix, but keep that contract under real integration coverage. CRUD helpers often fall here.

**What stays in B/E:** real browser geometry, pointer interactions, clipboard, screenshots, editor behavior, built-bundle loading, authentication/session renewal, ingestion/background processing, cross-user workflows, cascades and file round-trips. Some browser-specific tests could run against isolated fixtures without the full OpenMetadata stack.

## Where the strongest opportunities are

These are current cases classified U. Counts for a partially eligible file refer only to its U cases; they are not recommendations to remove the entire file. Durations are cumulative test-worker minutes in the representative run.

| Area | Strong queue candidates | Recorded worker minutes | Recommended replacement |
|---|---:|---:|---|
| Entity, service and data-quality permission suites, combined | 115 | 28.7 | Render real screens with allowed/denied permission responses; assert actions and route guards |
| `Pages/CustomProperties.spec.ts` | 88 | 17.0 | Real form validation, local property search, field and link rendering |
| `Pages/ExplorePageRightPanel.spec.ts` | 88 | 14.5 | Real panel, tabs, schema search, selection and permission state |
| U cases inside `Pages/Entity.spec.ts` | 48 | 14.0 | Shared entity UI affordances, labels, local schema state and navigation |
| `Flow/NestedChildrenUpdates.spec.ts` | 36 | 7.9 | Apply mutation responses to the real nested table and assert immediate updates |
| `Features/ColumnBulkOperations.spec.ts` | 25 | 7.7 | Grid rendering, selection, bulk-edit state and validation |
| `Features/Pagination.spec.ts` | 35 | 7.2 | Page-size/cursor requests, URL state, loading, navigation and search reset |

The per-file totals and every contributing case are available in [all-files.csv](evidence/all-files.csv) and the [complete definition inventory](evidence/all-definitions.csv.gz).

### 1. Custom properties: clear validation and rendering candidates

The suite contains **15 separate name-validation definitions**, covering invalid initial characters, punctuation, valid names and length. These are straightforward candidates for parameterized tests of the real form, with a small utility test matrix if validation is factored into a reusable function. Most do not need a real database, search index, login or browser. [Name validation][custom-validation]

Four further definitions repeat display, search, clear-search and property-name checks across 17 entity contexts: **68 queue cases**. Preserve the shared panel and real custom-property rendering; provide representative entity payloads and assert the visible result. Keep distinct serializers and genuinely different entity behavior represented rather than replacing the whole matrix with one generic fixture. [Property panel tests][custom-panel]

There is already evidence of the intended direction in this repository: `CustomPropertiesApiContract.spec.ts` explicitly covers **272 removed browser-matrix combinations**, across 16 entity types plus table columns and 16 value variants. It runs 17 API compatibility cases plus one matrix-shape assertion. That coverage is already outside the UI-candidate count; it must not be claimed again as future savings. [Existing API compatibility contract][custom-contract]

The remaining custom-property suite still has 81 mixed queue cases and four browser-dependent cases. Its real persistence, search and browser-specific behavior should remain covered while the UI-only parts move.

### 2. Permission matrices: separate presentation from enforcement

The entity/service permission helpers largely assert whether controls are visible or disabled. The data-quality suite includes analogous create/delete/edit affordances and page access. These can exercise the actual permission-to-UI logic with controlled permission responses. [Entity permission matrix][entity-permissions], [service permission matrix][service-permissions], [data-quality permission matrix][dq-permissions], [shared assertions][permission-helper]

A hidden button does not prove server authorization. Preserve real API tests that attempt forbidden operations and assert denial, plus representative browser journeys confirming that the signed-in identity receives and applies the correct permissions. The large presentation matrix and the backend enforcement matrix protect different failures.

### 3. Pagination, local state and asynchronous UI races

The shared pagination helpers exercise page/URL state, outgoing limits/cursors and resulting table display. The complete-flow helper's search checks do not establish that every returned item actually matches the search. This makes a real table/page integration with controlled HTTP pages a good destination; a service-level cursor and search contract should remain separate. [Pagination suite][pagination], [pagination helper][pagination-helper]

`SearchSettings.spec.ts` has a particularly strong example: **“Latest preview config wins when a superseded request resolves late.”** The Playwright test already intercepts and delays responses. The essential regression is frontend response ordering. A component/page test can deliver the old response after the new one and assert the current preview stays visible, using the real state and rendering logic. [Stale preview regression][search-race]

Nested-child update tests similarly protect an important UI regression: a successful edit should update the displayed nested row immediately without requiring refresh. These should remain strong behavior tests after migration; checking only that an API mock was called would miss the regression. [Nested updates][nested-updates]

### 4. Right panels: repeated UI, with some meaningful integration contracts

There are **126 strong queue candidates across seven files whose names contain `RightPanel`**, accounting for 20.4 worker-minutes. They cover tabs, entity links, empty states, schema filtering and role affordances in multiple page contexts. The shared components are a natural component/page integration boundary.

Keep representative host-page wiring checks: opening the correct entity from Explore, Glossary, Tag and Team contexts can expose different routing or selection bugs. Actual edits, deleted users disappearing from selectors, and search-index propagation remain mixed or integrated cases. In the main Explore panel file alone, 116 cases are mixed and 30 retain integrated coverage. [Explore panel tests][explore-panel]

One quality defect reinforces why this should improve assertions as well as placement: `validateRightPanelForAsset` checks an expected tab only **if it is already present**. An absent expected tab can therefore pass that helper. A replacement should assert that every expected tab exists before checking its contents. [Conditional tab validator][panel-helper]

### 5. Lineage: a browser page is not automatically a browser-dependent assertion

Layer toggles, selected/traced/dimmed attributes, panel state, breadcrumbs and graph-data transformations are frontend behavior. The shared `clickEdgeBetweenNodes` helper uses a synthetic `dispatchEvent('click')`; those cases do not establish that a user can hit the rendered edge at the correct screen position. Several ontology helpers likewise read serialized graph data from DOM datasets, rather than inspecting canvas pixels. [Synthetic edge click][edge-helper], [graph data reader][graph-helper]

Move appropriate state/transformation cases into frontend integration, and keep genuine canvas/layout, drag, zoom, hit-testing and screenshot checks in a browser. Graph libraries may make a backend-free browser fixture more practical than jsdom for some candidates; that still removes the full-stack dependency, but it is not the same as a Jest unit test.

The broad `DataAssetLineage` journeys remain outside U: **79 cases account for 97.6 worker-minutes** in the measured run. They combine real graph creation, column relationships and export behavior. Removing small control tests alone will not remove this cost. [Integrated lineage suite][lineage]

### 6. Import/export: distinguish the modal from the format contract

Local YAML/JSON parsing errors, preview content, mode selection and disabled import buttons can be frontend tests. Server schema validation, ODCS/OpenMetadata conversion, merge/replace semantics, persistence and actual export round-trips need real API or integrated coverage. The implementation performs local parsing and also calls server parsing/validation endpoints; these are separate boundaries. [Import implementation][odcs-implementation], [import/export cases][odcs-tests]

Existing `ODCSImportModal.test.tsx` already covers many modal behaviors, so this is partly consolidation and strengthening. However, it replaces core components including the upload control, and implements extension filtering inside the mock. A passing test of that mock is not evidence that the real upload control behaves the same way. [Existing modal tests][odcs-unit]

## Mixed tests are the larger, harder opportunity

The 1,778 mixed cases account for **41.9% of recorded worker time**. In `Entity`, `EntityDataConsumer`, `EntityDataSteward` and `ServiceEntity` alone, **605 mixed cases consume 3.37 worker-hours**. Much of this repeats owner, tag, glossary, tier, description and announcement operations across entities and roles. [Shared entity helper][entity-helper]

The useful decomposition is:

1. **Frontend integration:** interaction, form state, correct endpoint/body, response handling and visible update, with the real UI.
2. **Backend/API integration:** the operation actually stores the intended data, search returns it, permissions are enforced and entity-specific contracts hold.
3. **Representative browser journey:** the assembled application connects those contracts correctly for meaningful entity/role differences.

Do not replace a real search-result assertion with a fabricated matching result and call that equivalent coverage. For example, the advanced-search helpers verify real search hits as well as query/chip state. The UI builder/serialization matrix can move, but the actual AND/OR/filter semantics belong under real search integration. **124 of the 130 AdvancedSearch queue cases are mixed**, not whole-test U candidates. [Advanced search helper][advanced-helper]

Similarly, workflow authorization and approval, inherited ownership, deletion propagation and ingestion execution should not be erased merely because their final assertion appears in the DOM.

## Existing Jest coverage needs strengthening before browser tests are retired

The application already has Jest, jsdom, React Testing Library and user-event. This migration does not require a new test runner. [Package scripts and dependencies][package], [Jest configuration][jest]

Targeted inspection found important limitations:

- **AddCustomProperty:** the unit test mocks `generateFormFields` into plain inputs, leaving out the real validation rules. Its three tests check child placeholders, field presence and Back navigation. It cannot replace the browser name-validation matrix in its current form. [Current test][custom-unit]
- **QueryBuilderWidgetV1:** the test replaces `Builder` and `Query`, makes several tree utilities identities and returns constant JSON logic. It can test surrounding wiring, but cannot establish correct user-driven query construction or real serialization. [Current test][query-unit]
- **ODCSImportModal:** substantial behavior coverage exists, but several real design-system controls are replaced, including a mock that implements file filtering. Preserve component behavior through the real controls where that behavior is the target. [Current test][odcs-unit]

These are examples from targeted inspection, not a claim that all existing frontend unit tests are poor. The required change is **less mocking of the behavior under test**, not simply a larger unit-test count. Testing Library's guidance supports testing components through user-visible behavior; Playwright likewise recommends observable behavior and test isolation. [Testing Library principles](https://testing-library.com/docs/guiding-principles/), [Playwright best practices](https://playwright.dev/docs/best-practices)

## Assertion quality affects the migration estimate

The ledger carries **77 source-definition notes** about weak assertions, conditional coverage or limits on what a title proves. These are review notes, not 77 independently confirmed production defects. Examples include a password-reset title that only checks navigation, zoom titles that do not assert a changed zoom, and a comment-viewing title that only checks the task card.

Of the 1,589 strong candidate queue cases, **71 have an assertion note**. Excluding all of them still leaves **1,518 cases, or 33.8% of the queue**, as strong candidates. This sensitivity check shows the opportunity is not driven by obviously weak tests. It is not a statistical confidence interval.

Migration should preserve or improve the intended outcome assertions. Some cases deserve repair or consolidation instead of a one-for-one translation. For example, a replacement for a zoom test should either verify the real transform in a browser or clearly limit its claim to control state.

## What this would do for the merge queue

The representative run records **22.58 cumulative test-worker hours**, including attempts. U accounts for **5.23 hours**; U plus M accounts for **14.69 hours**. These figures describe where current work is spent. They exclude separately accounted lifecycle work and are neither billed runner-hours nor predicted savings.

The earlier operational audit found a median **17.05-minute seed preparation** and a **61.14-minute required Playwright gate** in its 30-run snapshot. Frontend extraction can reduce repeated application work and allow fast feedback without that setup. It does not automatically shorten preparation or the longest retained shard. Files that still contain M/E cases may still incur their shared setup. [Operational measurements](QUEUE-ANALYSIS.md#43-the-recent-sample-separates-current-problems-from-old-incidents)

There is also no basis to promise a proportional flake reduction. In this particular representative run, the four retry-rescued cases are in **M, A and E**, with none in U. Moving U cases therefore targets test placement, feedback speed and compute first; it would not have eliminated that run's observed retries. Reliability and queue orchestration work from the original audit remain necessary.

## Recommended first migration

Start with a bounded set of **211 strong queue candidates across six files**, representing **51.4 current worker-minutes**:

- `Features/Permissions/EntityPermissions.spec.ts`: 46 cases.
- `Features/Permissions/ServiceEntityPermissions.spec.ts`: 44 cases.
- `Features/DataQuality/DataQualityPermissions.spec.ts`: 25 cases.
- `Features/Pagination.spec.ts`: 35 cases.
- `Flow/NestedChildrenUpdates.spec.ts`: 36 cases.
- `Features/ColumnBulkOperations.spec.ts`: 25 cases.

Begin implementation with one small family, such as required-field validation or pagination, to establish the real-provider/HTTP-boundary harness. The six-file set is the next bounded target, not a demand to rewrite all six at once. Retain representative assembled-app journeys and the real backend contracts they currently touch. Custom-property validation and right-panel rendering are strong subsequent targets.

For each migrated behavior:

1. Identify the actual defect the test must detect, including negative outcomes. Record which UI, API and browser checks will cover it after migration.
2. Implement the replacement with real components and controlled network/time boundaries. Use user interactions; assert visible outcomes and meaningful request contracts. Avoid mocking the validator, query serializer, state hook or control being tested.
3. Demonstrate that the replacement fails for the intended regression: invalid names accepted, wrong permission combinations, stale response replacing current data, or a nested row failing to update. A temporary targeted fault or existing regression fixture is stronger evidence than coverage percentage alone.
4. Compare current and replacement runtime and repeatability, and verify retained backend/browser checks. Retire the redundant browser variants only once replacement coverage is demonstrated.
5. Rebalance shards and measure the actual queue verdict latency, setup time, test-worker time and retries separately.

Require the fast frontend suite for changed behavior, retain representative critical journeys in the merge gate, and keep API/security/format semantics under real integration coverage. Choose the eventual broader browser schedule and gate size from measured residual cost and failure detection, rather than using an arbitrary target percentage. This audit makes no workflow or branch-rule changes.

## Preserved evidence and follow-up

- [All 2,884 unique definitions](evidence/all-definitions.csv.gz): source links, category, rationale, assertion notes and queue contribution.
- [All 4,488 expanded queue cases](evidence/all-queue-cases.csv.gz): owning spec, source definition, category, measured duration, attempts and result.
- [All 394 specs plus supporting files](evidence/all-files.csv): complete inventory and per-category totals.
- [All 2,903 spec-instantiated definitions](evidence/all-spec-instances.csv.gz): explicit accounting for shared factory definitions.
- [Machine-readable summary](evidence/summary.json). CSV exports are gzip-compressed; use `gzip -dc <file.csv.gz>` to inspect them.
- [Migration status and validation](MIGRATION.md): distinguishes the 211-case candidate set from coverage actually replaced in this PR.

These are immutable audit exports at the source commit above, not generated descriptions of the current branch. The original TypeScript AST extraction, hand-reviewed decisions and downloaded shard results produced the reconciled exports. Repeating the classification requires checking out that commit and collecting the linked run's native results; hosted artifact retention may limit future retrieval. This repository preserves the reviewed decisions and measurements, rather than depending on an ignored local workspace directory or a live artifact URL.

[run]: https://github.com/open-metadata/OpenMetadata/actions/runs/34355232120
[custom-validation]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/CustomProperties.spec.ts#L3803
[custom-panel]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/CustomProperties.spec.ts#L3668
[custom-contract]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/CustomPropertiesApiContract.spec.ts#L900
[entity-permissions]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/EntityPermissions.spec.ts#L217
[service-permissions]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/ServiceEntityPermissions.spec.ts#L93
[dq-permissions]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/DataQualityPermissions.spec.ts#L320
[permission-helper]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/utils/entityPermissionUtils.ts#L197
[pagination]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts#L66
[pagination-helper]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/utils/common.ts#L1335
[search-race]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchSettings.spec.ts#L612
[nested-updates]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NestedChildrenUpdates.spec.ts#L62
[explore-panel]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExplorePageRightPanel.spec.ts#L204
[panel-helper]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/e2e/PageObject/Explore/RightPanelPageObject.ts#L838
[edge-helper]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/utils/lineage.ts#L141
[graph-helper]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/utils/ontologyStudio.ts#L170
[lineage]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage/DataAssetLineage.spec.ts
[odcs-implementation]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/src/components/DataContract/ODCSImportModal/ODCSImportModal.component.tsx#L335
[odcs-tests]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ODCSImportExport.spec.ts
[odcs-unit]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/src/components/DataContract/ODCSImportModal/ODCSImportModal.test.tsx#L41
[entity-helper]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/support/entity/EntityClass.ts#L145
[advanced-helper]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/playwright/utils/advancedSearch.ts#L371
[package]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/package.json
[jest]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/jest.config.js#L121
[custom-unit]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/src/components/Settings/CustomProperty/AddCustomProperty/AddCustomProperty.test.tsx#L198
[query-unit]: https://github.com/open-metadata/OpenMetadata/blob/44823acde1c85ccc20d9f62c588169567fc28c90/openmetadata-ui/src/main/resources/ui/src/components/common/QueryBuilderWidgetV1/QueryBuilderWidgetV1.test.tsx#L97
