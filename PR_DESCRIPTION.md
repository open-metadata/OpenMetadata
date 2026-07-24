<!--
Thank you for your contribution!
Unless your change is trivial, please create an issue to discuss the change before creating a PR.
-->

### Describe your changes:

Fixes #30151

I worked on the **Incident Manager "Grouped Incidents" backend** because the incident manager redesign needs incidents normalized into triageable groups (by table, test definition, or test-case owner) instead of a flat alert list, and the existing APIs could neither serve the grouped view nor scale to catalogs with deep incident history.

**New API surface**

- `GET /v1/dataQuality/testCases/testCaseIncidentStatus/incidentGroups` — distinct open incidents grouped by `table`, `testDefinition`, or `owner`. Each group carries the full row the UI renders: `incidentCount`, most-critical `severity`, triage-ranked `status` (Assigned > Ack > New), current `assignees` + `assigneeCount`, `firstSeen`/`lastSeen`, and an 8-bucket `trend` with a `Rising`/`Falling`/`Steady` direction (the "recurring" signal). Filters: open statuses, current assignee, test case, domain, and a `createdAt`/`updatedAt` date range; sortable and paginated with opaque cursors.
- Drill-down filters on the existing incident list endpoint: `testDefinition`, `owner` (direct user/team owner of the test case), and a repaired `assignee` — so every group row can open its exact incident population.
- `PUT /v1/dataQuality/testCases/testCaseIncidentStatus/bulk` — bulk status/severity changes for up to 100 incidents per call (the UI's "Set status / Set severity on selection"), following the platform's `BulkOperationResult` pattern with per-entry validation, authorization, and success/failure detail.
- `failureSummary` denormalized onto every incident record at write time (failed result → incident task payload → sync handler), so incident listings can show the failure reason without a per-incident result lookup (no N+1).

**Fixes shipped along the way** (all found by tests or scale-testing this feature)

- The incident-groups cursor was emitted Base64-encoded but the endpoint only accepted a plain int offset — cursors now round-trip opaquely like the sibling list endpoint.
- Time-series listings without a `startTs`/`endTs` reported `paging.total: 0` (the count query evaluated `timestamp BETWEEN NULL AND NULL`), which also suppressed the `after` cursor. Fixed in `EntityTimeSeriesRepository` for all time-series entities.
- The incident list's `assignee` filter silently returned nothing: the generic `assignee` param had been repurposed by the task listing (name-hash → `ASSIGNED_TO` relationships). The incident list now maps it to a column comparison (`incidentAssignee`).
- `docker/mysql/Dockerfile_mysql` was pinned to the discontinued `mysql/mysql-server:latest` (frozen at 8.0.32, which crash-loops on a purge-thread FK assertion on case-insensitive filesystems). Swapped to the maintained `mysql:8.0`.

#
### Type of change:
- [x] New feature

#
### High-level design:

**Query architecture.** An incident is a `stateId` chain of status records in `test_case_resolution_status_time_series`. The grouping query reduces the chain in a `chain` CTE (`GROUP BY stateId` over the new `(stateId, timestamp)` index for first/last timestamps) and joins back on the last timestamp for the current status/assignee/severity — deliberately avoiding `ROW_NUMBER`/`MIN`/`MAX` window functions, which materialize three buffered passes over the whole table at scale. One SQL round-trip serves the entire page: the group total rides on `COUNT(*) OVER ()` and the per-group trend timestamps ride on `JSON_ARRAYAGG`/`JSON_AGG` (chosen over `GROUP_CONCAT`/`STRING_AGG` because JSON aggregates have no `group_concat_max_len`-style cap that would silently truncate a large group's trend). Trend bucketing and direction stay in Java (`TestCaseResolutionStatusRepository`), keeping the SQL dialect-free.

**Layering.** All SQL lives in `CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO` — the CTE templates, the dialect-specific `@Define` expressions (`severityExpr`, `assigneesExpr`, `createdAtAgg`, dimension joins), and the parts assembly that splices `ListFilter` output into the right sub-query. The repository holds only orchestration and business mapping (rank→status, trend buckets, entity-reference resolution); the resource holds request parsing/auth. `addOriginEntityFQNJoin` moved from the repository into the DAO to complete the separation.

**Write-time denormalization.** `failureSummary` is captured when a failed test result opens an incident: the result text travels through `getOrCreateIncident` into the Task payload's existing `failureReason` field, and `IncidentTcrsSyncHandler` stamps it onto every TCRS record of the chain. Read paths never join to test results. Records predating the change are not backfilled (the field is optional).

**Bulk endpoint.** One-pass shape borrowed from `EntityResource.processBulkRequest`: all referenced test cases resolve via a single `findEntityByNames` batch and the caller reference resolves once; the per-entry loop then authorizes and creates with zero lookups. Synchronous by design — the caller is an interactive selection capped at 100 entries that needs inline per-entry results; the `async`/202 path can be added if a bot-scale consumer appears.

**Alternatives considered and rejected**
- *Embedding incident lists inside group rows*: unbounded nested payloads needing their own pagination; the drill-down filters make each group's population addressable instead.
- *Window-function CTE (original implementation)*: measured 3× slower per execution at 100k+ rows and ran three times per request (count + page + trend); replaced as above (measured ~10× end-to-end on the groups endpoint).
- *`STRAIGHT_JOIN` hints for the chain join*: measured slower than the optimizer's plan; SQL stays hint-free and portable.
- *Incident summary rollup table*: the right long-term answer for O(open-incidents) reads at any history depth (and would also fix the pre-existing `latest=true` slow path), but it is a migration + dual-write + backfill feature of its own; deliberately left as follow-up.

**Migrations / rollout.** Additive only: a new 2.1.0 native migration adds four indexes — `(stateId, timestamp)`, `(entityFQNHash, timestamp)`, and `(assignee, timestamp)` on the time-series table, and `(id)` on `test_case` (which predates the `PRIMARY KEY(id)` convention; the relationship join had no index target). New schema fields are optional; no data migration. The `mysql:8.0` image swap affects fresh dev environments on next image build; volumes initialized by 8.0.32 upgrade in place.

#
### Tests:

#### Use cases covered
- Incident manager groups by table, test definition, and owner with correct open-incident counts (resolved chains and deleted test cases excluded; a co-owned test case's incident counts once per owner but never twice within a group)
- Group rows render severity (most critical), status rollup, assignees, first/last seen, and trend sparkline data; a single-incident group reads `Steady` with all activity in the first bucket
- Group filters: open statuses (Resolved rejected with 400), current assignee, single test case, domain, `createdAt`/`updatedAt` date ranges; count-sorted ascending/descending
- Cursor pagination walks every group exactly once, forward and backward, with exact `before`/`after` arithmetic and correct behavior past the end of the list
- Drill-down listings scoped by test definition, by direct owner (user or team), and by assignee — including `latest=true` — with 404 on unknown filter targets
- Bulk status change applies per-entry with partial-success reporting; the applied entry appends to the incident chain
- A failed test result opens an incident whose records carry the denormalized failure text
- Unranged incident listings report real totals and working pagination cursors

#### Unit tests
- Files updated: `openmetadata-service/src/test/java/org/openmetadata/service/jdbi3/TestCaseResolutionStatusRepositoryTest.java` (15 tests; join-builder tests follow the helper to its new DAO location)

#### Backend integration tests
- [x] I added integration tests in `openmetadata-integration-tests/` for new/changed API endpoints.
- Files added/updated: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/IncidentGroupsIT.java` — 27 tests covering everything under "Use cases" above, run green on **both PostgreSQL and MySQL** (the SQL uses dialect-specific aggregate/JSON expressions, so both matter). New behaviors were RED-verified: each test was shown to fail with the feature toggled off (null aggregates, unfiltered result sets, 405 on the bulk path, missing failure summary, `total=0` paging) before going green.

#### Ingestion integration tests
- [ ] Not applicable (sample-data fixture updates only; no connector logic changes).

#### Playwright (UI) tests
- [ ] Not applicable (backend + generated TS models only; UI implementation is a follow-up PR).

#### Manual testing performed
1. Started the local stack (`docker/development`, MySQL) with the branch build; verified the 2.0.0 migrations create all four new indexes on a fresh volume.
2. Generated a synthetic catalog via API + SQL (800 tables, ~2,000 test cases, 200 users, 60 test definitions, 200k incident records / ~17k open incidents in realistic chains) and probed every endpoint with curl.
3. Measured on the running server at 200k records: groups 0.57–1.37 s for all three dimensions (vs 4.4–5.4 s for the original window-CTE implementation at *half* that volume), drill-down filters 40–144 ms, cursor page 2 at 697 ms with stable totals.
4. Verified cursor round-tripping (`paging.after` → `offset`), totals without time ranges, the repaired assignee filter (2.1 s → 40 ms after its index), and `Rising`/`Falling`/`Steady` trend variety across groups with different incident time profiles.

#
### UI screen recording / screenshots:

Not applicable.

#
### Checklist:
- [x] I have read the [**CONTRIBUTING**](https://docs.open-metadata.org/developers/contribute) document.
- [x] My PR title is `Fixes <issue-number>: <short explanation>`
- [x] My PR is linked to a GitHub issue via `Fixes #<issue-number>` above.
- [x] I have commented on my code, particularly in hard-to-understand areas.
- [x] For JSON Schema changes: I updated the migration scripts or explained why it is not needed.
- [ ] For UI changes: I attached a screen recording and/or screenshots above. (Not applicable — no UI changes.)
- [x] I have added tests (unit / integration / Playwright as applicable) and listed them above.

<!-- New feature -->
- [x] The issue properly describes why the new feature is needed, what's the goal, and how we are building it.
- [ ] I have updated the documentation. (API documentation is carried by the OpenAPI annotations on the new endpoints; no separate docs page yet.)
- [x] I have added tests around the new logic.
