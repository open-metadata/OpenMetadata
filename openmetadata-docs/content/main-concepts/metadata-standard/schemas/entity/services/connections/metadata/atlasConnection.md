---
title: atlasConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/metadata/atlasconnection
---

# AtlasConnection

*Atlas Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/atlasType*. Default: `Atlas`.
- **`username`** *(string)*: username to connect  to the Atlas. This user should have privileges to read all the metadata in Atlas.
- **`password`** *(string)*: password to connect  to the Atlas.
- **`hostPort`** *(string)*: Host and port of the data source.
- **`entityTypes`** *(string)*: entity types of the data source.
- **`serviceType`** *(string)*: service type of the data source.
- **`atlasHost`** *(string)*: Atlas Host of the data source.
- **`dbService`** *(string)*: source database of the data source.
- **`messagingService`** *(string)*: messaging service source of the data source.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank , OpenMetadata Ingestion attempts to scan all the databases in Atlas.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`atlasType`** *(string)*: Service type. Must be one of: `['Atlas']`. Default: `Atlas`.


Documentation file automatically generated at 2022-09-18 19:21:45.413954.
