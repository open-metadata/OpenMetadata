# A failed rows sample is kept for any run that found failed rows, not only a Failed one

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Data Quality maintainers
- **Guard:** `TestCaseResourceIT#test_failedRowsSampleAcceptedWhenPassingWithinThreshold`,
  `TestCaseResourceIT#test_failedRowsSampleRejectedWhenPassingWithoutFailedRows`,
  `test_failed_sample_mixin.py`, `FailedTestCaseSampleData.test.tsx`
- **Related:** #30361

## Context
Failure thresholds let a test case pass while some rows still break its rule (7 failed rows under a
threshold of 7 is a Success). Those rows are what a data quality team needs to spot degradation
before the threshold is crossed, but ingestion, the server and the UI each only kept or showed the
sample for a `Failed` result.

## Decision
A test case can hold a failed rows sample when its latest result has failed rows: its status is
`Failed`, or its status is `Success` and `failedRows > 0`. Ingestion samples, the
`PUT /dataQuality/testCases/{id}/failedRowsSample` endpoint accepts, and the UI fetches under that
same rule. Ingestion still samples only when `computePassedFailedRowCount` is on.

A current `Success` result still deletes the stored sample on the server. The sink posts the result
before the sample, so a Success within its threshold replaces the sample and a clean Success
clears it. That order must hold.

## Consequences
A green test case can show a sample, so the sample reflects the latest run rather than the latest
failure. A clean pass costs no extra query. A writer that posts the sample before the result loses
it to the Success delete. Revisit if results gain a status between Success and Failed (a Warning),
which would join the rule here.
