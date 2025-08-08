---
title: Root Cause Analysis | OpenMetadata Incident Management
description: Identify root causes of data incidents using observability metrics, lineage context, and entity-level impact traces.
slug: /how-to-guides/data-quality-observability/incident-manager/root-cause-analysis
Collate: true
---

# Root Cause Analysis

## Failed Rows Sample

Some tests will produce a failed sample upon failure. This allows the platform users to understand the nature of the failure and take corrective actions. The failed sample will be a subset of the rows that failed the test.

The sample will be collected when the option `computePassedFailedRowCount` is set.

### Supported Test Definitions

- [Column Values to Be Not Null](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-to-be-not-null)
- [Column Values to Match Regex](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-to-match-regex)
- [Column Values to not Match Regex](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-to-not-match-regex)
- [Column Values to Be in Set](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-to-be-in-set)
- [Column Values to Be Not In Set](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-to-be-not-in-set)
- [Column Values to Be Between](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-to-be-between)
- [Column Values Lengths to Be Between](/how-to-guides/data-quality-observability/quality/tests-yaml#column-values-lengths-to-be-between)
- [Custom SQL](/how-to-guides/data-quality-observability/quality/tests-yaml#table-custom-sql-test)

### Deleting Sample Rows
If you wish to delete sample rows, you can do so by clicking on the three dots above the table of sample rows. This will open a window with the `Delete` option. Note that failed sample rows will automatically be deleted upon test success.

{% image 
src="/images/v1.9/features/ingestion/workflows/data-quality/sample-row-failure-deletion.png"
alt="set compute row count"
/%}

### Example

{% image 
src="/images/v1.9/features/ingestion/workflows/data-quality/set_compute_row_count.png"
alt="set compute row count"
/%}

![test definition](/images/v1.9/features/ingestion/workflows/data-quality/failed_rows_sample_1.png)
![failed rows sampls](/images/v1.9/features/ingestion/workflows/data-quality/failed_rows_sample_2.png)

## Inspection Query

 Supported test will generate an inspection query upon failure. This query can be run on the source data to understand
 the nature of the failure and take corrective actions.

 This query can be added to the table and shared with other users.

 ![inspection query](/images/v1.9/features/ingestion/workflows/data-quality/inspection-query.png)