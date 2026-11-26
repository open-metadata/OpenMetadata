# Every version names the bot of the request that wrote it

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial) · v2 2026-11-26 (port versions and legacy import display)
- **Deciders:** Pere Miquel Brull
- **Guard:** `BotImpersonationIT` (the `test_impersonated*`, `test_admin*`, `test_botDeleteThenAdminRestore*`, `test_editUndoneInItsSession*` and `test_botUndoingItsEditInItsSession*` cases, which read the versions and their change events), `ChangeRequestAdmissionIT#approvedMixedEditsLeaveBotAttributionUnset`, `ChangeRequestImportAndBulkIT#csvImportABotMakesForAUserIsStagedNamingTheBot`, `DataProductResourceIT#concurrentPortAddsKeepBothEditsAndVersions`, `ImpersonationContextTest`, `EntityUtilTest`, `SecurityUtilTest#testGetImpersonatingBot*`, `McpChangeEventUtilTest#publishChangeEvent_namesTheBotOfTheToolCall`
- **Related:** #37869, #37892, #37893, open-metadata/ai-platform#2213,
  ADR:2026-11-13-the-status-badge-says-who-set-the-status-from-version-history (amended for the
  folding rule)

## Context

A bot acting for a user (CAIP through `X-Impersonate-User`, the MCP server on every tool call)
writes as that user: `updatedBy` is the user, and `impersonatedBy` names the bot. The version
panel shows both, so the history has to say which changes a bot made. It did not. Writes that
rebuild an entity from its stored copy (delete, restore, moves, bulk and bespoke writers) set only
`updatedBy`, so they kept the bot of the previous change. Overloads that take no bot recorded
none, PUT included. CSV import recorded the importer as their own bot. An approved change request
was published without the bot that staged it, and a task a bot resolved applied its change with no
bot. Session consolidation folded edits by the same
`updatedBy` whatever bot made them, so the stored bot was only the last writer's. Writes that insert
their own change event instead of leaving it to the response filter (an approved change, asset and
port changes, the CSV summary, an async move) recorded the user and no bot, so the audit log named
no bot for them either.

## Decision

For every entity type whose schema declares `impersonatedBy`:

- A stored version's `impersonatedBy` is the bot of the request that wrote it, read from
  `ImpersonationContext` at write time: null for a direct or a system write, never copied from the
  stored entity. A write that sets `updatedBy` on a copy of the stored entity sets both through
  `EntityUtil.recordWriter`.
- A repository overload called without a bot means the current request's: the short `create`,
  `createOrUpdate`, `update`, `updateIfCurrent`, `patch` and import overloads read
  `ImpersonationContext`. A caller passes a bot explicitly only when it acts for another request:
  workflows writing as governance-bot.
- Approval publication records the requester and leaves the bot unset for both field and relation
  changes. A pending revision can combine edits from several actors. The pending request still
  records the latest stager's bot. Actor-specific approval attribution is tracked in #37892.
- Work handed to another thread runs with the submitting request's bot through
  `ImpersonationContext.propagate` (or `runAs` with a bot the job recorded), which clears it when
  the task ends.
- An update that leaves the version unchanged keeps both writer fields of the version that stays
  current.
- In-session consolidation folds only edits with the same `updatedBy` and the same
  `impersonatedBy`.
- A standalone data-product port edit archives the old version and records the request's writer
  pair on a new version, in the same transaction as the relationships and the change event. A
  port edit joins the version a mixed approval just published when the field changes advanced it.
  A retry that changes no relationships creates no version. A later field PATCH starts its own
  version because the field updater cannot replay port edits during consolidation. Port writes
  lock the data product before reading its current ports and version so simultaneous requests each
  build on the preceding commit.
- The version panel hides the impersonation row when the writer names match. Older CSV imports
  stored the importer's name in both fields.
- The change event of a write names the request that made it. The response filter takes the user
  and the bot from the request's security context. A write that records its event itself for the
  request's user takes the bot from `ImpersonationContext`: `ChangeEventHandler.entityChangeEvent`
  (column edits, Assets-tab batch edits, approved tasks), the MCP tool events, lineage edges and
  asset changes. An event a repository records for a version it stores itself, or for another
  request's change, names that version's writer pair: `getChangeEvent` without a user and
  `createAndInsertChangeEvent` take both from the entity. A hard delete stamps its deleter on the
  entity its response and async event carry.

## Consequences

For those types, directly published edits record the bot behind the request in version history,
change events, and audit rows. Pipeline status, usage and ontology workflow events, which record no
write of the entity, are outside the rule. A new write
path either goes through an overload without a bot or through `EntityUtil.recordWriter`; setting
`updatedBy` alone on a stored copy is a bug, and so is an event built with a user and no bot. A
version and its event differ in one case: an edit undone within its session returns the entity to
the version before it, which keeps that version's writers, while the event names the request that
undid it. A user who alternates their own edits and edits through a bot within the session window
gets one version per switch instead of one merged version. The rule relies on
`ImpersonationContext` being cleared at every request start and after every propagated task; a
thread that leaked a bot would attribute writes to it.

Known gaps: twenty-seven versioned types (test suites and cases, tasks, intake forms, context files
and others) have no `impersonatedBy` field and record no bot; their writers already go through
`EntityUtil.recordWriter`, so adding the field is enough (#37893). An ontology pack install job does
not carry its requester's bot yet (#37893).
