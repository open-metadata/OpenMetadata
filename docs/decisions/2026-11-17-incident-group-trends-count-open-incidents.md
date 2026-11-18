# Incident group trends show the number of open incidents over time

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
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
- At an instant, the latest retained status for each incident determines whether it is open
  (`New`, `Ack`, `Assigned`). Order equal timestamps by record id, matching incident history.
  Assigning, acknowledging or returning an open incident to New does not add an incident.
  Resolved incidents contribute to earlier points and stop contributing at resolution.
- Rising/Falling/Steady compares the final count with the initial count. The header says
  rising groups and counts only the loaded page. Neither label claims test execution health.
- The existing listing still selects currently open groups. Its status and incident-date
  filters select rows, but do not restrict the historical count of those groups. Otherwise
  resolved incidents and incidents already open at the start would disappear from history.
  The tooltip explains this distinction. Current test, group membership, domain, assignee and
  severity scope apply to history; historical ownership/severity reconstruction is excluded.
- Only non-deleted test cases with retained history are counted. A hard deletion can therefore
  change past counts. This is operational history, not an immutable audit report.
- Aggregate status intervals for the visible group keys in one database query. Return at most
  nine counts per group. No per-incident API requests or new snapshot storage are introduced.

## Consequences

Three openings followed by one increase the open count; repeated failures keep it flat;
resolutions reduce it. Events inside a sampling interval may not appear as separate steps.
Groups with no currently open incidents leave the listing, as before.

Existing API consumers receive changed semantics for `trend` and `trendDirection`, and nine
samples instead of eight creation buckets. The separate daily-activity cards are unchanged.
