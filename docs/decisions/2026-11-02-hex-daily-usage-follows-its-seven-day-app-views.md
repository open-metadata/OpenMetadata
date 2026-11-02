# Hex dashboard usage is derived so OpenMetadata's weekly count equals Hex's seven-day app views

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial); v2 2026-11-02 (a day with no row gets a zero)
- **Deciders:** Hex connector maintainers (review of the Hex components, run history and app views PR)
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_hex_components_runs_usage.py`
  (`test_weekly_usage_follows_hex`, `test_views_that_age_out_still_write_the_day`)
- **Related:** ADR:2026-11-02-run-changing-dashboard-custom-properties-are-patched-after-the-dashboard

## Context

OpenMetadata stores dashboard usage as a count per day and derives the 7- and 30-day sums from
those rows; a usage PUT adds to the day's count. Hex reports only rolling totals per app
(`appViews.lastSevenDays`, `lastFourteenDays`, `lastThirtyDays`, `allTime`), never a day's views.
The Looker and Tableau pattern, the cumulative total minus the latest stored day's count, subtracts
a daily figure from a cumulative one and goes wrong from the third run.

## Decision

- Today's count is `max(0, lastSevenDays − the six previous days already stored)`, read through
  `GET /v1/usage/dashboard/{id}?days=7`.
- Because a PUT adds, only what today doesn't hold yet is sent. A second run on the same day sends
  nothing when that is zero or negative, but the first run of a day sends a zero: the dashboard's
  usage summary is its latest row's, so without a row for today views that aged out keep showing.

## Consequences

- OpenMetadata's weekly count matches Hex's seven-day count after every run, and a skipped day
  catches up on the next run.
- The split across days is approximate: the first run puts the whole week on its day, and views
  from days without a run land on the next run's day. The 30-day count is approximate for the same
  reason.
- Hex updates `allTime` as views happen but `lastSevenDays` later, so usage lags Hex's own refresh
  of that window.
- Each dashboard costs one usage read per run when `includeUsage` is on.
