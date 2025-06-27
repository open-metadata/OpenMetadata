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

- **`metabaseType`** *(string)*: Metabase service type. Must be one of: `["Metabase"]`. Default: `"Metabase"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
