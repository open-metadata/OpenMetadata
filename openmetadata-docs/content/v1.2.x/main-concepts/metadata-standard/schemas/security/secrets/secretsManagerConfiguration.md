---
title: secretsManagerConfiguration
slug: /main-concepts/metadata-standard/schemas/security/secrets/secretsmanagerconfiguration
---

# ValidateSSLClientConfig

*OpenMetadata server configuration for the Secrets Manager feature.*

## Properties

- **`secretsManager`**: OpenMetadata Secrets Manager Provider. Make sure to configure the same secrets manager providers as the ones configured on the OpenMetadata server. Refer to *[secretsManagerProvider.json](#cretsManagerProvider.json)*. Default: `"noop"`.
- **`parameters`** *(object)*: Extra parameters used by the Secrets Manager implementation. Can contain additional properties.
  - **Additional Properties**


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
