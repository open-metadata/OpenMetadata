# Review instructions

Two readers apply this file, and the bar is the same for both:

- **The reviewer** of a PR, human or automated.
- **The agent that wrote the change**, before it opens the PR. The `pr-checklist` skill runs a
  self-review of the branch diff against this file. A finding fixed there is one a maintainer never
  has to write.

The rules come from 30 days of review threads (2026-09-16 → 2026-10-16, 1,547 PRs): what
maintainers asked for, and which gitar, Greptile and Copilot findings authors fixed and which they
rejected. Findings that state a failure path and a fix were accepted 85–100% of the time; open
"why?" questions and rule quotations about half the time or less. Add signal that CI misses. Do
not restate what spotless, ESLint, Prettier, ruff or basedpyright already enforce.

## How to review

1. **Read the change, not just the hunk.** Read the net diff (`git diff origin/main...HEAD`, or the
   PR's file list) and every changed function in full. For a fix, also read every sibling with the
   same shape:
   - create vs rename vs CSV import vs bulk;
   - PATCH vs PUT vs `restoreEntity`;
   - the classic page vs its AI-mode or core-ui rebuild;
   - the SQLAlchemy vs pandas validator;
   - each feed variant, and each connector built on the same helper;
   - each caller of a duplicated guard, including MCP tools.

   The most common accepted finding is a fix that lands on one of these paths.
2. **Map behavior to tests.** Write one line per changed source file: `Foo.java → FooIT#case`, or
   `Foo.java → none`. A `none` against changed behavior is a finding unless the change is
   behavior-neutral. For each test the PR adds, ask which reverted line would make it fail.
3. **Hunt in this order:** logic defects (the list below), test gaps and tests that cannot fail,
   flaky tests, comments standing in for code, cross-layer and Collate gaps. Look at shape and
   style last.
4. **Prove each finding before you write it:** the input or state that triggers it, the path
   (`file:line`), and the wrong result. If you cannot write the trigger, drop the finding.

## What a finding is

Every finding carries three parts: the **trigger** (an input or state that occurs in practice), the
**result** (wrong output, crash, data loss, leak, flake), and the **fix** (a code or test change).

- 🔴 **Important**: it breaks behavior in production, corrupts or drops data, opens a security or
  privacy hole, silently disables a safety net, breaks Collate, or adds a test that cannot fail or
  will flake. It must be fixed before merge.
- 🟡 **Nit**: everything else, capped at six per review. Style, naming, structure and dead code are
  nits at most.
- **One finding per root cause.** List the sibling sites inside it. Never post the same point once
  per line, twice in one PR, or again on each backport.
- **The fix is code.** For an unhandled case the fix is a guard, a validation error, a typed result
  or a test. A comment is never offered as the alternative.
- **A claim about how a library, engine or browser behaves** (Elasticsearch/OpenSearch, MySQL,
  react-aria, Snowflake, Airflow) cites the docs or the source at the pinned version, or a
  reproduction. Otherwise it is not posted. Rejected bot findings were mostly confident claims of
  this kind.
- **Check the PR head, not `main` or an older revision,** before claiming a key, symbol or file is
  missing or was removed.
- **Zero findings is a valid review.** When you find nothing, say what you checked.

## Logic defects reviewers keep finding here

### Authorization, masking and trust

- **Every path applies the canonical check.** Any path that creates, links, reveals, counts or
  returns an entity calls the same authorization and masking predicate as the canonical REST
  endpoint, and does not re-derive it. That covers:
  - bulk and CSV import, and side-effect creation (OpenLineage creating databases);
  - MCP tools, change-event payloads and write responses (redact on create, PUT, PATCH, pin, delete);
  - deep-linked UI routes;
  - both halves of a paired operation (follower add **and** remove);
  - totals: compute `total` after RBAC filtering, or it reveals how many hits were hidden;
  - background jobs: `ImpersonationContext` is a thread-local and is not copied into jobs.
- **Guards fail closed.** A guard rejects, or treats the caller as unprivileged, when its key input
  is absent:
  - an optional `type` parameter;
  - a field that was not loaded (`primaryEntity` missing from `fields` read as "unanchored, so
    org-wide");
  - a `null` writer or principal.

  An empty Elasticsearch `bool` is `match_all`, so "no domains" must emit `match_none`. A Deny rule
  whose attribute is missing must not quietly stop applying.
- **The server stamps trust fields.** Provenance and server-owned fields (`sourceType`, `provider`,
  `triggeredBy`, detection timestamps) are set or clamped on the server, never taken from the
  client body. A server-owned task type guards every mutation: PATCH, `/close`, bulk cancel and
  assign, soft and hard DELETE, and resolution-only requests.
- **Gates cover every write shape.** An approval workflow, domain or owner policy, or `ViewAll`
  scoping is enforced, and tested, for a PATCH with explicit `null`, a PUT that omits the field, bulk
  and CSV writes, and merged revisions. It evaluates the same **inherited** fields that `get()` and
  `setFieldsInBulk` resolve, and it does not depend on a statement order documented only in a
  comment. Strip DERIVED tag labels on both sides of an `EntityUpdater` comparison.
- **Secrets.**
  - Mask secrets on REST, MCP and change-event paths alike.
  - Re-encrypt only when the plaintext changed. Fernet output is random, so a resubmitted secret
    otherwise bumps the version and redeploys the workflow.
  - A secret-bearing config is a typed schema with `format: password`. A `oneOf` converter that
    falls back to an untyped `Map` hides secrets from the secret walkers.
  - Never pass an exception cause that carries a URI or credential to the logger.

### Writes and data integrity

- **Writes keep what the caller did not send.**
  - A PUT that omits a field keeps the stored value, matching `EntityUpdater` for owners, domains,
    tags and `defaultDomain`. An explicit `null` in a PATCH means "clear", which differs from
    omitting the field.
  - Build a PATCH diff from an original fetched with every field being patched (`fields=owners`).
  - Re-ingestion, live-status merges and export→import keep what they do not own (`patchedFields`,
    `keepRecordedTriggeredBy`). Test the round-trip.
  - UI save payloads carry the fields the form does not edit.
  - Editors round-trip values they do not recognize: an enum value newer than the client, a metric
    missing from `MetricType`, the second source of a multi-source alert. They render them as
    removable items and never map them through a lookup that drops misses, or read only `[0]`.
- **Responses and search reflect what was stored.** When a write drops elements (an unresolved
  reference, a failed tag), return and index the persisted state, not the request.
- **Validation lives in `prepare()`.** `prepare()` runs for create, PUT and PATCH; PATCH goes through
  `JsonUtils.applyPatch` with no schema validation, so the form and `@Valid Create*` are not enough.
  - Reject, or backfill, a PATCH `remove` of a required field.
  - A new write-time rule runs only when a field it guards changes, or stored definitions become
    uneditable.
  - It survives `EntityUpdater` in-session consolidation, whose final pass validates the
    pre-session state against the final one.
  - Decide explicitly whether ingestion bots and bulk creates are exempt; dbt, Looker and Snowflake
    metric ingestion broke on a new rule.
- **Identity.** Never resolve by a non-unique key: `findFirst()` on an unordered query, a bare name,
  a display label, a list position. Key by FQN (`FullyQualifiedName.quoteName` / `buildHash`;
  lowercase users as `UserRepository` does), by `(id, type)`, or by a canonical lowercase UUID.
  Compare `EntityReference`s by id. Service names are unique only within a service type. Never split
  or join FQNs as strings: use `Fqn.split` / `Fqn.build` in the UI and the `FullyQualifiedName`
  helpers in Java.
- **Multi-step decisions are atomic and versioned.** Writes that must succeed together run in one
  `executeInTransaction`. A user's decision carries the version of what they saw, and the server
  answers 412 if it changed. Side effects follow the real outcome (`APPLIED`, the surviving success
  set), not the request. That covers closing a task, creating a relationship, emitting lineage, and
  resetting a failure counter.
- **Bulk writes.**
  - Group by the entity actually saved (column → table).
  - Chunk at about 100.
  - Keep each chunk's `tag_usage` and relationship rows, the entity row and its version in one
    transaction.
  - Isolate per-item failures.
  - A bulk or generic path still runs the single-entity path's side effects (`syncTableColumns` for
    `column_search_index`, versions, change events) and respects its storage (ML-feature tags live in
    the entity JSON, not in `tag_usage`).
- **Upserts do not overwrite curated definitions.** Ingestion and UI saves do not PUT over a
  same-named custom-property type or config, a classification's exclusivity, or an enum config they
  do not own.

### Failure handling

- **A failure never becomes success, zero or empty.**
  - Check returned statuses: `SystemRepository.createOrUpdate` returns a 500 `Response` instead of
    throwing.
  - Validate the JSON shape instead of trusting `JsonNode.asLong()` defaults: a missing `hits.total`
    was reported as 0.
  - A failed or unknown read is not "nothing exists": `{}`, `set()` or `undefined` read downstream as
    "deleted", "no failing test" or "unclaimed".
  - A DQ query error is an Aborted result, never Success.
  - A failed load renders an error, not the empty state with an Add button.
  - Rethrow `BpmnError` unchanged.
  - When an endpoint moves to per-item results (`BulkOperationResult`), every caller reads them.
- **Catch narrowly.**
  - `InterruptedException` gets its own branch that restores the flag and rethrows; never map it to
    a retryable status.
  - A worker thread that owns a lock or semaphore handles `Throwable`, or its liveness is checked:
    an OOM in the RDF writer hung the run while its heartbeat kept the cluster lock.
  - Keep every call that can throw inside the `try` whose handler sets the status.
  - Never log a generic failure as "already exists".
  - A new exception type has an `ExceptionMapper`.
  - The status says whether a retry can help: "Retry shortly." for a state that lasts until the
    weekly rebuild makes agents loop.
- **One item does not fail the batch.** One soft-deleted child must not roll back a domain move. An
  exception escaping a `scheduleWithFixedDelay` task stops the schedule for good. Cleanups use
  `Promise.allSettled`.
- **Failed or partial discovery never drives deletion.** If listing a scope fails (an exception, a
  permission error, a failed page, an access-scoped catalog view), mark the scope unknown. Skip
  `markDeleted*` reconciliation and field removal for it, and fail the workflow regardless of
  `successThreshold`. A broad catch that turns a failure into an empty listing soft-deletes live
  entities.

### Concurrency, caches and multiple pods

- **Check-then-act is atomic.**
  - Use a conditional `UPDATE … WHERE status = …`, compare-and-set (`replaceSettingIfCurrent`, not
    `createOrUpdate` from an old snapshot), or one lock held across the sequence.
  - Check affected-row counts (`renew()`).
  - Id order is not commit order.
  - Use DB-assigned UTC timestamps.
  - Use `ReentrantLock`, not `synchronized`, on code that runs on virtual threads.
- **MySQL semantics.**
  - Replay only whole-transaction rollbacks: MySQL 1213 and Postgres `40P01`/`40001`. Never replay a
    1205 lock-wait timeout; the transaction is still alive.
  - Under REPEATABLE READ, an `UPDATE … WHERE status='PENDING'` followed by an INSERT into the same
    range deadlocks on gap locks.
  - Wrap a retry around each unit that commits on its own, or a retry re-runs work that already
    committed (a workflow started twice).
- **Caches across pods.**
  - A JVM cache of authorization or entity data registers a cluster-wide invalidator
    (`CacheBundle`). Do not assume Redis exists.
  - It rejects in-flight loads that started before an invalidation.
  - It evicts only after commit, not in a `finally` that runs before the commit, and evicts every
    key the write touched (old and new FQN).
  - Reads inside a transaction must not cache uncommitted rows.
  - `dao.update` and `fromCache=false` paths have cache side effects. `get(..., fromCache=false)`
    also evicts `CACHE_WITH_ID`.
- **Request and job state.**
  - A ThreadLocal is cleared in `PerRequestContextCleaner`, and never read from a worker thread
    (`RequestEntityCache` in a background drain).
  - State that spans requests (a multi-step SSO test login) lives in the DB or Redis, not in a
    pod-local Caffeine cache.
  - An in-process lock is not mutual exclusion across pods.
  - Startup cleanup checks the run lock before failing a run another pod is still running.
  - Persisted workflow and job fields stay readable by the previous server version during a rolling
    upgrade.
- **Background jobs.** A new `jobType` joins every list that enumerates its siblings: the
  `markStaleRunningJobsFailed` reaper, the memory-job capacity check, `JobDAO` and Collate's own
  copy of `backgroundJob.json` (a missing constant throws `NoSuchFieldError`, an `Error` that kills
  the background-job poller). Long or LLM-bound job types get a per-type cap on
  `GenericBackgroundWorker`.
- **Bounded caches** (AGENTS.md), and the cap must not change behavior. If the cache is a working set
  read after it is filled (page cursors, per-schema remarks), a miss after eviction refetches
  instead of silently losing data. Bound the total retained items, not just the keys, and cache
  misses too.

### Search

- **Writes.**
  - A partial update must not null-remove fields it does not own (`FIELDS_TO_REMOVE_WHEN_NULL`).
  - `search_after` sorts on a unique, un-normalized key (`id.keyword`).
  - `must`/`filter`/`should` are clauses only as direct children of a `bool`.
  - Filtering on a field requires writing and mapping it.
  - Alias-scoped update- and delete-by-query target `getWriteFanoutTargets(...)`, so a staged
    reindex index is updated too.
  - Nested `children` mapped `enabled: false` cannot be queried; select the holder documents by
    `_id`.
  - Compare ids case-insensitively: legacy documents may hold uppercase UUIDs.
- **Field changes need an upgrade-window plan.**
  - Documents written before the upgrade must still deserialize until the reindex finishes
    (`SEARCH_FIELDS_EXCLUDE`).
  - Data streams cannot change a field's type in place; roll them over.
  - Update every consumer: `SearchMetadataTool.ESSENTIAL_FIELDS_ONLY`, Collate aggregations, Data
    Insights streams.
  - Use the configured `clusterAlias`, not an `om_` prefix.
  - A setting that disables an index is honored by every walker of `getEntityIndexMap()`
    (`SearchRepository.isIndexDisabled`).
  - A content or embedding fingerprint excludes filter-only fields, or the first reindex re-embeds
    everything, one paid call each.
  - Index maintenance runs on every reconciliation entrypoint (startup `createMissingIndexes`,
    `updateIndexes`, the reindex orchestrator).
- **Queries.** Never send an empty `q`, which matches everything. Test escaping against a live
  engine with raw quotes and backslash runs. A Lucene-syntax `field:"<fqn>"` over the `dataAsset`
  or `all` aliases fans out across fields and can exceed `maxClauseCount` on OpenSearch.

### Migrations and upgrades

`.claude/rules/migrations.md` covers append-only, both dialects and idempotency. Reviewers
repeatedly add the following.

- **Java migrations** (`migration/utils/vNNN`):
  - Compute a fixed point that is safe to re-run, never a subtractive delta.
  - Guard on the current shape, so an admin-customized row is left alone.
  - Let unexpected failures propagate. A migration that logs and returns is recorded as applied in
    `SERVER_CHANGE_LOG`, and the repair never runs again.
  - Skip work already done. Data migrations re-run whenever `MigrationCodeFingerprint` changes.
  - Normalize legacy `null` values.
  - Rewrite the `entity_extension` `<entity>.version.*` snapshots as well as the live row.
  - Remove the deployed pipelines of an entity type the migration removes.
- **SQL.**
  - Never edit a statement that already ran; statements are tracked by a hash of their text.
    Appending a statement to the newest folder of the release in progress is fine:
    `MigrationWorkflow` reprocesses it.
  - Size FQN-hash key columns like `entity_extension` (`VARCHAR(512)`).
  - Replace MySQL `INSERT IGNORE`, which turns truncation into a warning, with
    `ON DUPLICATE KEY UPDATE`.
  - Use the schema's collation (`utf8mb4_0900_ai_ci`) everywhere it is set.
  - Postgres indexes on large tables use `CREATE INDEX CONCURRENTLY`.
  - Predicates on `entity_extension` must be index-usable; `LIKE 'app.version.%'` scans the table.
  - Scope catch-up sweeps to rows created after the previous upgrade: a missing target row can mean
    it was deleted on purpose.
- **Earlier releases' stored data.**
  - A new schema `maximum` (Pydantic `le=`) must not reject saved configs; ship a clamping migration.
  - Class names persisted by Quartz or `ServiceLoader` keep resolving.
  - A new indexed field is absent until the reindex runs.
  - An additive request field fails against an older server with `additionalProperties: false`, so
    roll out the server first.

Test a migration on real, multi-row data on both engines. A predicate can behave differently on one
row than on many: an `EXISTS` over `JSON_TABLE` in a MySQL `UPDATE` matched zero rows.

### UI

- **antd → core migrations keep behavior.** List each implicit antd behavior or default the call
  site relied on, and carry it over:
  - z-index: the core overlay is `z-50`, an antd drawer is 1000, so a dialog can open under a drawer;
  - default width: core `Dialog` is 688px, antd Modal was 520px;
  - outside-click and Escape dismissal;
  - `rel="noopener"` on `target="_blank"`, and basename-aware hrefs (`useHref`);
  - a controlled `selectedKey` must be in the collection, or react-aria auto-selects another tab;
  - overflow clipping;
  - validation caps (antd `InputNumber` `max`), placeholders, required markers;
  - keyboard activation: react-aria's `usePress` swallows Enter and Space on wrapper triggers, and a
    core `Card isClickable` is not keyboard-operable;
  - error and retry states.

  Re-check Playwright helpers keyed on antd classes: `.ant-skeleton` waits resolve instantly once
  the skeleton is core. Attach before/after screenshots of each changed surface, in both themes.
- **Rebuilt screens keep the legacy page's behavior.** An AI-mode or core-ui rebuild is diffed
  against the page it replaces for:
  - validation and permission gates (not raw `isAdmin` where the legacy route used
    `EVENT_SUBSCRIPTION`);
  - the `fields=` it requests (missing `owners` means saving wipes them);
  - query filters (`includeDeleted`, `isBot: false`);
  - `*ClassBase` extension widgets that Collate fills;
  - paging past the first 50, awaited and no-op-skipping saves, and `NavigationBlocker`.
- **Async state.**
  - A fetch that a newer one can supersede (search, page, entity switch, poll) carries a request id
    or an `AbortController`. That guard also covers the `finally { setIsLoading(false) }`.
  - Reset busy flags on the error path.
  - Key memos and effects on content, not on array or object identity: a recomputed reference wiped
    a user's unapplied selection.
  - Refresh derived views after **every** mutation.
  - Async server work that returns 202 completes on its event; a websocket result can arrive before
    the HTTP response does.
  - Do not enable a destructive decision until every input it acts on has loaded.
- **Mutation handlers report failure.** Shared save and patch handlers return a result or rethrow,
  so callers close, rename and navigate only on success. Never `void` a save. Show errors where the
  user is looking; an app-store `inlineAlertDetails` nobody renders is silent.
- **Pagination.**
  - Filter on the server before `limit`; never prune server pages on the client.
  - Never treat one fixed page (`limit` 50 or 100) as the whole option list: page through it or
    offer load-more.
  - Stop paging on an empty page.
  - Reset the page and cursor when a filter changes.
  - Cursor APIs use `usePaging` / cursor-only navigation, never numbered page jumps.
- **Falsy values carry meaning.** Distinguish `0`, `''`, `null` and `undefined`:
  - `timeWindow || undefined` turned "All time" into the server's 5-minute default;
  - `String(null)` writes the literal `"null"`;
  - a cleared number input is `NaN`;
  - a real domain named like a sentinel matches the sentinel.
- **State keyed to identity.** State derived from an entity, view, group or modal resets when that
  identity changes: key the component, or reset in an effect keyed on it.
- **The UI consumes the API's semantics; it does not re-encode them.** Copying ingestion's threshold
  lists, the status triage order, or "block while running" into UI constants drifts. Put the
  classification in the schema.
- **Shared core components.** A change to a shared component (`ModalOverlay`, `TreeSelect`,
  `ToastProvider`) is scoped behind a prop, or comes with evidence for its consumers; one change hit
  61 dialogs. No new public core API without a production caller.
- **`data-testid` is never a production lookup or a style hook.** Use a ref, or a prop at the call
  site.

### Ingestion

- **Every workflow honors the entity's scope.** The profiler, sampler, DQ, usage and lineage
  workflows resolve the database or catalog the metadata run used (`supportsDatabase`). Topology
  context shared across sibling units is reset at the start of each unit. Filters match the name as
  ingested (Rill models carry a `_model` suffix; `standardize_table_name` truncates).
- **Lineage does not guess.** Resolve targets per configured service with the connector's real
  naming, and require an unambiguous match. Otherwise leave the edge unresolved: no first search
  hit, bare name, wildcard service, "first model" or default schema. Emit edges through
  `yield_lineage_request`, so `overrideLineage` clears stale ones.
- **DQ verdicts come from one computation.** The verdict, the message, `passedRows`/`failedRows` and
  the failed-row sample all use the same population: non-null values where the test counts them,
  not `row_count`. Compare thresholds safely at inclusive boundaries (`7 / 100 * 100` is
  `7.000000000000001`). Record sample and partition flags as actually applied; a custom
  `sample_query` bypasses both.
- **Fallbacks do not invent data.** Do not label GBP as USD, publish a derived metric's formula as a
  measure, or use a task's creation time as its assignment time. Leave the value unset or mark it
  unknown.

### Collate builds against OpenMetadata `main`

Before renaming or removing any of the following, search `openmetadata-collate` for callers:

- a public Java signature;
- a search-index key;
- a Playwright helper or test id;
- a shared component prop, or an `onChange` value shape;
- a `*ClassBase` or `extensionRegistry` hook;
- an enum constant in a schema Collate copies;
- a dependency major.

Then ship a companion Collate PR, or keep a deprecated overload or no-op. `maven-collate-ci` breaks
whichever repo merges first, and Collate's strict `tsc` fails on the next submodule bump. Provider
rules stay behind their SPI, not keyed on a Collate provider in OSS core. A method whose only
callers are in Collate says so in one line, so nobody deletes it as unused.

### Contract tests a change is known to break

These go red on the PR. Update them in the same change:

- a new `Relationship` enum value → `EnumBackwardCompatibilityTest` (the ordinal is stored);
- a new entity-schema field → its `om:` predicate in
  `openmetadata-spec/src/main/resources/rdf/ontology/openmetadata.ttl` (`RdfOntologyContractTest`);
- a new v2xx data-migration step → the `mockStatic` list in `IngestionPipelineMigrationEntryPointTest`;
- a changed Pydantic model or base-class annotation → basedpyright, where any new violation in any
  file fails.

## Tests

### Which change needs which test

| Change | The test that must exist |
|---|---|
| A new or changed endpoint, query param or payload | An IT in `openmetadata-integration-tests/` asserting the exact status and body, including the 403 path and paging |
| A governance, authorization or write-path fix | A regression IT that fails before the fix (null PATCH, omitted PUT field, bulk, inherited fields) |
| A security bypass, or a new read path that must mask | A REST and MCP regression for a reader who can view the entity but not the PII |
| A workflow node or trigger change | An IT that runs the real Flowable process; unit tests cannot prove the call-activity output mapping |
| A SQL migration, collation or index change | Testcontainers on MySQL **and** Postgres, with legacy rows, version snapshots and a no-op second run |
| A search field, mapping or refresh change | An IT on a real engine, including documents written in the old shape |
| A switch or mapping that gains a value | A case in the existing table-driven test |
| A UI flow, or a fix to the classic page and its AI-mode twin | A Playwright spec for each surface, asserting the result rather than the request |
| A component branch, hook or payload builder | Jest asserting the payload or the rendered outcome, not a mock call |
| A connector or DQ boundary | pytest at the boundary, plus a value just past it |
| A bug fix | A test that fails on `main`. Say so in the PR |

### A test that cannot fail is a finding

Ask which assertion goes red if the fix is reverted. The shapes seen in this window:

- The only assertion is negative (`expect(mock).not.toHaveBeenCalled()`), or the test never performs
  the action its name describes.
- The mock replaces the behavior under test: the whole core `Dropdown` mocked, an entire data layer
  mocked, `mock(...)` + `thenCallRealMethod()` on the class under test, `verify(mock)` as the only
  check.
- The test re-implements the production logic, or asserts a serializer (`qs`) instead of the real
  request.
- The fixture equals the default, so the new branch never runs (`None` prefix, default `SerdeInfo`,
  a `MagicMock` that is truthy for every FQN).
- The assertion accepts the failure state:
  - `assertThrows(Exception.class, …)` also passes on a 500;
  - a `waitForResponse` predicate is satisfied by a 404;
  - an absence check runs before the page is ready;
  - an assertion sits inside an `if`;
  - an existing assertion was loosened to make the PR pass.
- Gating hides the logic: OSS `*ClassBase` gates (`getAlertEnableStatus()` returns false) mean the
  code under test never runs in OSS Jest.
- The test never runs: it is skipped, it lives in a folder no Playwright project collects, or a
  `TestAbortedException` reports a skip as a pass.

### Flaky by construction

`.claude/rules/frontend-playwright.md` and the lint already ban `waitForTimeout`, `networkidle`,
`force`, positional locators and inline `waitForResponse`. The flakes they cannot see:

- **Shared state.**
  - Mutating a shared `@BeforeAll` fixture that another method asserts on, in a concurrently run IT
    class.
  - PATCHing the shared `admin` user's roles while other specs run.
  - Deleting fixtures you did not create (KPIs, tags).
  - Comparing counts against totals that other workers change.
  - An IT that touches process-global state needs `@Isolated` or a shared `@ResourceLock`;
    `@Execution(SAME_THREAD)` serializes only within the class.
- **Construction and cleanup.** Create entities in `beforeAll`, not at module scope (a 409 on
  retry). Register cleanup before the fallible create, in a `finally`. A `beforeAll` runs once per
  worker group, not once per file.
- **Waits.**
  - A `waitForResponse` predicate matches method and URL and covers every code path that can fire
    (sort and quick-filter variants hit `/search/query`). Keep `status()` out of the predicate and
    assert it afterwards.
  - Wait on the settled state, not on `waitForLoadState` after a click.
  - Never re-click a toggle inside a retry; check `aria-expanded` on the real trigger.
  - Sleeps in disguise (`awaitQuietly` on a latch nobody counts down) are still sleeps.
  - An exception inside `Awaitility.untilAsserted` aborts the poll on the first attempt.
- **Eventual consistency.** Wait for every fixture you assert on to be indexed, not just the last
  one. Filter polls by your own FQN instead of relying on default page limits. A refetch that
  races a 202 background delete reads stale data.
- **Ordering.** Order by a total key (`change_event.offset`), never by a timestamp that ties within a
  millisecond, and never assume the server's list order.
- **A flake can be a product bug.** A test that misses 19 times in 40 because a background drain
  reads a request-scoped cache needs a server fix, not a retry. Do not fix a flake by deleting an
  assertion from a shared helper, by relaxing `toHaveText` to `>= 1`, or by adding an `.or()`
  fallback.

### A green check must have run the change

PR CI runs Java unit tests only. The ITs and Playwright run in the merge queue, so run them with
`make java_affected_run` and `make playwright_affected_run`. Also check:

- that `skip-pr-checks` or a missing `safe to test` label did not skip the job;
- that a path filter did not skip the only relevant suite;
- that a new spec directory is collected by a Playwright project;
- that each new IT and source file is owned in the impact maps.

A local Java test report where every test was skipped, or a selected class produced no report,
exercised nothing.

## Comments are not a fix

- **A comment that describes a case the code does not handle is itself the finding.** Look for
  words like *not handled*, *not supported yet*, *callers must*, *assumes*, *for now*, *known
  issue*, *TODO*, *best effort* or *retained for compatibility*, or an explanation of when the
  result is wrong, empty or null. Report the unhandled case with its trigger. The fix is a guard, a
  validation error, a typed result or an explicit failure, together with a test. Examples from this
  window:
  - a run-scope rule "enforced by a comment in one method";
  - an in-process lock whose Javadoc admits it is in-process;
  - a prop documented as ignored "for API compatibility";
  - a Javadoc assuming thirty repositories populate `service`, with nothing asserting it.

  A TODO is acceptable only with an issue link and a statement of what fails today.
- **A comment, Javadoc, ADR or PR-description claim the code does not keep** is 🔴 when someone would
  rely on it. Examples: "bounds are applied on save" while `NaN` passes, "bots need an explicit
  grant" while `DefaultBotRole` grants it, "mirrors X" above a copy that drifted. Enforce the claim,
  or correct the text.
- **A comment may record a fact the code cannot express:** an upstream format change, callers that
  live in Collate, or non-obvious test mechanics. Everything else that narrates or restates is one
  🟡 per review, listing the lines: "before the fix…", PR numbers, review-thread ids, line-number
  citations, an 8-line comment that could be 2.

## Code shape

The language rules live in `.claude/rules/` (`java.md`, `frontend-react.md`, `component-library.md`,
`frontend-styling.md`, `frontend-performance.md`, `python-ingestion.md`) and
`docs/design-patterns.md`. These are what reviewers raise most:

- **Reuse instead of forking** (38 threads in one shard). Before adding a helper, hook, component,
  REST function or query, search for the existing one: `usePaging`, `getEntityName`,
  `Fqn.unquoteName`, `ProfilePicture`, `InlineSeverity`, `EntityExtensionDAO.getExtensions`, the
  shared authorization helpers. Copies drifted inside a single PR: a copied alert renderer dropped
  `entityIdList`, so saved alerts never matched. "The legacy copy will be removed later" does not
  justify the fork.
- **One component per concept,** not a `New`/`V2` copy per page. Fix at the root, in the core library
  or the shared helper, not in each caller.
- **Typed contracts.** Pass an explicit options object (`RunOptions`) instead of mutating an entity
  copy. Use `Record<Enum, …>` instead of `Record<string, …>`. No `as unknown as`. JSON Schema is the
  source of truth.
- **Generic layers stay generic.** No entity-type branching in `AlertsRuleEvaluator`, transports or
  `EntityRepository`; use a per-type strategy, and keep provider rules behind their SPI.
- **Handle reachable cases, and only those.** Every input that can arrive gets handled in code. A
  guard for a state the contract excludes is noise. Reachability is the test: name the caller and
  the input.
- **Delete what does nothing.** Remove ignored props, no-op flags (`--status-file` accepted but
  unused), unreachable branches and components with no importer (check Collate too). Do not add
  speculative API or config knobs.
- **Fix lint instead of suppressing it.** A suppression that remains carries `-- <reason>`. Do not
  raise a bundle budget, route `force` through a helper, or quarantine a test no job runs just to get
  green.
- **Constants and generated enums over literals,** in the UI as well as Java.
- **One concern per PR.** Disclose behavior changes (a status code, a wire shape, an SPI rename, a
  default grant, a reindex requirement) in the description and the release note, and label
  `Backward-Incompatible-Change` where it applies. The description matches the diff.

## Decision records

`docs/decisions/` holds dated records of the choices that shape this codebase; its `README.md` has
the format and the triggers. Two checks, both 🔴, and they ask different questions:

- **Contradiction.** A changed line undoes an Accepted record. Read the records the touched code
  cites as `ADR:<date>-<slug>`. Either the change is wrong, or the PR adds the record that
  supersedes it.
- **Omission.** The PR makes a durable decision and no record states it. That means a contract
  another component or repository has to agree with, a new default or limit whose value was a
  judgment call, an ordering that must hold and is visible from no single file, or a rule stated
  only in the description. The repository squash-merges, so the description never reaches
  `git log`.

Not a trigger: a self-evident bug fix, a behavior-neutral refactor, a dependency bump, a test-only
change, or compliance with an existing record. **Name the rule:** state the sentence the record
would assert. Raise it once.

## Cap the nits

Report at most **six** Nits per review. If you found more, add "plus N similar items" to the summary
instead of posting them inline. If everything you found is a Nit, open the summary with "No blocking
issues."

After the first review of a PR, post 🔴 Important findings only.

## Do not report

Anything below is enforced by CI, or authors rejected it repeatedly in this window.

- **Formatting and lint**: spotless, ESLint, Prettier and organize-imports (`ui-checkstyle`), the
  UI license header, ruff, basedpyright, `generate-types` drift, Playwright lint rules, i18n
  literals.
- **Java micro-style quoted from `java.md` without a defect**: fully qualified names, `final` on
  locals, method or class length, utility classes not `final`, literals in test assertions. These
  had zero acceptances across 18 bot threads. Authors still follow `java.md` while writing; a
  reviewer does not post a finding for it. `java.md` says to *prefer* one successful return:
  flat validation guards and throws are fine, so "use one trailing return" is not a finding. Size
  rules target production code, not tests or verbatim backports.
- **`@Isolated` or `@Execution(SAME_THREAD)`** on an IT that touches process-global state. That is a
  supported group (74 IT files use it), not a breach of the concurrent-IT rule.
- **Icon imports**, except a net-new import of a glyph that `@openmetadata/ui-core-components/icons`
  already exports. Never flag service logos routed through `ServiceIconUtils.ts`.
- **Backports byte-identical to `main`.** Review only whether the backport builds and behaves on the
  target branch: modules, helpers and baselines that exist only there.
- **A bounded cache's exact cap**, and "unbounded" on per-request memos or maps keyed by a closed
  set.
- **Pre-existing behavior on touched lines**: label it pre-existing and non-blocking, or skip it.
- **Hypothetical version skew**: a runner older than the server is refused. The exception is a
  receiving schema with `additionalProperties: false`, which is a real failure.
- **i18n on Storybook stories**, loanwords, and non-user-facing identifiers.
- **Speculation**: "worth confirming", "consider whether…" or "why X?" with no failure path; design
  intent the author already stated; product or information-architecture preferences.
- **Review boilerplate**: no "Pull request overview", no per-file summary table, no reviewed-file
  count.

## Do not review these paths

- Generated code: `ingestion/src/metadata/generated/**`,
  `openmetadata-ui/src/main/resources/ui/src/generated/**` (review the JSON Schema instead),
  `**/target/**`, and `docs/generated/**` (rewritten by `make harness-check`).
- `**/yarn.lock`, `**/package-lock.json`, and lockfile-only bumps.
- `**/eslint-suppressions.json`: check only that it did not grow.
- Playwright artifacts (`playwright/output/**`, `playwright/.auth/**`), coverage output,
  `security-report/**`.
