---
title: adlsConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/storage/adlsconnection
---

# ADLS Connection

*ADLS Connection.*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/azureType](#definitions/azureType)*. Default: `"ADLS"`.
- **`credentials`**: Azure Credentials. Refer to *[../../../../security/credentials/azureCredentials.json](#/../../../security/credentials/azureCredentials.json)*.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`azureType`** *(string)*: ADLS service type. Must be one of: `["ADLS"]`. Default: `"ADLS"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
