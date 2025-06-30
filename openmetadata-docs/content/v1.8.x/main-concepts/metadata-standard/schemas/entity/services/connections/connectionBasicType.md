---
title: Connection Basic Type | OpenMetadata Connection Types
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/connectionbasictype
---

# ConnectionType

*This schema defines basic common types that are used by other schemas.*

## Definitions

- **`connectionOptions`** *(object)*: Additional connection options to build the URL that can be sent to service during the connection. Can contain additional properties.
  - **Additional Properties** *(string)*
- **`connectionArguments`** *(object)*: Additional connection arguments such as security or protocol configs that can be sent to service during connection. Can contain additional properties.
  - **Additional Properties**
- **`supportsMetadataExtraction`** *(boolean)*: Supports Metadata Extraction. Default: `true`.
- **`supportsUsageExtraction`** *(boolean)*: Supports Usage Extraction. Default: `true`.
- **`supportsLineageExtraction`** *(boolean)*: Supports Lineage Extraction. Default: `true`.
- **`supportsViewLineageExtraction`** *(boolean)*: Supports View Lineage Extraction. Default: `true`.
- **`supportsProfiler`** *(boolean)*: Supports Profiler. Default: `true`.
- **`supportsStatistics`** *(boolean)*: Supports collecting metrics from an aggregated statistics table. Default: `false`.
- **`supportsDatabase`** *(boolean)*: The source service supports the database concept in its hierarchy. Default: `true`.
- **`supportsQueryComment`** *(boolean)*: For Database Services using SQLAlchemy, True to enable running a comment for all queries run from OpenMetadata. Default: `true`.
- **`supportsSystemProfile`** *(boolean)*: The source database supports system profiles for tables such as last update. Default: `false`.
- **`supportsDataInsightExtraction`** *(boolean)*: Support Metadata To Elastic Search. Default: `true`.
- **`supportsElasticSearchReindexingExtraction`** *(boolean)*: Support Elastic Search Reindexing. Default: `true`.
- **`supportsDBTExtraction`** *(boolean)*: Supports DBT Extraction. Default: `true`.
- **`supportsDataDiff`** *(boolean)*: Supports the data diff data qualty specification. Default: `true`.
- **`dataStorageConfig`** *(object)*: Storage config to store sample data.
  - **`bucketName`** *(string)*: Bucket Name. Default: `""`.
  - **`prefix`** *(string)*: Prefix of the data source. Default: `""`.
  - **`filePathPattern`** *(string)*: Provide the pattern of the path where the generated sample data file needs to be stored. Default: `"{service_name}/{database_name}/{database_schema_name}/{table_name}/sample_data.parquet"`.
  - **`overwriteData`** *(boolean)*: When this field enabled a single parquet file will be created to store sample data, otherwise we will create a new file per day. Default: `true`.
  - **`storageConfig`**
    - **One of**
      - : Refer to *[../../../security/credentials/awsCredentials.json](#/../../security/credentials/awsCredentials.json)*.
      - *object*: Cannot contain additional properties.
- **`sampleDataStorageConfig`** *(object)*: Storage config to store sample data. Cannot contain additional properties.
  - **`config`**
    - **One of**
      - : Refer to *[#/definitions/dataStorageConfig](#definitions/dataStorageConfig)*.
      - *object*: Cannot contain additional properties.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
