---
title: Atlas Connection | OpenMetadata Apache Atlas Connection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/metadata/atlasconnection
---

# AtlasConnection

*Atlas Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/atlasType](#definitions/atlasType)*. Default: `"Atlas"`.
- **`username`** *(string)*: username to connect  to the Atlas. This user should have privileges to read all the metadata in Atlas.
- **`password`** *(string, format: password)*: password to connect  to the Atlas.
- **`hostPort`** *(string, format: uri)*: Host and port of the Atlas service.
- **`databaseServiceName`** *(array)*: service type of the data source.
  - **Items** *(string)*
- **`messagingServiceName`** *(array)*: service type of the messaging source.
  - **Items** *(string)*
- **`entity_type`** *(string)*: Name of the Entity Type available in Atlas.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`atlasType`** *(string)*: Service type. Must be one of: `["Atlas"]`. Default: `"Atlas"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
