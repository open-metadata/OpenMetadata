# Incident status cards show the latest day's events, and Open counts New, Ack and Assigned

- **Status:** Superseded by ADR:2026-11-16-incident-cards-describe-their-counts-as-daily-activity
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Observability, UI team
- **Guard:** reviewer
- **Related:** open-metadata/openmetadata-collate#8576

## Context

The Open Incidents and Resolved Incidents cards (Incident Manager and the Data Quality dashboard,
both `IncidentTypeAreaChartWidget`) count status events per UTC day over the last 60 days, using a
`date_histogram` with a cardinality of `stateId` on the `testCaseResolutionStatus` index. The
headline number is the last bucket. The incident list shows each incident's current status with no
date limit. A customer read the Open card (15) as the number of open incidents (about 1,200) and
filed it as a bug. The Open card also counted only `New` events, so incidents that were
acknowledged or assigned never appeared in it.

## Decision

- The cards keep showing a daily trend of status events. The headline stays the latest day that has
  events. It is not a total or a current-state count.
- The Open card counts `New`, `Ack` and `Assigned` events (`OPEN_INCIDENT_STATUS_TYPES` in
  `constants/TestSuite.constant.ts`, the same list the data-quality indicator uses). The cardinality
  on `stateId` counts an incident once per day even when it moves through several of these statuses
  that day.
- Each card has a description saying what it counts and that the number is for the latest day with
  activity.
- The Open card on the Data Quality dashboard links to the incident list without a status filter.
  The list filters by one status, so a `New` filter would show fewer incidents than the card counts.

## Consequences

- The Open number goes up after this change, which the card's description explains.
- Showing current state (matching the list) was considered and rejected: the cards are meant to
  show daily activity. Changing that requires a new record.
- Days are UTC buckets. Users far from UTC can see evening events on the next day's bucket. Fixing
  that needs `time_zone` on the aggregation, which is backend work and out of scope.
