# Governance workflow run history keeps each entity's latest run and expires the rest

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `DataRetentionAppIT#test_retentionRun_deletesExpiredWorkflowRunsButKeepsEachEntitysLatest`
  (the deletion rule), `ListFilterTest#entityLinkHashCondition_matchesTheEntityLinkIndexKeyOnEachDialect`
  (the index-key text), `DataRetentionTest#workflowRunRetentionFallsBackToDefaultForConfigsSavedWithoutIt`
  (the default)
- **Related:** open-metadata/openmetadata-collate#7630, open-metadata/OpenMetadata#35920

## Context

Nothing ever deleted `workflow_instance_time_series` or `workflow_instance_state_time_series`
rows; `workflowRetentionPeriod` covers automation workflows only. A busy install reached 7M state
rows, and every read that looked runs up by entity (`entityLink`, unindexed TEXT) or states up by
`entityFQNHash` alone (no index starts with it) scanned the table and timed out. History is also
what people debug a workflow from, so it cannot simply be truncated.

## Decision

- Data Retention deletes a governance workflow run, together with all of its states, only when
  **all** hold:
  - it has ended: FINISHED, FAILURE, SUPERSEDED, CANCELLED, or EXCEPTION once
    `variables.processEnded` is set. RUNNING runs, and EXCEPTION runs Flowable may still retry,
    are never touched;
  - its `timestamp` is older than now − `workflowInstanceRetentionPeriod` days (default **30**;
    **0 keeps history forever**). Every run inside the window is kept, however many;
  - a newer run of the **same workflow definition** exists for the **same entityLink**, so each
    entity keeps its latest run of every workflow forever. Runs with no entity are grouped per
    workflow (`entityLink` null and `''` hash alike).
- States are deleted before their run, so an interruption leaves a run without states (found
  again next pass), never orphaned states. Flowable's `ACT_*` tables are not touched.
- Runs are looked up by entity through `idx_wf_instance_entity_link`, keyed on
  `md5(COALESCE(entityLink, ''))`, then `workflowDefinitionId`, then `timestamp` — on MySQL the
  first key part is the `entityLinkHash` VIRTUAL column with that definition. **Any query that
  filters runs by entity must use that exact expression**, or the index is silently skipped.
- Retention walks expired runs oldest-first in keyset pages of **1,000 runs** on
  `(timestamp, id)`, repeating the cursor as a plain `timestamp >= :afterTs` because PostgreSQL
  cannot start an index range scan from the OR tie-break alone. The existing `BatchDrain` cap of
  1,000 pages bounds one Data Retention run to about **1M runs**; a larger backlog finishes on the
  next scheduled run.
- State reads for one run filter on the indexed `workflowInstanceId`; no index on
  `(entityFQNHash, timestamp)` is added, since no read filters states by the hash alone.

## Consequences

- On upgrade, every install whose stored Data Retention config lacks the key starts expiring run
  history older than 30 days. Setting the period to 0 opts out.
- 2.0.x has no `processEnded` mark, so EXCEPTION runs are never deleted there.
- A page size near 1,000 keeps each delete a short transaction (about 6,000 state rows) while
  draining a multi-million-row backlog within a few weekly runs; revisit if runs average far more
  states than that.
- Revisit the "latest run per workflow per entity" rule if a feature needs more than the latest
  run beyond the retention window — for example an audit view of every approval ever made.
