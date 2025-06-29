---
title: lookerConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/lookerconnection
---

# LookerConnection

*Looker Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/lookerType](#definitions/lookerType)*. Default: `"Looker"`.
- **`clientId`** *(string)*: User's Client ID. This user should have privileges to read all the metadata in Looker.
- **`clientSecret`** *(string, format: password)*: User's Client Secret.
- **`hostPort`** *(string, format: uri)*: URL to the Looker instance.
- **`gitCredentials`**: Credentials to extract the .lkml files from a repository. This is required to get all the lineage and definitions.
  - **One of**
    - : Refer to *[#/definitions/noGitCredentials](#definitions/noGitCredentials)*.
    - : Refer to *[../../../../security/credentials/githubCredentials.json](#/../../../security/credentials/githubCredentials.json)*.
    - : Refer to *[../../../../security/credentials/bitbucketCredentials.json](#/../../../security/credentials/bitbucketCredentials.json)*.
    - : Refer to *[../../../../security/credentials/gitlabCredentials.json](#/../../../security/credentials/gitlabCredentials.json)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`lookerType`** *(string)*: Looker service type. Must be one of: `["Looker"]`. Default: `"Looker"`.
- **`noGitCredentials`** *(object)*: Do not set any credentials. Note that credentials are required to extract .lkml views and their lineage. Cannot contain additional properties.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
