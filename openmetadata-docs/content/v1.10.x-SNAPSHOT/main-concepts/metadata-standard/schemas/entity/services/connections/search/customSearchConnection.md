---
title: customSearchConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/search/customsearchconnection
---

# CustomSearchConnection

*Custom Search Service connection to build a source that is not supported by OpenMetadata yet.*

## Properties

- **`type`**: Custom search service type. Refer to *#/definitions/customSearchType*. Default: `CustomSearch`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to instantiated by the ingestion workflow.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`searchIndexFilterPattern`**: Regex to only fetch search indexes that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`customSearchType`** *(string)*: Custom search service type. Must be one of: `['CustomSearch']`. Default: `CustomSearch`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
