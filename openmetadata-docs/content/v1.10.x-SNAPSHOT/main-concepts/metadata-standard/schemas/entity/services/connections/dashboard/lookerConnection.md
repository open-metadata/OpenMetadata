---
title: lookerConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/lookerconnection
---

# LookerConnection

*Looker Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/lookerType*. Default: `Looker`.
- **`clientId`** *(string)*: User's Client ID. This user should have privileges to read all the metadata in Looker.
- **`clientSecret`** *(string)*: User's Client Secret.
- **`hostPort`** *(string)*: URL to the Looker instance.
- **`gitCredentials`**: Credentials to extract the .lkml files from a repository. This is required to get all the lineage and definitions.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`lookerType`** *(string)*: Looker service type. Must be one of: `['Looker']`. Default: `Looker`.
- **`noGitCredentials`** *(object)*: Do not set any credentials. Note that credentials are required to extract .lkml views and their lineage. Cannot contain additional properties.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
