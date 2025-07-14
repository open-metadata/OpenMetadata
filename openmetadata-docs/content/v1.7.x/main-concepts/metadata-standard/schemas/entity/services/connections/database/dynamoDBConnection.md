---
title: DynamoDB Connection | OpenMetadata DynamoDB
description: Get started with dynamodbconnection. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/dynamodbconnection
---

# DynamoDBConnection

*DynamoDB Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/dynamoDBType](#definitions/dynamoDBType)*. Default: `"DynamoDB"`.
- **`awsConfig`**: Refer to *[../../../../security/credentials/awsCredentials.json](#/../../../security/credentials/awsCredentials.json)*.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
## Definitions

- **`dynamoDBType`** *(string)*: Service type. Must be one of: `["DynamoDB"]`. Default: `"DynamoDB"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
