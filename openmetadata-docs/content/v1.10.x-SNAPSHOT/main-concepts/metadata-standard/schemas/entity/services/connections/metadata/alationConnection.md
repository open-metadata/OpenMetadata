---
title: alationConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/metadata/alationconnection
---

# AlationConnection

*Alation Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/alationType*. Default: `Alation`.
- **`hostPort`** *(string)*: Host and port of the Alation service.
- **`authType`**: Types of methods used to authenticate to the alation instance.
- **`connection`**: Choose between mysql and postgres connection for alation database.
- **`projectName`** *(string)*: Project name to create the refreshToken. Can be anything. Default: `AlationAPI`.
- **`paginationLimit`** *(integer)*: Pagination limit used for Alation APIs pagination. Default: `10`.
- **`includeUndeployedDatasources`** *(boolean)*: Specifies if undeployed datasources should be included while ingesting. Default: `False`.
- **`includeHiddenDatasources`** *(boolean)*: Specifies if hidden datasources should be included while ingesting. Default: `False`.
- **`ingestDatasources`** *(boolean)*: Specifies if Datasources are to be ingested while running the ingestion job. Default: `True`.
- **`ingestUsersAndGroups`** *(boolean)*: Specifies if Users and Groups are to be ingested while running the ingestion job. Default: `True`.
- **`ingestDomains`** *(boolean)*: Specifies if Domains are to be ingested while running the ingestion job. Default: `True`.
- **`ingestKnowledgeArticles`** *(boolean)*: Specifies if Knowledge Articles are to be ingested while running the ingestion job. Default: `True`.
- **`ingestDashboards`** *(boolean)*: Specifies if Dashboards are to be ingested while running the ingestion job. Default: `True`.
- **`alationTagClassificationName`** *(string)*: Custom OpenMetadata Classification name for alation tags. Default: `alationTags`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`alationType`** *(string)*: Service type. Must be one of: `['Alation']`. Default: `Alation`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
