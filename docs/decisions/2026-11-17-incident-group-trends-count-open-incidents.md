# Incident group trends show the number of open incidents over time

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial), v2 2026-11-19 (persisted open periods)
- **Deciders:** Observability
- **Guard:** IncidentGroupTrendTest, IncidentGroupTrendSqlTest, IncidentGroupsIT

## Context

The grouped Incident Manager distributed currently open incidents by creation time and
compared the two halves. Three incidents followed by one five minutes later produced a
falling arrow even though all four remained open. The recurring chip counted rising arrows,
which did not establish that a resolved problem had returned.

## Decision

- `trend` contains nine open-incident counts at equally spaced instants across the preceding
  seven days, including the start and the request-time end. `trendStart` and `trendEnd` expose
  those boundaries. Eight intervals keep the sparkline payload small while providing a shared
  time axis across groups. These are sampled counts, not every intermediate transition.
- At an instant, an incident is open when a stored period has `openedAt <= instant` and
  `closedAt > instant` (or no close time). The backfill derives periods from retained status
  history (`New`, `Ack`, `Assigned` are open), ordering equal timestamps by record id.
  Assigning, acknowledging or returning an open incident to New does not add an incident.
  Resolved incidents contribute to earlier points and stop contributing at resolution.
- Rising/Falling/Steady compares the final count with the initial count. The header says
  rising groups and counts only the loaded page. Neither label claims test execution health.
- The existing listing still selects currently open groups. Its status and incident-date
  filters select rows, but do not restrict the historical count of those groups. Otherwise
  resolved incidents and incidents already open at the start would disappear from history.
  The tooltip explains this distinction. Current test, group membership, domain, assignee and
  severity scope apply to history; historical ownership/severity reconstruction is excluded.
- Only non-deleted test cases with an incident summary are counted. Open periods survive
  routine audit-record retention while the incident survives. Deleting an individual record
  explicitly rebuilds its incident from the remaining history; deleting an incident cascades
  to its periods. Hard deletion can therefore change past counts. This is operational history,
  not an immutable audit report.
- Aggregate persisted open periods for visible group keys in one database query. Return at most
  nine counts per group. The periods are disjoint and scoped membership is deduplicated, so
  each matching period contributes one incident without a distinct-count sort.
- Maintain periods in the same transaction as the incident summary. Its upsert locks the incident
  before changing its periods. The existing repository gives live writes increasing timestamps.
  Repeated open statuses preserve the start; the first resolution sets the end. Older reopened
  chains have multiple periods, rather than a single close timestamp on the incident summary.
- Native migration 2.1.1 creates the projection for both database engines and backfills indexed
  batches of 1,000 incident ids. Each batch replaces its projection atomically; the migration
  records completion only after every batch succeeds. A retry is safe. History discarded before
  migration cannot be recovered, so backfilled periods begin at the first retained open status.

## Consequences

Three openings followed by one increase the open count; repeated failures keep it flat;
resolutions reduce it. Events inside a sampling interval may not appear as separate steps.
Groups with no currently open incidents leave the listing, as before.

Existing API consumers receive changed semantics for `trend` and `trendDirection`, and nine
samples instead of eight creation buckets. The separate daily-activity cards are unchanged.

The previous bounded-history query still took about 13.8 seconds for a single definition with
roughly 100,000 incidents on the local scale fixture. Persisting periods moves reconstruction
to a one-time upgrade; live writes touch only the affected incident. The tradeoff is a new
table and transactional projection maintenance. It is not a periodically refreshed count cache.
