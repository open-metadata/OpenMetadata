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
- **`hostPort`** *(string)*: Host and port of the Amundsen Neo4j Connection.
- **`maxConnectionLifeTime`** *(integer)*: Maximum connection lifetime for the Amundsen Neo4j Connection. Default: `50`.
- **`validateSSL`** *(boolean)*: Enable SSL validation for the Amundsen Neo4j Connection. Default: `false`.
- **`encrypted`** *(boolean)*: Enable encryption for the Amundsen Neo4j Connection. Default: `false`.
- **`modelClass`** *(string)*: Model Class for the Amundsen Neo4j Connection.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`amundsenType`** *(string)*: Amundsen service type. Must be one of: `['Amundsen']`. Default: `Amundsen`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
