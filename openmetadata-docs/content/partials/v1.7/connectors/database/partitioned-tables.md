## Partitioned Tables

When profiling **partitioned tables** in BigQuery, OpenMetadata applies a **default partition query duration of 1 day** for time-based partitions. This conservative setting prevents excessive data scans but may result in no **Sample Data** or **Column Profile Metrics** if no data falls within the default window.

## Resolution

You can adjust this behavior directly from the UI:

1. **Navigate to the table's detail page.**
2. **Edit the profiler configuration.**
3. **Update the `partitionQueryDuration`** under **Partition Config** to a wider window (e.g., 30 days) as needed.

{% image
  src="/images/v1.7/connectors/bigquery/partitioned-tables.gif"
/%}

This change allows OpenMetadata to access a broader data range during profiling and sample data collection, resolving the issue for partitioned tables.
