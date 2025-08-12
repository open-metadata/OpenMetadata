---
title: powerBIConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/powerbiconnection
---

# PowerBIConnection

*PowerBI Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/powerBiType*. Default: `PowerBI`.
- **`clientId`** *(string)*: client_id for PowerBI.
- **`clientSecret`** *(string)*: clientSecret for PowerBI.
- **`tenantId`** *(string)*: Tenant ID for PowerBI.
- **`authorityURI`** *(string)*: Authority URI for the PowerBI service. Default: `https://login.microsoftonline.com/`.
- **`hostPort`** *(string)*: Dashboard URL for PowerBI service. Default: `https://app.powerbi.com`.
- **`scope`** *(array)*: PowerBI secrets. Default: `['https://analysis.windows.net/powerbi/api/.default']`.
  - **Items** *(string)*
- **`pagination_entity_per_page`** *(integer)*: Entity Limit set here will be used to paginate the PowerBi APIs. Default: `100`.
- **`useAdminApis`** *(boolean)*: Fetch the PowerBI metadata using admin APIs. Default: `True`.
- **`displayTableNameFromSource`** *(boolean)*: Display Table Name from source instead of renamed table name for datamodel tables. Default: `False`.
- **`pbitFilesSource`**: Source to get the .pbit files to extract lineage information.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`powerBiType`** *(string)*: PowerBI service type. Must be one of: `['PowerBI']`. Default: `PowerBI`.
- **`localConfig`** *(object)*: Local config source where no extra information needs to be sent. Cannot contain additional properties.
  - **`pbitFileConfigType`** *(string)*: pbit File Configuration type. Must be one of: `['local']`. Default: `local`.
  - **`path`** *(string)*: Directory path for the pbit files.
  - **`pbitFilesExtractDir`** *(string)*: Path of the folder where the .pbit files will be unzipped and datamodel schema will be extracted. Default: `/tmp/pbitFiles`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
