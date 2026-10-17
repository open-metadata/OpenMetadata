# Projection capture records each mutation's facts in the writing transaction, and ships inactive

- **Status:** Accepted
- **Revisions:** v1 2026-10-07 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `RepositoryCaptureBoundaryIT`, `ProjectionCaptureTransactionIT`, `EntityMutationCaptureIT`,
  `EntityFqnRewriteIT`, `ProjectionJournalIT`, `ProjectionJournalRetentionIT` and the
  `*CaptureContractTest` unit tests
- **Related:** `docs/plans/2026-10-06-database-search-indexing-design.md`,
  `docs/plans/2026-10-06-database-projection-implementation.md` (stage 2),
  ADR:2026-10-07-repository-writes-commit-once-and-publish-effects-after-the-commit

## Context

A projection (search, RDF) rebuilt from committed database state needs to know which entities a
commit changed, including the ones a write changes only indirectly: renamed descendants,
relationship and tag-usage members, field relationships and extensions. Recording that after the
commit loses it when the process dies between the two; recording one fact per affected row made a
rename of 10,000 descendants about five times slower.

## Decision

- Capture runs inside the writing transaction, through decorators on the entity, relationship,
  tag-usage, field-relationship and extension DAOs, and writes facts to
  `metadata_projection_mutation`; a fact commits or rolls back with the rows it describes.
- An FQN prefix rewrite records one prefix fact. Prefix updates are single parameterized
  statements (`FqnPrefixRewrite` for the entity tables), which capture can read.
- Consumer progress (`metadata_projection_consumer`) and work (`metadata_projection_work`) are kept
  apart from the facts, so one consumer cannot acknowledge another's work; retention keeps a fact
  until every consumer registered for it has passed it.
- Then relationship, tag-usage, field-relationship and extension facts are purged, and so is an
  entity fact that retires no former FQN. Prefix rewrites, and entity facts that retire a former
  FQN, are the only record of the names descendants and deleted entities had, so they stay as
  locator anchors: retention deletes their consumer rows, and purges an entity anchor only once a
  newer anchor for the same entity carries both of its locators.
- Owner lookup fails rather than truncate when one hash resolves to more than 1000 historical
  locators. A transaction's capture buffer flushes at 1000 entries or 1 MiB; a claim takes 1 to
  1000 rows on a lease of at most 10 minutes; a retry waits at most an hour; a retention pass scans
  pages of 100 and deletes at most 1000 rows.
- The journal ships inactive: nothing in production installs the capture plugin until a consumer
  reads it.

## Consequences

The 2.2.0 migration creates the journal tables on every install, empty until capture is turned on.
A new write path that bypasses the decorated DAOs (a raw `Handle` batch, a `@SqlUpdate` on another
interface) is invisible to capture and must be routed through them before capture is enabled.
Turning capture on is a separate decision with its own performance budget. Locator anchors grow with
renames and deletes until compacted, and a hash whose history resolves to more than 1000 locators
fails owner lookup instead of resolving part of it.
