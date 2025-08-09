---
title: customSearchConnection | Official Documentation
description: Use this schema to configure custom search service connections that fit unique organizational indexing and retrieval needs.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/search/customsearchconnection
---

# CustomSearchConnection

*Custom Search Service connection to build a source that is not supported by OpenMetadata yet.*

## Properties

- **`type`**: Custom search service type. Refer to *[#/definitions/customSearchType](#definitions/customSearchType)*. Default: `"CustomSearch"`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to instantiated by the ingestion workflow.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
## Definitions

- **`customSearchType`** *(string)*: Custom search service type. Must be one of: `["CustomSearch"]`. Default: `"CustomSearch"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
