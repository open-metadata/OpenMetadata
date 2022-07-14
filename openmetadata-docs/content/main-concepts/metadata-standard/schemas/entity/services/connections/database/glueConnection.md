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
## Definitions

- **`glueType`** *(string)*: Service type. Must be one of: `['Glue']`. Default: `Glue`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
