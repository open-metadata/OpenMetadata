---
title: Stitch Connection | OpenMetadata Stitch Pipeline Connection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/stitchconnection
---

# StitchConnection

*Stitch Connection*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/stitchType](#definitions/stitchType)*. Default: `"Stitch"`.
- **`hostPort`** *(string)*: Host and port of the Stitch API host. Default: `"https://api.stitchdata.com/v4"`.
- **`token`** *(string, format: password)*: Token to connect to Stitch api doc.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`stitchType`** *(string)*: Service type. Must be one of: `["Stitch"]`. Default: `"Stitch"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
