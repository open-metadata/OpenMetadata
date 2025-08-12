---
title: dynamoDBConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/dynamodbconnection
---

# DynamoDBConnection

*DynamoDB Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/dynamoDBType*. Default: `DynamoDB`.
- **`awsConfig`**: Refer to *../../../../security/credentials/awsCredentials.json*.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`dynamoDBType`** *(string)*: Service type. Must be one of: `['DynamoDB']`. Default: `DynamoDB`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
