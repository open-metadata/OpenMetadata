---
title: splineConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/splineconnection
---

# SplineConnection

*Spline Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/SplineType*. Default: `Spline`.
- **`hostPort`** *(string)*: Spline REST Server Host & Port.
- **`uiHostPort`** *(string)*: Spline UI Host & Port.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`SplineType`** *(string)*: Service type. Must be one of: `['Spline']`. Default: `Spline`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
