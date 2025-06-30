---
title: Airbyte Connection | OpenMetadata Airbyte
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/airbyteconnection
---

# AirbyteConnection

*Airbyte Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/AirbyteType](#definitions/AirbyteType)*. Default: `"Airbyte"`.
- **`hostPort`** *(string, format: uri)*: Pipeline Service Management/UI URL.
- **`username`** *(string)*: Username to connect to Airbyte.
- **`password`** *(string, format: password)*: Password to connect to Airbyte.
- **`apiVersion`** *(string)*: Airbyte API version. Default: `"api/v1"`.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`AirbyteType`** *(string)*: Service type. Must be one of: `["Airbyte"]`. Default: `"Airbyte"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
