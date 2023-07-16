---
title: splineConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/splineconnection
---

# SplineConnection

*Spline Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/SplineType](#definitions/SplineType)*. Default: `"Spline"`.
- **`hostPort`** *(string)*: Spline REST Server Host & Port.
- **`uiHostPort`** *(string)*: Spline UI Host & Port.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/SplineType"></a>**`SplineType`** *(string)*: Service type. Must be one of: `["Spline"]`. Default: `"Spline"`.


Documentation file automatically generated at 2023-07-16 19:59:36.193714.
