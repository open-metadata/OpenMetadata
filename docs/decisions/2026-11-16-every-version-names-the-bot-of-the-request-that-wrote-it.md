# Every version names the bot of the request that wrote it

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `BotImpersonationIT` (the `test_impersonated*`, `test_admin*`, `test_botDeleteThenAdminRestore*` and `test_editUndoneInItsSession*` cases, which read the versions and, for writes that insert their own change event, that event), `ChangeRequestAdmissionIT#approvedChangeABotStagedForAHumanIsPublishedNamingTheBot`, `ChangeRequestImportAndBulkIT#csvImportABotMakesForAUserIsStagedNamingTheBot`, `ImpersonationContextTest`, `EntityUtilTest`
- **Related:** #37869, #37892, #37893, open-metadata/ai-platform#2213

## Context

A bot acting for a user (CAIP through `X-Impersonate-User`, the MCP server on every tool call)
writes as that user: `updatedBy` is the user, and `impersonatedBy` names the bot. The version
panel shows both, so the history has to say which changes a bot made. It did not. Writes that
rebuild an entity from its stored copy (delete, restore, moves, bulk and bespoke writers) set only
`updatedBy`, so they kept the bot of the previous change. Overloads that take no bot recorded
none, PUT included. CSV import recorded the importer as their own bot. An approved change request
was published without the bot that staged it. Session consolidation folded edits by the same
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
  workflows writing as governance-bot, an approved change request published with the bot that
  staged it.
- Work handed to another thread runs with the submitting request's bot through
  `ImpersonationContext.propagate` (or `runAs` with a bot the job recorded), which clears it when
  the task ends.
- An update that leaves the version unchanged keeps both writer fields of the version that stays
  current.
- In-session consolidation folds only edits with the same `updatedBy` and the same
  `impersonatedBy`.
- A change event a repository inserts itself names the writer pair of the version it records:
  `getChangeEvent` without a user and `createAndInsertChangeEvent` take both from the entity. An
  event named for the request's user (asset changes) carries the request's bot.

## Consequences

For those types, the version panel names the bot behind every version a bot wrote, and only
those; the change event and audit row of each write a bot made name it too. Pipeline status, usage
and ontology workflow events, which record no write of the entity, are outside the rule. A new write
path either goes through an overload without a bot or through `EntityUtil.recordWriter`; setting
`updatedBy` alone on a stored copy is a bug, and so is an event built with a user and no bot. A user
who alternates their own edits and edits through a bot within the session window gets one version
per switch instead of one merged version. The rule relies on `ImpersonationContext` being cleared
at every request start and after every propagated task; a thread that leaked a bot would attribute
writes to it.

Known gaps: twenty-seven versioned types (test suites and cases, tasks, intake forms, context files
and others) have no `impersonatedBy` field and record no bot; their writers already go through
`EntityUtil.recordWriter`, so adding the field is enough (#37893). An ontology pack install job does
not carry its requester's bot yet (#37893). A pending change request still folds a user's own
changes and a bot's changes for them into one request (#37892).
