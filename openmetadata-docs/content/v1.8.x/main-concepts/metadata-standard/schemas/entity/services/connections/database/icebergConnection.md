---
title: Iceberg Connection | OpenMetadata Iceberg
description: Iceberg metadata connection schema enabling ingestion of metadata for large-scale tabular datasets.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/icebergconnection
---

# IcebergConnection

*Iceberg Catalog Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/icebergType](#definitions/icebergType)*. Default: `"Iceberg"`.
- **`catalog`**: Refer to *[./iceberg/icebergCatalog.json](#iceberg/icebergCatalog.json)*.
- **`ownershipProperty`** *(string)*: Table property to look for the Owner. Default: `"owner"`.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`icebergType`** *(string)*: Service type. Must be one of: `["Iceberg"]`. Default: `"Iceberg"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
