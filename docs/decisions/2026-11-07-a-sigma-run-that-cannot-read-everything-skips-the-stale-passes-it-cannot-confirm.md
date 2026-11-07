# A Sigma run that cannot read everything skips the stale-entity passes it cannot confirm

- **Status:** Accepted
- **Revisions:** v1 2026-11-07 (initial)
- **Deciders:** Sigma connector maintainers (PR #37296)
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_sigma.py` (`test_every_stale_pass_runs_when_every_read_succeeds`,
  `test_a_failed_workbook_listing_page_skips_every_stale_pass`, `test_a_failed_workbook_read_skips_every_stale_pass`,
  `test_a_failed_element_read_keeps_charts_and_data_models`, `test_a_failed_data_model_listing_skips_the_data_model_stale_pass`,
  `test_a_failed_element_read_keeps_the_existing_data_model`)
- **Related:** ADR:2026-10-30-an-empty-seen-set-deletes-the-scope-only-when-the-connector-confirms-its-listing,
  ADR:2026-10-22-tableau-runs-stop-without-deleting-while-the-metadata-api-backfills, `REVIEW.md` "Failed or partial
  discovery never drives deletion"

## Context

The `markDeleted*` passes soft-delete every entity of the service that the run did not see. Sigma's workbooks, their
pages and elements, and its Data Models come from paginated reads, so one failed page or call left live entities out
of the seen set, and the pass deleted them: a 500 on page 2 of the workbook listing soft-deleted every workbook on it.
The shared `SourceListing` guard protects only an empty seen set, and only when a connector marks its listing
complete, so it does not cover a seen set that is partial but not empty.

## Decision

- A failed read of a workbook-listing page, or of a workbook's details, skips all three passes (dashboards, charts,
  data models) for that run.
- A failed read of a workbook's pages, or of a page's elements, skips the chart and data model passes. The dashboard
  pass still runs: every workbook was read.
- A failed read of the Sigma Data Model listing skips the data model pass.
- A Sigma Data Model whose elements cannot be read is kept as seen and left unchanged.
- The failures are tracked by flags on the Sigma client (`workbooks_incomplete`, `elements_incomplete`,
  `data_models_incomplete`), not through `SourceListing`.
- The run does not fail. Each skipped pass is logged as a warning, which the run's status reports, and so is the
  failed read.

## Consequences

- A transient Sigma error never deletes live workbooks, charts or data models.
- An entity really removed in Sigma stays until a run whose reads all succeed, so a read that fails on every run
  blocks the passes it affects for good.
- Unlike Tableau's backfill guard, the run reports success with warnings. Revisit this if failed reads should fail the
  run, as `REVIEW.md` asks for a failed listing.
