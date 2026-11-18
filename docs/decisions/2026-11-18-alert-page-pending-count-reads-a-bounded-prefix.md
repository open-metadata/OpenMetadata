# The alert page's pending count evaluates at most 500 unread events and 8 MB of them

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial, 2.0 only)
- **Deciders:** Adrià Manero
- **Guard:** `EventSubscriptionPendingCountTest`, `ChangeEventReadBudgetTest`, `AlertPendingCountIT`
- **Related:** [PR #36279](https://github.com/open-metadata/OpenMetadata/pull/36279) (the same
  bound on main, recorded there as `2026-10-26-alerting-bounds-the-work-of-each-request-and-tick`),
  [PR #36343](https://github.com/open-metadata/OpenMetadata/pull/36343) (its 2.1 backport);
  `EventSubscriptionScheduler.countRelevantUnprocessedEvents`,
  `ChangeEventDAO.listWithOffsetWithinBudget`

## Context

Opening an alert's page asks for `eventsRecord`, whose pending count read every change event on
the platform after the alert's position in one query, then checked each against the alert's
rules. Every change event embeds the whole entity that changed, and an alert reads only
`batchSize` events per `pollInterval`, so during heavy ingestion its backlog grows without limit.
One page view could then load gigabytes and run the server out of heap. Main and 2.1 bound this
inside the alerting redesign, which 2.0 does not have, so 2.0 needs its own bound.

## Decision

- The pending count reads the first 500 unread events after the alert's position, in offset
  order, and stops earlier once their stored JSON passes 8 MB, always reading at least one event.
  It reads their sizes first and loads only the JSON of the events within the budget.
- Events written after the request read the latest offset are not counted, so a count that stops
  at them is still exact.
- When unread events remain past the read, the response sets `countsAreLowerBound` and the alert
  page shows the total and pending counts as "N+". The failed and successful counts are exact.
- The numbers match main's, so the page reads the same on 2.0, 2.1 and later.

## Consequences

- A large backlog shows "500+" (or fewer, with large events) instead of an exact count.
- The consumer's own tick read, `batchSize` and `diagnosticInfo` keep their 2.0 behaviour; main's
  other bounds are not carried to 2.0.
