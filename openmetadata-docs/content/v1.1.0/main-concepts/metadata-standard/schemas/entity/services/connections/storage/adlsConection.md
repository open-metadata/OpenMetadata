---
title: adlsConection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/storage/adlsconection
---

# Azure Store Connection

*Azure Store Connection.*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/azureType](#definitions/azureType)*. Default: `"Adls"`.
- **`credentials`**: Azure Credentials. Refer to *[../../../../security/credentials/azureCredentials.json](#/../../../security/credentials/azureCredentials.json)*.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/azureType"></a>**`azureType`** *(string)*: ADLS service type. Must be one of: `["Adls"]`. Default: `"Adls"`.


Documentation file automatically generated at 2023-07-16 19:59:36.193714.
