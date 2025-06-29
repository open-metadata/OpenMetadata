---
title: bigQueryConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/bigqueryconnection
---

# BigQueryConnection

*Google BigQuery Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/bigqueryType](#definitions/bigqueryType)*. Default: `"BigQuery"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/bigqueryScheme](#definitions/bigqueryScheme)*. Default: `"bigquery"`.
- **`hostPort`** *(string)*: BigQuery APIs URL. Default: `"bigquery.googleapis.com"`.
- **`credentials`**: GCP Credentials. Refer to *[../../../../security/credentials/gcpCredentials.json](#/../../../security/credentials/gcpCredentials.json)*.
- **`taxonomyProjectID`** *(array)*: Project IDs used to fetch policy tags. Default: `null`.
  - **Items** *(string)*
- **`taxonomyLocation`** *(string)*: Taxonomy location used to fetch policy tags. Default: `"us"`.
- **`usageLocation`** *(string)*: Location used to query INFORMATION_SCHEMA.JOBS_BY_PROJECT to fetch usage data. You can pass multi-regions, such as `us` or `eu`, or you specific region. Australia and Asia multi-regions are not yet in GA. Default: `"us"`.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsUsageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsUsageExtraction](#/connectionBasicType.json#/definitions/supportsUsageExtraction)*.
- **`supportsLineageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsLineageExtraction](#/connectionBasicType.json#/definitions/supportsLineageExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsDatabase`**: Refer to *[../connectionBasicType.json#/definitions/supportsDatabase](#/connectionBasicType.json#/definitions/supportsDatabase)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
- **`supportsSystemProfile`**: Refer to *[../connectionBasicType.json#/definitions/supportsSystemProfile](#/connectionBasicType.json#/definitions/supportsSystemProfile)*.
- **`sampleDataStorageConfig`**: Refer to *[../connectionBasicType.json#/definitions/sampleDataStorageConfig](#/connectionBasicType.json#/definitions/sampleDataStorageConfig)*.
- **`supportsDataDiff`**: Refer to *[../connectionBasicType.json#/definitions/supportsDataDiff](#/connectionBasicType.json#/definitions/supportsDataDiff)*.
## Definitions

- **`bigqueryType`** *(string)*: Service type. Must be one of: `["BigQuery"]`. Default: `"BigQuery"`.
- **`bigqueryScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["bigquery"]`. Default: `"bigquery"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
