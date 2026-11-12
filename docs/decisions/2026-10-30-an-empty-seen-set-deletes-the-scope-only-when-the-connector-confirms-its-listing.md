# An empty seen-set deletes the whole scope only when the connector confirms its listing

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** harshsoni2024
- **Guard:** `BulkDeleteStaleIT` (`test_emptySeenFqns_withPopulatedScope_deletesNothing`, `test_emptySeenFqns_withAllowFlag_deletesWholeScope`), `ingestion/tests/unit/topology/test_delete_stale.py`, `ingestion/tests/unit/topology/dashboard/test_powerbi_confirmed_listing.py`
- **Related:** PowerBI `dataModelFilterPattern` matching no data model left every previously ingested one in place

## Context
`deleteStale` soft-deletes the entities in a scope that the connector did not report in the run.
Since 2.0.0 the server treats an empty `seenFqns` as zero deletions: it cannot tell a source that
holds nothing, or a filter that excludes everything, from a listing that failed. That guard
matters because connectors often turn a failed API call into an empty list. PowerBI's workspace
and per-workspace fetches return `None` on error and the source used to flatten it to `[]`, so an
expired secret or throttling looked like an empty tenant. The guard also meant that a run whose
filters excluded every data model, or whose source no longer had any, never deleted the ones
ingested before.

## Decision
- `BulkDeleteStaleRequest.allowEmptySeenFqns` (default `false`) lets the client declare an empty
  `seenFqns` authoritative; the server then treats every entity in the scope as stale. Without
  it, an empty `seenFqns` still deletes nothing.
- The client sends the field only when `seenFqns` is empty and the connector's `SourceListing`
  confirms there is nothing to ingest: the listing was marked complete, nothing marked it failed,
  and every listed entity was filtered out (zero listed counts).
- PowerBI is the only connector that marks a listing complete. It does so after a workspace loop
  that processed at least one workspace, and marks it failed when a workspace, per-workspace or
  scan fetch fails, when a workspace is missing from its scan, or when the workspace listing comes
  back shorter than its count. Zero workspaces is never a confirmation: the non-admin API returns
  only the workspaces the principal can access, so lost access looks like an empty tenant.
- Data models are confirmed only when `includeDataModels` is on.

## Consequences
A PowerBI run whose filters exclude every dashboard or data model, or whose workspaces no longer
hold any, soft-deletes the existing ones when `markDeletedDashboards` / `markDeletedDataModels`
is on, as a run that still saw one entity already did. The next run that lists them restores them.
Other connectors are unchanged until they mark a listing complete, which they should do only when
their listing calls report failure instead of returning an empty list. Servers that predate the
field reject it, so a newer client against one of them reports a failed delete step and deletes
nothing in that one case.
