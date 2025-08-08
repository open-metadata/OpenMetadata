---
title: metabaseConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/metabaseconnection
---

# MetabaseConnection

*Metabase Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/metabaseType*. Default: `Metabase`.
- **`username`** *(string)*: Username to connect to Metabase. This user should have privileges to read all the metadata in Metabase.
- **`password`** *(string)*: Password to connect to Metabase.
- **`hostPort`** *(string)*: Host and Port of the Metabase instance.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`metabaseType`** *(string)*: Metabase service type. Must be one of: `['Metabase']`. Default: `Metabase`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
