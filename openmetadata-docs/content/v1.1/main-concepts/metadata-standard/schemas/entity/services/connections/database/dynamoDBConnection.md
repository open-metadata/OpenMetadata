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
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`dynamoDBType`** *(string)*: Service type. Must be one of: `['DynamoDB']`. Default: `DynamoDB`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
