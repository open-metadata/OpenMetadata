---
title: Amundsen Connection | OpenMetadata Amundsen
description: Schema to connect with Amundsen metadata platform for syncing assets, lineage, and business glossary terms.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/metadata/amundsenconnection
---

# AmundsenConnection

*Amundsen Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/amundsenType](#definitions/amundsenType)*. Default: `"Amundsen"`.
- **`username`** *(string)*: username to connect to the Amundsen Neo4j Connection.
- **`password`** *(string, format: password)*: password to connect to the Amundsen Neo4j Connection.
- **`hostPort`** *(string, format: uri)*: Host and port of the Amundsen Neo4j Connection. This expect a URI format like: bolt://localhost:7687.
- **`maxConnectionLifeTime`** *(integer)*: Maximum connection lifetime for the Amundsen Neo4j Connection. Default: `50`.
- **`validateSSL`** *(boolean)*: Enable SSL validation for the Amundsen Neo4j Connection. Default: `false`.
- **`encrypted`** *(boolean)*: Enable encryption for the Amundsen Neo4j Connection. Default: `false`.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`amundsenType`** *(string)*: Amundsen service type. Must be one of: `["Amundsen"]`. Default: `"Amundsen"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
