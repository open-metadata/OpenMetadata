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
- **`hostPort`** *(string)*: Host and port of the Amundsen Neo4j Connection. This expect a URI format like: bolt://localhost:7687.
- **`maxConnectionLifeTime`** *(integer)*: Maximum connection lifetime for the Amundsen Neo4j Connection. Default: `50`.
- **`validateSSL`** *(boolean)*: Enable SSL validation for the Amundsen Neo4j Connection. Default: `False`.
- **`encrypted`** *(boolean)*: Enable encryption for the Amundsen Neo4j Connection. Default: `False`.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`amundsenType`** *(string)*: Amundsen service type. Must be one of: `['Amundsen']`. Default: `Amundsen`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
