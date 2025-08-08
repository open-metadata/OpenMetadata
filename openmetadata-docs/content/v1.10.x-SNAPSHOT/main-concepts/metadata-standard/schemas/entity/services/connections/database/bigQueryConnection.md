---
title: bigQueryConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/bigqueryconnection
---

# BigQueryConnection

*Google BigQuery Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/bigqueryType*. Default: `BigQuery`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/bigqueryScheme*. Default: `bigquery`.
- **`hostPort`** *(string)*: BigQuery APIs URL. Default: `bigquery.googleapis.com`.
- **`billingProjectId`** *(string)*: Billing Project ID. Default: `None`.
- **`credentials`**: GCP Credentials. Refer to *../../../../security/credentials/gcpCredentials.json*.
- **`taxonomyProjectID`** *(array)*: Project IDs used to fetch policy tags. Default: `None`.
  - **Items** *(string)*
- **`taxonomyLocation`** *(string)*: Taxonomy location used to fetch policy tags. Default: `us`.
- **`usageLocation`** *(string)*: Location used to query INFORMATION_SCHEMA.JOBS_BY_PROJECT to fetch usage data. You can pass multi-regions, such as `us` or `eu`, or you specific region. Australia and Asia multi-regions are not yet in GA. Default: `us`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsIncrementalMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsIncrementalMetadataExtraction*.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`supportsSystemProfile`**: Refer to *../connectionBasicType.json#/definitions/supportsSystemProfile*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
- **`supportsDataDiff`**: Refer to *../connectionBasicType.json#/definitions/supportsDataDiff*.
- **`costPerTB`** *(number)*: Cost per TiB for BigQuery usage. Default: `6.25`.
## Definitions

- **`bigqueryType`** *(string)*: Service type. Must be one of: `['BigQuery']`. Default: `BigQuery`.
- **`bigqueryScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['bigquery']`. Default: `bigquery`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
