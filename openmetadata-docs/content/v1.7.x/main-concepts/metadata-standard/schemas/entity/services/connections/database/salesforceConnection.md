---
title: Salesforce Connection | OpenMetadata Salesforce
description: Get started with salesforceconnection. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/salesforceconnection
---

# SalesforceConnection

*Salesforce Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/salesforceType](#definitions/salesforceType)*. Default: `"Salesforce"`.
- **`username`** *(string)*: Username to connect to the Salesforce. This user should have privileges to read all the metadata in Redshift.
- **`password`** *(string, format: password)*: Password to connect to the Salesforce.
- **`securityToken`** *(string, format: password)*: Salesforce Security Token.
- **`organizationId`** *(string)*: Salesforce Organization ID is the unique identifier for your Salesforce identity.
- **`sobjectName`** *(string)*: Salesforce Object Name.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`salesforceApiVersion`** *(string)*: API version of the Salesforce instance. Default: `"42.0"`.
- **`salesforceDomain`** *(string)*: Domain of Salesforce instance. Default: `"login"`.
- **`sslConfig`**: SSL Configuration details. Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`salesforceType`** *(string)*: Service type. Must be one of: `["Salesforce"]`. Default: `"Salesforce"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
