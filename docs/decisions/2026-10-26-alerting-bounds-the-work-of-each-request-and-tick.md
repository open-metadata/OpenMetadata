# Alerting bounds the work of each request and each tick, and an alert stored past a bound stays editable

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `AlertLimitsTest`, `AlertLimitsConsistencyTest`, `AlertConfigLimitsIT`, `AlertListingLimitsIT`, `ChangeEventReadBudgetTest`, `ChangeEventReadBudgetIT`, `RenderBudgetTest`, `ChatRenderBudgetIT`, `DiagnosticsTest`, `PendingCountsTest`, `TestSendsTest`, `BoundedTestSendsIT`, `DeadlineConnectorTest`, `MailQueuesTest`, `AuditLogConsumerTest`
- **Related:** [PR #36279](https://github.com/open-metadata/OpenMetadata/pull/36279); `alerting.AlertLimits`, `alerting.content.render.RenderLimits`, `ChangeEventDAO.listWithOffset`

## Context

Alert work grew with what an alert held, what a request asked for, or what a user wrote: a
stored `batchSize` went straight to SQL, every change event embeds its whole entity, the alert
page evaluated every unread event on each view, chat rendering padded tables without limit,
and sends had no total deadline. One request or one tick could therefore fill the heap or hold
threads forever, and alert listings are readable by every user.

## Decision

Every such path has a fixed bound, chosen well above what the UI or a normal alert uses:

| What | Bound |
|---|---|
| An alert's `batchSize` | 1 to 1000 |
| Destinations per alert or per test send | 50 |
| Receivers per destination | 100 listed entries: typed addresses, or user and team names, since each name is looked up on every event; who a team expands to is not counted |
| Rows per alert event listing | 1000, and no embedded `entity` |
| One change-event read | 1000 rows and 8 MB of event JSON, always at least one event |
| Unread events evaluated per pending count | 500; past that the response sets `countsAreLowerBound` (`relevantUnprocessedEventsCountIsLowerBound`) and the page shows "N+" |
| Pending counts | 4 running and 16 waiting across the server, then 429 |
| Test sends | 30 s per request, 8 requests at once, then 429 |
| One outbound HTTP exchange | its connect plus read timeout in total, and a 1 MB response body |
| Chat rendering | 200,000 HTML characters, depth 48, 50,000 Markdown characters and 50,000 table cells |
| Mail | one thread and a bounded queue each for notification and account mail; a full queue makes the caller send |

A short read is not the end of the backlog: callers decide they are caught up from offsets,
never from a read returning fewer rows than asked.

A message past the chat rendering bound is not sent. On an event it is recorded as that
event's failure for that channel; on a template test send it is answered as a body error, so a
template too large on its own is caught before it is saved.

A stored alert's bounds are checked by `AlertLimits` on every save, and a save may only refuse
a value that grows past a bound. An alert stored past one, before the bound existed, keeps its
value and stays editable. The create schema therefore states no bound, because PUT sends it
for existing alerts; the schemas of requests that are never stored do.

Receivers are judged for the whole alert, never by matching a destination to its stored
version, because a PUT gives every destination a new id. A save is refused when the receivers
past the limit, summed over the alert's destinations, exceed what the stored alert held. So an
alert stored past the limit can keep or trim its lists on any save, but cannot add a receiver,
copy a list into another destination, or reuse what one destination gave up.

## Consequences

No input can make one request or one tick unbounded, and an upgrade locks no existing alert.
API clients see a 400 past a bound and a 429 under load. Raising a bound means changing its
constant and, for a test-send schema, the same number there; the guard tests fail otherwise.
Revisit a bound when real data comes near it.
