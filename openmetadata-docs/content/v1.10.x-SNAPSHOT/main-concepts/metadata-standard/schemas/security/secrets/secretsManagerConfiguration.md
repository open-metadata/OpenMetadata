---
title: secretsManagerConfiguration
slug: /main-concepts/metadata-standard/schemas/security/secrets/secretsmanagerconfiguration
---

# SecretsManagerConfiguration

*OpenMetadata server configuration for the Secrets Manager feature.*

## Properties

- **`secretsManager`**: OpenMetadata Secrets Manager Provider. Make sure to configure the same secrets manager providers as the ones configured on the OpenMetadata server. Refer to *secretsManagerProvider.json*. Default: `noop`.
- **`prefix`** *(string)*: Prefix to be added to the secret key ID: `/<prefix>/<clusterName>/<key>`.
- **`tags`** *(array)*: Add tags to the created resource, e.g., in AWS. Format is `[key1:value1,key2:value2,...]`. Default: `None`.
  - **Items** *(string)*
- **`parameters`** *(object)*: Extra parameters used by the Secrets Manager implementation. Can contain additional properties.
  - **Additional Properties**


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
