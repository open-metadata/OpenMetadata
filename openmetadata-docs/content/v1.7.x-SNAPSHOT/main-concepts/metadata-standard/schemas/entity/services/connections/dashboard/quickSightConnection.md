---
title: quickSightConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/quicksightconnection
---

# QuickSightConnection

*QuickSight Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/quickSightType](#definitions/quickSightType)*. Default: `"QuickSight"`.
- **`awsConfig`**: Refer to *[../../../../security/credentials/awsCredentials.json](#/../../../security/credentials/awsCredentials.json)*.
- **`awsAccountId`** *(string)*: AWS Account ID.
- **`identityType`** *(string)*: The authentication method that the user uses to sign in. Must be one of: `["IAM", "QUICKSIGHT", "ANONYMOUS"]`. Default: `"IAM"`.
- **`namespace`** *(string)*: The Amazon QuickSight namespace that contains the dashboard IDs in this request ( To be provided when identityType is `ANONYMOUS` ).
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`quickSightType`** *(string)*: QuickSight service type. Must be one of: `["QuickSight"]`. Default: `"QuickSight"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
