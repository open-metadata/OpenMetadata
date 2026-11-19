# A disabled alert has nothing pending, and its progress is read from its enabled flag

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `AlertProgressTest`, `AlertDeliveryIT.alertSwitchedBackOnSendsOnlyWhatHappensFromThen`
- **Related:** OM PR #24866 (position read from the database), OM PR #36279 and OM PR #38094 (pending count capped at 500)

## Context

Disabling an alert removes its job, so its position row stops where the alert stopped.
Re-enabling skips the backlog (`EventSubscriptionRepository.postUpdate` calls
`AlertRecord.skipBacklog`), so what happens while the alert is off is never sent. Every reader of
"what is unread" still counted from the frozen row, so a disabled alert reported a backlog that
would never be sent: "500+" pending on its page, unread events in its diagnostics, and a lag that
grew with every change event on the platform. A customer alert disabled for three weeks was 78k
events behind, and loading its page ran the server out of memory before the 500 cap existed.

Moving the row at disable time is not enough, because events keep arriving while the alert is off.
Keeping the row at the latest offset would need a write for every change event, or a sweep, and
would make a second copy of what the `enabled` flag already says.

## Decision

`AlertProgress.of` is the one read model of an alert's progress, and every reader of what is
pending, unread or behind goes through it. It reads a disabled alert that reads change events as
standing at the latest offset with nothing unread, whatever its position row says, the way it
already reads a self-driven consumer. What the alert handled before it was switched off is still
counted from its rows.

The position row itself is left as it is: it belongs to the alert's ticks, which only run while it
is enabled, and `skipBacklog` on re-enable stays the one write that decides where the alert resumes.
Code outside the ledger does not read the position row to describe an alert's progress.

## Consequences

- Alerts that were already disabled before this rule report nothing pending with no migration,
  because the rule is evaluated on every read from the alert's own row.
- The rule holds on every replica: it reads only the alert row, bypassing the caches, and database
  rows, so no node needs in-memory state, which is why OM PR #24866 moved the position to the
  database.
- Between the commit that re-enables an alert and its `skipBacklog`, a reader can see the old
  backlog for a moment. The page's count is capped at 500, so the cost is bounded.
- A new reader of an alert's progress must go through `AlertProgress`; reading the position row
  directly would bring the phantom backlog back for disabled alerts.
