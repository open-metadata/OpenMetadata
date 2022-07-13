---
title: dynamoDBConnection
slug: /main-concepts/metadata-standard/schemas/schema/entity/services/connections/database
---

# DynamoDBConnection

*DynamoDB Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/dynamoDBType*. Default: `DynamoDB`.
- **`awsConfig`**: Refer to *../../../../security/credentials/awsCredentials.json*.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases. Default: `DynamoDB`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`dynamoDBType`** *(string)*: Service type. Must be one of: `['DynamoDB']`. Default: `DynamoDB`.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
