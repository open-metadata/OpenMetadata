---
title: PowerBI Connection | OpenMetadata PowerBI Integration
description: Power BI connection schema including tenant ID, client secret, and authority URL setup.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/powerbiconnection
---

# PowerBIConnection

*PowerBI Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/powerBiType](#definitions/powerBiType)*. Default: `"PowerBI"`.
- **`clientId`** *(string)*: client_id for PowerBI.
- **`clientSecret`** *(string, format: password)*: clientSecret for PowerBI.
- **`tenantId`** *(string)*: Tenant ID for PowerBI.
- **`authorityURI`** *(string)*: Authority URI for the PowerBI service. Default: `"https://login.microsoftonline.com/"`.
- **`hostPort`** *(string, format: uri)*: Dashboard URL for PowerBI service. Default: `"https://app.powerbi.com"`.
- **`scope`** *(array)*: PowerBI secrets. Default: `["https://analysis.windows.net/powerbi/api/.default"]`.
  - **Items** *(string)*
- **`pagination_entity_per_page`** *(integer)*: Entity Limit set here will be used to paginate the PowerBi APIs. Default: `100`.
- **`useAdminApis`** *(boolean)*: Fetch the PowerBI metadata using admin APIs. Default: `true`.
- **`pbitFilesSource`**: Source to get the .pbit files to extract lineage information.
  - **One of**
    - : Refer to *[#/definitions/localConfig](#definitions/localConfig)*.
    - : Refer to *[powerbi/azureConfig.json](#werbi/azureConfig.json)*.
    - : Refer to *[powerbi/gcsConfig.json](#werbi/gcsConfig.json)*.
    - : Refer to *[powerbi/s3Config.json](#werbi/s3Config.json)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`powerBiType`** *(string)*: PowerBI service type. Must be one of: `["PowerBI"]`. Default: `"PowerBI"`.
- **`localConfig`** *(object)*: Local config source where no extra information needs to be sent. Cannot contain additional properties.
  - **`pbitFileConfigType`** *(string)*: pbit File Configuration type. Must be one of: `["local"]`. Default: `"local"`.
  - **`path`** *(string)*: Directory path for the pbit files.
  - **`pbitFilesExtractDir`** *(string)*: Path of the folder where the .pbit files will be unzipped and datamodel schema will be extracted. Default: `"/tmp/pbitFiles"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
