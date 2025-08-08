---
title: icebergConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/icebergconnection
---

# IcebergConnection

*Iceberg Catalog Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/icebergType*. Default: `Iceberg`.
- **`catalog`**: Refer to *./iceberg/icebergCatalog.json*.
- **`ownershipProperty`** *(string)*: Table property to look for the Owner. Default: `owner`.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`icebergType`** *(string)*: Service type. Must be one of: `['Iceberg']`. Default: `Iceberg`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
