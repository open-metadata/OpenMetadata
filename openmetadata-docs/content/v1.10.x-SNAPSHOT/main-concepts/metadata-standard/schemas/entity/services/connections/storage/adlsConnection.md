---
title: adlsConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/storage/adlsconnection
---

# ADLS Connection

*ADLS Connection.*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/azureType*. Default: `ADLS`.
- **`credentials`**: Azure Credentials. Refer to *../../../../security/credentials/azureCredentials.json*.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`containerFilterPattern`**: Regex to only fetch containers that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`azureType`** *(string)*: ADLS service type. Must be one of: `['ADLS']`. Default: `ADLS`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
