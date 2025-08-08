---
title: sigmaConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/sigmaconnection
---

# SigmaConnection

*Sigma Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/sigmaType*. Default: `Sigma`.
- **`hostPort`** *(string)*: Sigma API url. Default: `https://api.sigmacomputing.com`.
- **`clientId`** *(string)*: client_id for Sigma.
- **`clientSecret`** *(string)*: clientSecret for Sigma.
- **`apiVersion`** *(string)*: Sigma API version. Default: `v2`.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`sigmaType`** *(string)*: Sigma service type. Must be one of: `['Sigma']`. Default: `Sigma`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
