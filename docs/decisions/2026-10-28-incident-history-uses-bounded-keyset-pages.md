# Incident state history uses bounded keyset pages when a limit is supplied

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `IncidentHistorySqlTest`, `TestCaseResolutionStatusRepositoryTest`,
  `StaleIncidentStatusIT.historyLimitAndCursorKeepOlderEventsReachable`, and
  `ActivityFeedProvider.test.tsx`
- **Related:** PR #36442

## Context

Incident timelines requested a limit that the state-history endpoint ignored. Newest-record
consumers also loaded and hydrated complete histories. Enforcing the requested limit requires a
continuation mechanism so existing timeline events remain accessible.

## Decision

- `GET /v1/dataQuality/testCases/testCaseIncidentStatus/stateId/{stateId}` accepts an optional
  `limit` from 1 to 1,000,000, matching the backend's existing upper limit convention. Omitting
  it retains the complete-history response; there is no new default cap.
- Bounded reads are ordered by `timestamp DESC, id DESC`. IDs distinguish events from the same
  test case that share a timestamp. SQL applies the keyset predicate and limit before JSON
  deserialization or test-case reference hydration.
- Clients follow the opaque `paging.after` value to reach older events. Its current encoding is
  URL-safe Base64 of `timestamp|id`; clients must not construct or interpret it. An `after` cursor
  requires an explicit limit. It does not depend on the cursor row still existing.
- A page returns at most `limit` resolvable events. Orphaned events whose parent test case cannot
  be resolved are skipped. For bounded responses, `paging.total` counts stored rows, including
  these orphans. For an unlimited response it retains the existing returned-event count.
- Continuation follows the last consumed stored row, preserving fetched but unconsumed events.
  One extra row determines continuation. A final page can be empty when its remaining stored
  events are all orphans; its continuation is then exhausted.
- Latest-record reads start with SQL `LIMIT 1` and omit both lookahead and history counts. After
  an orphan, they scan batches of 100. Bounded history scans use `max(remaining requested events,
  100)` after encountering orphans, plus one lookahead row. The value 100 is an internal tuning
  choice that reduces round trips while bounding prefetched JSON; it is not a client guarantee.
- The timeline merges loaded pages by record ID in ascending `(timestamp, id)` order. Loading
  older events preserves the latest status, and the load-more control disappears at exhaustion.

## Consequences

Explicit limits bound retrieval without removing access to older events. Existing unlimited
consumers retain their behavior. Skipped orphans still require reference resolution, and stored
row counts still require a count query. Changing public ordering, omitted-limit behavior, or total
semantics requires revisiting this record. Adjusting the internal batch size requires measurements
and an amendment recording the new trade-off.
