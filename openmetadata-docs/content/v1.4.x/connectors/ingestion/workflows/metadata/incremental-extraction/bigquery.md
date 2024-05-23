---
title: Metadata Ingestion - Incremental Extraction - BigQuery
slug: /connectors/ingestion/workflows/metadata/incremental-extraction/bigquery
---

# Metadata Ingestion - Incremental Extraction - BigQuery

## Approach

In order to implement the Incremental Extraction for BigQuery we rely on [`Cloud Logging`](https://cloud.google.com/bigquery/docs/reference/auditlogs) to get the latest DDL changes.

We then proceed to get the Table Name from the `resourceName` property and we set it to be deleted if `tableDeletion` is present on the payload.

## Requisites

The credentials need to have the [Logs Viewer](https://cloud.google.com/logging/docs/access-control#logging.viewer) role.

## Used Query

```sql
protoPayload.metadata.@type="type.googleapis.com/google.cloud.audit.BigQueryAuditMetadata"
AND (
    protoPayload.methodName = ("google.cloud.bigquery.v2.TableService.UpdateTable" OR "google.cloud.bigquery.v2.TableService.InsertTable" OR "google.cloud.bigquery.v2.TableService.PatchTable" OR "google.cloud.bigquery.v2.TableService.DeleteTable")
    OR
    (protoPayload.methodName = "google.cloud.bigquery.v2.JobService.InsertJob" AND (protoPayload.metadata.tableCreation:* OR protoPayload.metadata.tableChange:* OR protoPayload.metadata.tableDeletion:*))
)
AND resource.labels.project_id = "{project}"
AND resource.labels.dataset_id = "{dataset}"
AND timestamp >= "{start_date}"
```
