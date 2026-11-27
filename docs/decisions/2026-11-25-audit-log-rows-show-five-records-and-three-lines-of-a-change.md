# Audit log rows show at most five records and three lines of a change

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial)
- **Deciders:** Rohit Jain, design review
- **Guard:** `AuditLogList.test.tsx` ("should cap records and say how many are hidden", "should show an update inline as struck-through old → highlighted new") and `AuditLogList.utils.test.ts` (`MAX_RECORDS`)
- **Related:** #38210, #38290, #38686, #38687

## Context
The Audit Logs list renders each field change from the event's `changeDescription`. Some values
are unbounded: a description can run to many paragraphs, and a list-valued field such as
`testCaseResultSummary` can hold dozens of objects. Rendered in full, a single row can fill the
screen and push every other event out of view, which defeats a list meant for scanning.

## Decision
In a list row (`components/AuditLog/AuditLogList`):
- a list-valued field change shows at most `MAX_RECORDS` = **5** records, followed by
  "+ N More" for the rest;
- a text value (a description, or either side of an `old → new` update) is clamped to
  **three lines**.

The full value is not available from the list row. The API (`GET /api/v1/audit/logs`) and the
Export JSON are unchanged and always carry the complete value.

## Consequences
Rows stay scannable, and the page height no longer depends on the size of one change. An auditor
who needs a value beyond the cap or clamp reads it from the Export or the API. Revisit if the page
gains a per-event detail view (the follow-up in #38210), which is the place to show full values.
