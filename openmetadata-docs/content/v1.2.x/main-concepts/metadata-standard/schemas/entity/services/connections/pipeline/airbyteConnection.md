---
title: airbyteConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/airbyteconnection
---

# AirbyteConnection

*Airbyte Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/AirbyteType](#definitions/AirbyteType)*. Default: `"Airbyte"`.
- **`hostPort`** *(string, format: uri)*: Pipeline Service Management/UI URL.
- **`username`** *(string)*: Username to connect to Airbyte.
- **`password`** *(string, format: password)*: Password to connect to Airbyte.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/AirbyteType"></a>**`AirbyteType`** *(string)*: Service type. Must be one of: `["Airbyte"]`. Default: `"Airbyte"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
