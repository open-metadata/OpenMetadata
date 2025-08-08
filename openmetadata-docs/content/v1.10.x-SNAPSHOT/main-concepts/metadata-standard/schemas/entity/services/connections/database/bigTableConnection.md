---
title: bigTableConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/bigtableconnection
---

# BigTableConnection

*Google BigTable Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/bigtableType*. Default: `BigTable`.
- **`credentials`**: GCP Credentials. Refer to *../../../../security/credentials/gcpCredentials.json*.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
## Definitions

- **`bigtableType`** *(string)*: Service type. Must be one of: `['BigTable']`. Default: `BigTable`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
