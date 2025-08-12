---
title: Sigma Connection | OpenMetadata Sigma Dashboard Connection
description: Sigma dashboard connection schema including credentials, workspace IDs, and API host configs.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/sigmaconnection
---

# SigmaConnection

*Sigma Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/sigmaType](#definitions/sigmaType)*. Default: `"Sigma"`.
- **`hostPort`** *(string, format: uri)*: Sigma API url. Default: `"https://api.sigmacomputing.com"`.
- **`clientId`** *(string)*: client_id for Sigma.
- **`clientSecret`** *(string, format: password)*: clientSecret for Sigma.
- **`apiVersion`** *(string)*: Sigma API version. Default: `"v2"`.
## Definitions

- **`sigmaType`** *(string)*: Sigma service type. Must be one of: `["Sigma"]`. Default: `"Sigma"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
