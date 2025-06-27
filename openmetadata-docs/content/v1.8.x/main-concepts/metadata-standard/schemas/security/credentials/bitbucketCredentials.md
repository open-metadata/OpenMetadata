---
title: bitbucketCredentials
slug: /main-concepts/metadata-standard/schemas/security/credentials/bitbucketcredentials
---

# BitBucketCredentials

*Credentials for a BitBucket repository*

## Properties

- **`type`**: Credentials Type. Refer to *[#/definitions/bitbucketType](#definitions/bitbucketType)*. Default: `"BitBucket"`.
- **`repositoryOwner`**: Refer to *[gitCredentials.json#/definitions/repositoryOwner](#tCredentials.json#/definitions/repositoryOwner)*.
- **`repositoryName`**: Refer to *[gitCredentials.json#/definitions/repositoryName](#tCredentials.json#/definitions/repositoryName)*.
- **`token`**: Refer to *[gitCredentials.json#/definitions/token](#tCredentials.json#/definitions/token)*.
- **`branch`** *(string)*: Main production branch of the repository. E.g., `main`.
## Definitions

- **`bitbucketType`** *(string)*: BitBucket Credentials type. Must be one of: `["BitBucket"]`. Default: `"BitBucket"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
