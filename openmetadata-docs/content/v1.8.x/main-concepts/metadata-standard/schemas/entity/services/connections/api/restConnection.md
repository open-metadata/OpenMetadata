---
title: REST Connection | OpenMetadata REST Connections
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/api/restconnection
---

# RestConnection

*REST Connection Config*

## Properties

- **`type`**: REST API Type. Refer to *[#/definitions/restType](#definitions/restType)*. Default: `"Rest"`.
- **`openAPISchemaURL`** *(string, format: uri)*: Open API Schema URL.
- **`token`** *(string, format: password)*: Generated Token to connect to OpenAPI Schema.
- **`supportsMetadataExtraction`** *(boolean)*: Supports Metadata Extraction. Default: `true`.
## Definitions

- **`restType`** *(string)*: REST API type. Must be one of: `["Rest"]`. Default: `"Rest"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
