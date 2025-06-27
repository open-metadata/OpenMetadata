---
title: qlikCloudConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/qlikcloudconnection
---

# QlikCloudConnection

*Qlik Cloud Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/qlikCloudType](#definitions/qlikCloudType)*. Default: `"QlikCloud"`.
- **`token`** *(string, format: password)*: token to connect to Qlik Cloud.
- **`hostPort`** *(string, format: uri)*: Host and Port of the Qlik Cloud instance.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`qlikCloudType`** *(string)*: Qlik Cloud service type. Must be one of: `["QlikCloud"]`. Default: `"QlikCloud"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
