---
title: dynamoDBConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/dynamodbconnection
---

# DynamoDBConnection

*DynamoDB Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/dynamoDBType*. Default: `DynamoDB`.
- **`awsConfig`**: Refer to *../../../../security/credentials/awsCredentials.json*.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`dynamoDBType`** *(string)*: Service type. Must be one of: `['DynamoDB']`. Default: `DynamoDB`.


Documentation file automatically generated at 2022-09-18 19:21:45.413954.
