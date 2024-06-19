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
- **`credentials`**: GCP Credentials. Refer to *../../../../security/credentials/gcpCredentials.json*.
- **`taxonomyProjectID`** *(array)*: Project IDs used to fetch policy tags. Default: `None`.
  - **Items** *(string)*
- **`taxonomyLocation`** *(string)*: Taxonomy location used to fetch policy tags. Default: `us`.
- **`usageLocation`** *(string)*: Location used to query INFORMATION_SCHEMA.JOBS_BY_PROJECT to fetch usage data. You can pass multi-regions, such as `us` or `eu`, or you specific region. Australia and Asia multi-regions are not yet in GA. Default: `us`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
## Definitions

- **`bigqueryType`** *(string)*: Service type. Must be one of: `['BigQuery']`. Default: `BigQuery`.
- **`bigqueryScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['bigquery']`. Default: `bigquery`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
