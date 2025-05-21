---
title: alationConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/metadata/alationconnection
---

# AlationConnection

*Alation Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/alationType](#definitions/alationType)*. Default: `"Alation"`.
- **`hostPort`** *(string, format: uri)*: Host and port of the Alation service.
- **`authType`**: Types of methods used to authenticate to the alation instance.
  - **One of**
    - : Refer to *[../../../../security/credentials/basicAuth.json](#/../../../security/credentials/basicAuth.json)*.
    - : Refer to *[../../../../security/credentials/apiAccessTokenAuth.json](#/../../../security/credentials/apiAccessTokenAuth.json)*.
- **`connection`**: Choose between mysql and postgres connection for alation database.
  - **One of**
    - : Refer to *[../database/postgresConnection.json](#/database/postgresConnection.json)*.
    - : Refer to *[../database/mysqlConnection.json](#/database/mysqlConnection.json)*.
    - *object*: Cannot contain additional properties.
- **`projectName`** *(string)*: Project name to create the refreshToken. Can be anything. Default: `"AlationAPI"`.
- **`paginationLimit`** *(integer)*: Pagination limit used for Alation APIs pagination. Default: `10`.
- **`includeUndeployedDatasources`** *(boolean)*: Specifies if undeployed datasources should be included while ingesting. Default: `false`.
- **`includeHiddenDatasources`** *(boolean)*: Specifies if hidden datasources should be included while ingesting. Default: `false`.
- **`ingestDatasources`** *(boolean)*: Specifies if Datasources are to be ingested while running the ingestion job. Default: `true`.
- **`ingestUsersAndGroups`** *(boolean)*: Specifies if Users and Groups are to be ingested while running the ingestion job. Default: `true`.
- **`ingestDomains`** *(boolean)*: Specifies if Domains are to be ingested while running the ingestion job. Default: `true`.
- **`ingestKnowledgeArticles`** *(boolean)*: Specifies if Knowledge Articles are to be ingested while running the ingestion job. Default: `true`.
- **`ingestDashboards`** *(boolean)*: Specifies if Dashboards are to be ingested while running the ingestion job. Default: `true`.
- **`alationTagClassificationName`** *(string)*: Custom OpenMetadata Classification name for alation tags. Default: `"alationTags"`.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`alationType`** *(string)*: Service type. Must be one of: `["Alation"]`. Default: `"Alation"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
