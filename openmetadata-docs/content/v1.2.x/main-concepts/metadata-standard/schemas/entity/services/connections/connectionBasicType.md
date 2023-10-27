---
title: connectionBasicType
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/connectionbasictype
---

# ConnectionType

*This schema defines basic common types that are used by other schemas.*

## Definitions

- <a id="definitions/connectionOptions"></a>**`connectionOptions`** *(object)*: Additional connection options to build the URL that can be sent to service during the connection. Can contain additional properties.
  - **Additional Properties** *(string)*
- <a id="definitions/connectionArguments"></a>**`connectionArguments`** *(object)*: Additional connection arguments such as security or protocol configs that can be sent to service during connection. Can contain additional properties.
  - **Additional Properties**
- <a id="definitions/supportsMetadataExtraction"></a>**`supportsMetadataExtraction`** *(boolean)*: Supports Metadata Extraction. Default: `true`.
- <a id="definitions/supportsUsageExtraction"></a>**`supportsUsageExtraction`** *(boolean)*: Supports Usage Extraction. Default: `true`.
- <a id="definitions/supportsLineageExtraction"></a>**`supportsLineageExtraction`** *(boolean)*: Supports Lineage Extraction. Default: `true`.
- <a id="definitions/supportsProfiler"></a>**`supportsProfiler`** *(boolean)*: Supports Profiler. Default: `true`.
- <a id="definitions/supportsDatabase"></a>**`supportsDatabase`** *(boolean)*: The source service supports the database concept in its hierarchy. Default: `true`.
- <a id="definitions/supportsQueryComment"></a>**`supportsQueryComment`** *(boolean)*: For Database Services using SQLAlchemy, True to enable running a comment for all queries run from OpenMetadata. Default: `true`.
- <a id="definitions/supportsDataInsightExtraction"></a>**`supportsDataInsightExtraction`** *(boolean)*: Support Metadata To Elastic Search. Default: `true`.
- <a id="definitions/supportsElasticSearchReindexingExtraction"></a>**`supportsElasticSearchReindexingExtraction`** *(boolean)*: Support Elastic Search Reindexing. Default: `true`.
- <a id="definitions/supportsDBTExtraction"></a>**`supportsDBTExtraction`** *(boolean)*: Supports DBT Extraction. Default: `true`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
