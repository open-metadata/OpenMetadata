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
- **`sobjectName`** *(string)*: Salesforce Object Name.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`salesforceApiVersion`** *(string)*: API version of the Salesforce instance. Default: `42.0`.
- **`salesforceDomain`** *(string)*: Domain of Salesforce instance. Default: `login`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`salesforceType`** *(string)*: Service type. Must be one of: `['Salesforce']`. Default: `Salesforce`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
