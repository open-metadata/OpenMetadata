---
title: verifySSLConfig
slug: /main-concepts/metadata-standard/schemas/security/ssl/verifysslconfig
---

# Verify SSL Config

*Client configuration to validate SSL certificates.*

## Definitions

- <a id="definitions/verifySSL"></a>**`verifySSL`** *(string)*: Client SSL verification. Make sure to configure the SSLConfig if enabled. Must be one of: `["no-ssl", "ignore", "validate"]`. Default: `"no-ssl"`.
- <a id="definitions/sslConfig"></a>**`sslConfig`**: Client SSL configuration.
  - **One of**
    - : Refer to *[validateSSLClientConfig.json](#lidateSSLClientConfig.json)*.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
