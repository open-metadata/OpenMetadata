---
title: salesforceConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/salesforceconnection
---

# SalesforceConnection

*Salesforce Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/salesforceType*. Default: `Salesforce`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/salesforceScheme*. Default: `salesforce`.
- **`username`** *(string)*: Username to connect to the Salesforce. This user should have privileges to read all the metadata in Redshift.
- **`password`** *(string)*: Password to connect to the Salesforce.
- **`securityToken`** *(string)*: Salesforce Security Token.
- **`hostPort`** *(string)*: Host and port of the Salesforce service.
- **`sobjectName`** *(string)*: Salesforce Object Name.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`salesforceType`** *(string)*: Service type. Must be one of: `['Salesforce']`. Default: `Salesforce`.
- **`salesforceScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['salesforce']`. Default: `salesforce`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
