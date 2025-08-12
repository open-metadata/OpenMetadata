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
- **`organizationId`** *(string)*: Salesforce Organization ID is the unique identifier for your Salesforce identity.
- **`sobjectName`** *(string)*: Salesforce Object Name.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`salesforceApiVersion`** *(string)*: API version of the Salesforce instance. Default: `42.0`.
- **`salesforceDomain`** *(string)*: Domain of Salesforce instance. Default: `login`.
- **`sslConfig`**: SSL Configuration details. Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`salesforceType`** *(string)*: Service type. Must be one of: `['Salesforce']`. Default: `Salesforce`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
