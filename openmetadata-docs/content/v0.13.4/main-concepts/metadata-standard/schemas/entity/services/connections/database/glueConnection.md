---
title: glueConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/glueconnection
---

# GlueConnection

*Glue Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/glueType*. Default: `Glue`.
- **`awsConfig`**: Refer to *../../../../security/credentials/awsCredentials.json*.
- **`storageServiceName`** *(string)*: AWS storageServiceName Name.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
## Definitions

- **`glueType`** *(string)*: Service type. Must be one of: `['Glue']`. Default: `Glue`.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
