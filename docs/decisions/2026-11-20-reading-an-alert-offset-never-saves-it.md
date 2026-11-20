# Reading an alert's offset never saves it on 2.0

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `AlertOffsetReadTest`, `AlertCreatedDisabledIT`
- **Related:** OM PR #32589 (2.0.2: the offset is saved when an alert starts), ADR:2026-11-18-alert-page-pending-count-reads-a-bounded-prefix

## Context

Since 2.0.2, `AlertUtil.getStartingOffset` saves an offset at the latest change event when none is
stored, so restarts and edits stop moving an alert's watermark forward. The alert's details page and
diagnostics read the offset through `EventSubscriptionScheduler.getEventSubscriptionOffset`, which
called the same method. Reading the page of an alert created disabled, which has never run, therefore
saved an offset there. When the alert was enabled weeks later it started from that saved offset and
sent every change since the first page view, and its page showed that backlog as pending meanwhile.

## Decision

Reads go through `AlertUtil.storedOffsetOrLatest`, which never writes: an alert with no stored offset
reads as standing at the latest offset, as it did before 2.0.2. `getStartingOffset`, which saves, is
called only where an enabled alert is scheduled (`EventSubscriptionScheduler.jobBuilder`) or run
(`AbstractEventConsumer`).

## Consequences

- An alert created disabled has no offset until it is enabled, and then starts from that moment.
- Offsets that reads already saved on 2.0.2 to 2.0.x are left as they are. Such an alert still sends
  the changes since that save when it is enabled; `syncOffset` moves it to the latest offset first.
- 2.1 and later read the offset through a read-only lookup too, and also skip the backlog when any
  disabled alert is enabled again, so this record covers the 2.0 line only.
