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
- **`supportsUsageExtraction`** *(boolean)*: Supports Usage Extraction. Default: `True`.
- **`supportsLineageExtraction`** *(boolean)*: Supports Lineage Extraction. Default: `True`.
- **`supportsProfiler`** *(boolean)*: Supports Profiler. Default: `True`.
- **`supportsDatabase`** *(boolean)*: The source service supports the database concept in its hierarchy. Default: `True`.
- **`supportsQueryComment`** *(boolean)*: For Database Services using SQLAlchemy, True to enable running a comment for all queries run from OpenMetadata. Default: `True`.
- **`supportsDataInsightExtraction`** *(boolean)*: Support Metadata To Elastic Search. Default: `True`.
- **`supportsElasticSearchReindexingExtraction`** *(boolean)*: Support Elastic Search Reindexing. Default: `True`.
- **`supportsDBTExtraction`** *(boolean)*: Supports DBT Extraction. Default: `True`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
