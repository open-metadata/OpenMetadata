---
title: stitchConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/stitchconnection
---

# StitchConnection

*Stitch Connection*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/stitchType*. Default: `Stitch`.
- **`hostPort`** *(string)*: Host and port of the Stitch API host. Default: `https://api.stitchdata.com/v4`.
- **`token`** *(string)*: Token to connect to Stitch api doc.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`stitchType`** *(string)*: Service type. Must be one of: `['Stitch']`. Default: `Stitch`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
