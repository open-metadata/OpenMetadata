
---
title: Root Cause Analysis
slug: /how-to-guides/data-quality-observability/incident-manager/root-cause-analysis
collate: true
---

# Root Cause Analysis

## Failed Rows Sample

Some tests will produce a failed sample upon failure. This allows the platform users to understand the nature of the failure and take corrective actions. The failed sample will be a subset of the rows that failed the test.

The sample will be collected when the option `computePassedFailedRowCount` is set.

## Supported Test Definitions

- [Column Values to Be Not Null](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-to-be-not-null)
- [Column Values to Match Regex](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-to-match-regex)
- [Column Values to not Match Regex](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-to-not-match-regex)
- [Column Values to Be in Set](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-to-be-in-set)
- [Column Values to Be Not In Set](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-to-be-not-in-set)
- [Column Values to Be Between](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-to-be-between)
- [Column Values Lengths to Be Between](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-lengths-to-be-between)

## Deleting Sample Rows
If you wish to delete sample rows, you can do so by clicking on the three dots above the table of sample rows. This will open a window with the `Delete` option. Note that failed sample rows will automatically be deleted upon test success.

{% image 
src="/images/v1.4/features/ingestion/workflows/data-quality/sample-row-failure-deletion.png"
alt="set compute row count"
/%}

## Example

{% image 
src="/images/v1.4/features/ingestion/workflows/data-quality/set_compute_row_count.png"
alt="set compute row count"
/%}

![test definition](/images/v1.4/features/ingestion/workflows/data-quality/failed_rows_sample_1.png)
![failed rows sampls](/images/v1.4/features/ingestion/workflows/data-quality/failed_rows_sample_2.png)
