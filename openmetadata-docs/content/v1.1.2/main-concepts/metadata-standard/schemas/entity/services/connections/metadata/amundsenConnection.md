---
title: amundsenConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/metadata/amundsenconnection
---

# AmundsenConnection

*Amundsen Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/amundsenType*. Default: `Amundsen`.
- **`username`** *(string)*: username to connect to the Amundsen Neo4j Connection.
- **`password`** *(string)*: password to connect to the Amundsen Neo4j Connection.
- **`hostPort`** *(string)*: Host and port of the Amundsen Neo4j Connection. This expects a URI format like: bolt://localhost:7687.
- **`maxConnectionLifeTime`** *(integer)*: Maximum connection lifetime for the Amundsen Neo4j Connection. Default: `50`.
- **`validateSSL`** *(boolean)*: Enable SSL validation for the Amundsen Neo4j Connection. Default: `False`.
- **`encrypted`** *(boolean)*: Enable encryption for the Amundsen Neo4j Connection. Default: `False`.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`amundsenType`** *(string)*: Amundsen service type. Must be one of: `['Amundsen']`. Default: `Amundsen`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
