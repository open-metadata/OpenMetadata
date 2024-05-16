---
title: Failed Rows Sample (Collate only)
slug: /connectors/ingestion/workflows/data-quality/failed-rows-sample
---

# Failed Rows Sample (Collate Only)

Some tests will produce a failed sample upon failure. This allows the platform users to
understand the nature of the failure and take corrective actions. The failed sample will
be a subset of the rows that failed the test.

The sample will be collected when the option `computePassedFailedRowCount` is set.

## Supported Test Definitions

- [Column Values to Be Not Null](/connectors/ingestion/workflows/data-quality/tests#column-values-to-be-not-null)
- [Column Values to Match Regex](/connectors/ingestion/workflows/data-quality/tests#column-values-to-match-regex)
- [Column Values to not Match Regex](/connectors/ingestion/workflows/data-quality/tests#column-values-to-not-match-regex)
- [Column Values to Be in Set](/connectors/ingestion/workflows/data-quality/tests#column-values-to-be-in-set)
- [Column Values to Be Not In Set](/connectors/ingestion/workflows/data-quality/tests#column-values-to-be-not-in-set)
- [Column Values to Be Between](/connectors/ingestion/workflows/data-quality/tests#column-values-to-be-between)
- [Column Values Lengths to Be Between](/connectors/ingestion/workflows/data-quality/tests#column-values-lengths-to-be-between)

## Example

{% image 
src="/images/v1.4/connectors/ingestion/workflows/data-quality/data-quality/set_compute_row_count.png"
alt="set compute row count"
/%}

![test definition](/images/v1.4/connectors/ingestion/workflows/data-quality/data-quality/failed_rows_sample_1.png)
![failed rows sampls](/images/v1.4/connectors/ingestion/workflows/data-quality/data-quality/failed_rows_sample_2.png)
