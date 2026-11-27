# Incident cards describe their counts as daily activity

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Observability, UI team
- **Guard:** reviewer
- **Related:** open-metadata/openmetadata-collate#8576, #37830, #37916;
  supersedes ADR:2026-11-16-incident-cards-show-the-latest-day-and-open-counts-new-ack-assigned

## Context

The previous record had each incident card's description say its number covers "the latest day
with activity" (Open and Resolved) or "days with activity" (response and resolution time). Product
team chose shorter copy that names what each card counts and that it is daily activity, without the
day qualifier.

## Decision

- The descriptions are:
  - Open Incidents: "New, Acknowledged and Assigned incidents with daily activity"
  - Resolved Incidents: "Incidents resolved with daily activity"
  - Response Time: "Average response time with daily activity in the period"
  - Resolution Time: "Average resolution time with daily activity in the period"
- Everything else in the previous record still holds:
  - The Open and Resolved cards (`IncidentTypeAreaChartWidget`) show a daily trend of status events.
    The headline is the latest UTC day that has events, not a total or a current-state count.
  - The response and resolution time cards average the daily values across days with activity in
    the selected period.
  - The Open card counts `New`, `Ack` and `Assigned` events (`OPEN_INCIDENT_STATUS_TYPES`), once
    per incident per day.
  - The Open card on the Data Quality dashboard links to the incident list without a status filter.

## Consequences

- The Open and Resolved descriptions no longer say which day the headline covers. A reader can
  take the number as a total over the period, the misreading the previous record's wording
  addressed. That trade-off was accepted for the shorter copy; restoring a day qualifier is a wording
  change that needs a new record.
- Showing current state (matching the list) remains rejected: the cards show daily activity.
- Days are UTC buckets; using the viewer's time zone needs `time_zone` on the aggregation, which is
  backend work and out of scope.
