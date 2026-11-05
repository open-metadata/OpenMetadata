# A data-migration backfill walks its table's ids in primary-key batches of 500, never one statement over the whole table

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Shreyansh Verma
- **Guard:** `IdBatchesTest`, `CreationAuditMigrationTest`; reviewer for new backfills
- **Related:** `migration/utils/IdBatches`; v210 `CreationAuditMigration`, `DataQualityDimensionMigration`

## Context

The 2.1.0 creation-audit backfill was one `UPDATE … JOIN` over every version row of every table.
On a tenant with about 115k tables it ran for minutes and was killed by the database
(`Query execution was interrupted`) at the same point on every attempt: a single statement keeps
none of its work when killed, so a retry starts from zero. Under `migrate --force` the failure is
recorded and the version marked applied, but the data migration's identity is not, so the server
then refuses to start with "pending migrations" and no re-run can get past the statement.

## Decision

A data migration that backfills rows of a table it does not bound by an indexed predicate walks
that table's ids through `IdBatches.fold`: keyset pages of 500 ids (`id > :afterId ORDER BY id
LIMIT 500`, never `OFFSET`), one statement or statement pair per page restricted to the page's ids
(`id IN (<ids>)`), each committing on its own. The step is written so a page already done is
skipped (an "is still absent" predicate), so a run cut short resumes by re-walking cheaply.

500 matches the v210 `ConversationMigration` batch, keeps an `IN` list well under every engine's
bind limit, and keeps each statement's run time independent of the table's size.

## Consequences

No backfill statement grows with the tenant, so a database-side long-query reaper cannot pin a
migration in a fail-and-retry loop, and an interrupted run keeps its committed pages. The cost is
one keyset read per page plus the per-page statements, more round trips than one statement on a
small table. Revisit if a backfill needs cross-row logic a page cannot see.
