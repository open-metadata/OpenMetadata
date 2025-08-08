---
title: connectionBasicType
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/connectionbasictype
---

# ConnectionType

*This schema defines basic common types that are used by other schemas.*

## Definitions

- **`connectionOptions`** *(object)*: Additional connection options to build the URL that can be sent to service during the connection. Can contain additional properties.
  - **Additional Properties** *(string)*
- **`connectionArguments`** *(object)*: Additional connection arguments such as security or protocol configs that can be sent to service during connection. Can contain additional properties.
  - **Additional Properties**
- **`supportsMetadataExtraction`** *(boolean)*: Supports Metadata Extraction. Default: `True`.
- **`supportsIncrementalMetadataExtraction`** *(boolean)*: Supports Incremental Metadata Extraction. Default: `True`.
- **`supportsUsageExtraction`** *(boolean)*: Supports Usage Extraction. Default: `True`.
- **`supportsLineageExtraction`** *(boolean)*: Supports Lineage Extraction. Default: `True`.
- **`supportsViewLineageExtraction`** *(boolean)*: Supports View Lineage Extraction. Default: `True`.
- **`supportsProfiler`** *(boolean)*: Supports Profiler. Default: `True`.
- **`supportsStatistics`** *(boolean)*: Supports collecting metrics from an aggregated statistics table. Default: `False`.
- **`supportsDatabase`** *(boolean)*: The source service supports the database concept in its hierarchy. Default: `True`.
- **`supportsQueryComment`** *(boolean)*: For Database Services using SQLAlchemy, True to enable running a comment for all queries run from OpenMetadata. Default: `True`.
- **`supportsSystemProfile`** *(boolean)*: The source database supports system profiles for tables such as last update. Default: `False`.
- **`supportsDataInsightExtraction`** *(boolean)*: Support Metadata To Elastic Search. Default: `True`.
- **`supportsElasticSearchReindexingExtraction`** *(boolean)*: Support Elastic Search Reindexing. Default: `True`.
- **`supportsDBTExtraction`** *(boolean)*: Supports DBT Extraction. Default: `True`.
- **`supportsDataDiff`** *(boolean)*: Supports the data diff data qualty specification. Default: `True`.
- **`dataStorageConfig`** *(object)*: Storage config to store sample data.
  - **`bucketName`** *(string)*: Bucket Name. Default: ``.
  - **`prefix`** *(string)*: Prefix of the data source. Default: ``.
  - **`filePathPattern`** *(string)*: Provide the pattern of the path where the generated sample data file needs to be stored. Default: `{service_name}/{database_name}/{database_schema_name}/{table_name}/sample_data.parquet`.
  - **`overwriteData`** *(boolean)*: When this field enabled a single parquet file will be created to store sample data, otherwise we will create a new file per day. Default: `True`.
  - **`storageConfig`**
- **`sampleDataStorageConfig`** *(object)*: Storage config to store sample data. Cannot contain additional properties.
  - **`config`**


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
