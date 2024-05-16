---
title: dagsterConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/dagsterconnection
---

# DagsterConnection

*Dagster Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/DagsterType*. Default: `Dagster`.
- **`host`** *(string)*: URL to the Dagster instance.
- **`token`** *(string)*: To Connect to Dagster Cloud.
- **`timeout`** *(integer)*: Connection Time Limit Between OM and Dagster Graphql API in second. Default: `1000`.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`DagsterType`** *(string)*: Service type. Must be one of: `['Dagster']`. Default: `Dagster`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
