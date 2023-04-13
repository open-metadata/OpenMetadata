---
title: salesforceConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/salesforceconnection
---

# SalesforceConnection

*Salesforce Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/salesforceType*. Default: `Salesforce`.
- **`username`** *(string)*: Username to connect to the Salesforce. This user should have privileges to read all the metadata in Redshift.
- **`password`** *(string)*: Password to connect to the Salesforce.
- **`securityToken`** *(string)*: Salesforce Security Token.
- **`hostPort`** *(string)*: Host and port of the Salesforce service.
- **`sobjectName`** *(string)*: Salesforce Object Name.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
## Definitions

- **`salesforceType`** *(string)*: Service type. Must be one of: `['Salesforce']`. Default: `Salesforce`.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
