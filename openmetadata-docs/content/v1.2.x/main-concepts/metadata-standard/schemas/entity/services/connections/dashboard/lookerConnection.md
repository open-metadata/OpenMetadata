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
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/lookerType"></a>**`lookerType`** *(string)*: Looker service type. Must be one of: `["Looker"]`. Default: `"Looker"`.
- <a id="definitions/noGitCredentials"></a>**`noGitCredentials`** *(object)*: Do not set any credentials. Note that credentials are required to extract .lkml views and their lineage. Cannot contain additional properties.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
