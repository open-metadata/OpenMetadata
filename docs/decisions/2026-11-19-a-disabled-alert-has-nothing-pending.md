# A disabled alert is not running: it has nothing pending, and every report says it is disabled

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `AlertProgressTest`, `AlertDeliveryIT.alertSwitchedBackOnSendsOnlyWhatHappensFromThen`, `AlertDeliveryIT.alertCreatedOffWithAPositionAnOlderReleaseWroteHasNothingPending`, `AlertStateIT.diagnosticsReadCreatesNoRow`
- **Related:** OM PR #24866 (position read from the database), OM PR #32589 (2.0.2: a read saves a missing position), OM PR #36279 and OM PR #38094 (pending count capped at 500)

## Context

Disabling an alert removes its job, so its position row stops where the alert stopped.
Re-enabling skips the backlog (`EventSubscriptionRepository.postUpdate` calls
`AlertRecord.skipBacklog`), so what happens while the alert is off is never sent. Every reader of
"what is unread" still counted from the frozen row, so a disabled alert reported a backlog that
would never be sent: "500+" pending on its page, unread events in its diagnostics, and a lag that
grew with every change event on the platform.

A disabled alert gets such a row in two ways. One that ran and was then switched off keeps the row
where it stopped. One created switched off never runs, but releases 2.0.2 to 2.0.x saved a row at
the latest offset the first time anything read its position (`AlertUtil.getStartingOffset`), so the
first page view froze it there; an upgrade carries those rows over. A customer alert created
switched off had such a row, 78k events behind, and loading its page ran the server out of memory
before the 500 cap existed.

Moving the row at disable time is not enough, because events keep arriving while the alert is off.
Keeping the row at the latest offset would need a write for every change event, or a sweep, and
would make a second copy of what the `enabled` flag already says. Reporting a disabled alert as
simply caught up is not enough either: its page would then look like a healthy alert with nothing
to do, and the only response that said it was disabled was the scheduling view.

## Decision

A disabled alert is not running. Pending means the events an alert will still process, so it is 0
for a disabled alert, whose next run starts from the latest event; and every response that reports
an alert's progress states the state explicitly, through the same `enabled` field the alert and its
scheduling view already carry. No new status value is introduced, and every count stays a number.

`AlertProgress.of` is the one read model of an alert's progress, and every reader of what is
pending, unread or behind goes through it. For a disabled alert that reads change events it
reports nothing pending or unread and `hasProcessedAllEvents` true, as `processedEvents` does,
whatever its position row says. It still reports `currentOffset` and `startingOffset` as stored,
since support needs the real position. What the alert handled before it was switched off is still
counted from its rows. The events record and the diagnostics carry `enabled`, so a client shows the
alert as disabled rather than as idle.

The position row itself is left as it is: it belongs to the alert's ticks, which only run while it
is enabled, and `skipBacklog` on re-enable stays the one write that decides where the alert resumes.
Nothing that reports what an alert has pending, unread or behind reads the position row directly;
`EventSubscriptionScheduler.getEventSubscriptionOffset` returns the stored row as it is, for tests
and tools that need the raw position.

Reading never writes a position. Only these write one: scheduling an enabled alert
(`AlertJobs` calls `AlertRecord.start`, which inserts only when absent), its ticks (compare and set,
never an insert), and `skipBacklog`, called when an alert is switched on, by the `syncOffset`
endpoint and command an admin runs, and by the 2.1.0 backlog migration, which skips disabled alerts.
An alert created switched off has no row until it is first switched on.

## Consequences

- Alerts that were already disabled before this rule report nothing pending with no migration,
  because the rule is evaluated on every read from the alert's own row, whichever way their row
  was written. Switching one on still skips its row to the latest offset, so neither shape replays.
- The rule holds on every replica: it reads only the alert row, bypassing the caches, and database
  rows, so no node needs in-memory state, which is why OM PR #24866 moved the position to the
  database.
- Between the commit that re-enables an alert and its `skipBacklog`, a reader can see the old
  backlog for a moment. The page's count is capped at 500, so the cost is bounded.
- A new reader of an alert's progress must go through `AlertProgress`; reading the position row
  directly would bring the phantom backlog back for disabled alerts.
- A screen that shows an alert's counts reads `enabled` beside them and says the alert is disabled;
  a 0 pending count alone does not tell a disabled alert from an idle one.
