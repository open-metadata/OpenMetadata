---
title: bitbucketCredentials
slug: /main-concepts/metadata-standard/schemas/security/credentials/bitbucketcredentials
---

# BitBucketCredentials

*Credentials for a BitBucket repository*

## Properties

- **`type`**: Credentials Type. Refer to *#/definitions/bitbucketType*. Default: `BitBucket`.
- **`repositoryOwner`**: Refer to *gitCredentials.json#/definitions/repositoryOwner*.
- **`repositoryName`**: Refer to *gitCredentials.json#/definitions/repositoryName*.
- **`token`**: Refer to *gitCredentials.json#/definitions/token*.
- **`branch`** *(string)*: Main production branch of the repository. E.g., `main`.
## Definitions

- **`bitbucketType`** *(string)*: BitBucket Credentials type. Must be one of: `['BitBucket']`. Default: `BitBucket`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
