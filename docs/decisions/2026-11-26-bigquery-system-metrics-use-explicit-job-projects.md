# BigQuery system metrics use explicit job projects and one UTC window

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** OpenMetadata contributors
- **Guard:** BigQuery profiler SQL and system profile unit tests, plus the two-project BigQuery CLI profile test
- **Related:** [#37983](https://github.com/open-metadata/OpenMetadata/issues/37983), ADR:2026-11-03-bigquery-daily-shards-use-stable-logical-tables, ADR:2026-10-15-snowflake-system-metrics-scan-query-history-per-table-batch

## Context

BigQuery records DML history in the project and region that executed the job. The profile store replaces rows with the same table, millisecond, and operation. Scanning one project can miss legitimate activity, and writing each job separately can overwrite another job's effect.

## Decision

Read the billing project's regional jobs view, or the destination project's view when no billing project is set. Append up to 10 explicitly configured projects and scan each unique view once per table in `usageLocation`. Keep the destination table, the history projects, and the execution project independent.

Capture one UTC calendar window at the start of the run. Allow 1–30 dates, with the run's date and the preceding date as the default. Select eligible jobs by start time and prune creation-time partitions with two extra dates for BigQuery's maximum configured queue wait. Read successful DML for the exact destination. Deduplicate by region, jobs project, and job ID, then sum the row effects by millisecond and operation. Cap each table scan at 50,000 job records and 10,000 output buckets. A failed, conflicting, or over-limit scan omits the whole table's system profile for that run.

## Consequences

Each authorized additional project adds a view scan. The caps bound client memory and write size. Evaluate billed bytes and duration before enabling the wider scope. If per-table scans exceed the staging budget, use the existing profiler table batch window to share scans while keeping exact table filters and complete buckets.

A replay with the same scope can replace a bucket with newly visible jobs. Writers on the same table must use the same scope. A rollback to a narrower scope must avoid writing buckets that overlap the larger scope. The counts describe completed DML statements and can include statements from rolled-back transactions.
