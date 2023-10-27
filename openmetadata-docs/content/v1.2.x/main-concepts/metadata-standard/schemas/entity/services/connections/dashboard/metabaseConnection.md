---
title: metabaseConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/metabaseconnection
---

# MetabaseConnection

*Metabase Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/metabaseType](#definitions/metabaseType)*. Default: `"Metabase"`.
- **`username`** *(string)*: Username to connect to Metabase. This user should have privileges to read all the metadata in Metabase.
- **`password`** *(string, format: password)*: Password to connect to Metabase.
- **`hostPort`** *(string, format: uri)*: Host and Port of the Metabase instance.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/metabaseType"></a>**`metabaseType`** *(string)*: Metabase service type. Must be one of: `["Metabase"]`. Default: `"Metabase"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
