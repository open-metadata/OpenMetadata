---
title: restConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/api/restconnection
---

# RestConnection

*REST Connection Config*

## Properties

- **`type`**: REST API Type. Refer to *#/definitions/restType*. Default: `Rest`.
- **`openAPISchemaURL`** *(string)*: Open API Schema URL.
- **`token`** *(string)*: Generated Token to connect to OpenAPI Schema.
- **`docURL`** *(string)*: Documentation URL for the schema.
- **`apiCollectionFilterPattern`**: Regex to only fetch api collections with names matching the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`** *(boolean)*: Supports Metadata Extraction. Default: `True`.
## Definitions

- **`restType`** *(string)*: REST API type. Must be one of: `['Rest']`. Default: `Rest`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
