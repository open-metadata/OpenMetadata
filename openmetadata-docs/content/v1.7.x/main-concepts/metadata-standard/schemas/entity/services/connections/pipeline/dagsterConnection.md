---
title: Dagster Connection | OpenMetadata Dagster
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/dagsterconnection
---

# DagsterConnection

*Dagster Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/DagsterType](#definitions/DagsterType)*. Default: `"Dagster"`.
- **`host`** *(string, format: uri)*: URL to the Dagster instance.
- **`token`** *(string, format: password)*: To Connect to Dagster Cloud.
- **`timeout`** *(integer)*: Connection Time Limit Between OM and Dagster Graphql API in second. Default: `"1000"`.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`DagsterType`** *(string)*: Service type. Must be one of: `["Dagster"]`. Default: `"Dagster"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
