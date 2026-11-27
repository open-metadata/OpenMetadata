# PowerBI report pages are charts named by report id and page name

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `test_reports_sharing_a_page_name_get_distinct_charts`,
  `test_report_url_is_built_from_the_one_pages_call`, `test_failed_pages_read_keeps_the_report_stored_charts`,
  `test_report_whose_charts_cannot_be_read_is_left_as_stored` and
  `test_report_without_pages_lets_its_stored_charts_go` in
  `ingestion/tests/unit/topology/dashboard/test_powerbi_report_pages.py`
- **Related:** issue #35965

## Context
PowerBI dashboards carried their tiles as charts, but reports had none. A report's pages come from
Get Pages In Group, whose page `name` is unique only within its report: the API's own example
answers `ReportSection` and `ReportSection1`, names any report can have. A chart's FQN is
`service.chartName`, so a bare page name would collide across reports. The connector already called
the pages API once per report, to open the report URL on its first page.

## Decision
Each page of a filtered report is a chart named `{report_id}_{page.name}` and listed under its
report; a page without a `name` is skipped. The pages response is fetched at most once per report
per workspace (`WorkspaceState` memoises it until the workspace exits), and both the chart stage
and the report URL use that response.

An answer with no pages is the report's real state, so its old page charts go. A read that fails
(an error status, a transport error, an unreadable body) is not: for that run the report keeps the
charts the server already lists under it, in the run's live set, so `markDeletedCharts` does not
soft-delete them, and in the report's `charts`. When the server cannot list them either, the
report's charts are unknown: it is not sent, so its stored charts stay linked, and the run skips the
stale-chart pass, since a failed discovery never drives deletion.

## Consequences
Reports gain chart-level metadata without any extra API call. The name is the chart's identity
across runs: changing its format re-creates every page chart under a new FQN and, with
`markDeletedCharts`, soft-deletes the old ones together with their curated metadata.

A transient failure no longer soft-deletes a report's page charts only for the next run to restore
them, at the cost of one server read per report whose pages fail. Failing the step for each such
report was rejected: with the admin APIs the service principal often cannot open a workspace, so
its reports' pages fail on every run.
