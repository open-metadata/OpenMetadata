---
title: Glue Connection | OpenMetadata AWS Glue Connection Details
description: Get started with glueconnection. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/glueconnection
---

# GlueConnection

*Glue Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/glueType](#definitions/glueType)*. Default: `"Glue"`.
- **`awsConfig`**: Refer to *[../../../../security/credentials/awsCredentials.json](#/../../../security/credentials/awsCredentials.json)*.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
## Definitions

- **`glueType`** *(string)*: Service type. Must be one of: `["Glue"]`. Default: `"Glue"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
