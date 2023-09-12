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
- **`hostPort`** *(string)*: Host and port of the Atlas service.
- **`databaseServiceName`** *(array)*: service type of the data source.
  - **Items** *(string)*
- **`messagingServiceName`** *(array)*: service type of the messaging source.
  - **Items** *(string)*
- **`entity_type`** *(string)*: Name of the Entity Type available in Atlas.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`atlasType`** *(string)*: Service type. Must be one of: `['Atlas']`. Default: `Atlas`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
