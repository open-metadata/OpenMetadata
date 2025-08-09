---
title: quickSightConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/quicksightconnection
---

# QuickSightConnection

*QuickSight Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/quickSightType*. Default: `QuickSight`.
- **`awsConfig`**: Refer to *../../../../security/credentials/awsCredentials.json*.
- **`awsAccountId`** *(string)*: AWS Account ID.
- **`identityType`** *(string)*: The authentication method that the user uses to sign in. Must be one of: `['IAM', 'QUICKSIGHT', 'ANONYMOUS']`. Default: `IAM`.
- **`namespace`** *(string)*: The Amazon QuickSight namespace that contains the dashboard IDs in this request ( To be provided when identityType is `ANONYMOUS` ).
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`quickSightType`** *(string)*: QuickSight service type. Must be one of: `['QuickSight']`. Default: `QuickSight`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
