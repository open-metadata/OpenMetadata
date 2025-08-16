---
title: verifySSLConfig | OpenMetadata SSL Verify Config
description: Define schema for verifying SSL configurations including trust store locations, protocols supported, and validation strategy.
slug: /main-concepts/metadata-standard/schemas/security/ssl/verifysslconfig
---

# Verify SSL Config

*Client configuration to validate SSL certificates.*

## Definitions

- **`verifySSL`** *(string)*: Client SSL verification. Make sure to configure the SSLConfig if enabled. Must be one of: `["no-ssl", "ignore", "validate"]`. Default: `"no-ssl"`.
- **`sslMode`**: SSL Mode to connect to database. Must be one of: `["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]`. Default: `"disable"`.
- **`sslConfig`**: Client SSL configuration.
  - **One of**
    - : Refer to *[validateSSLClientConfig.json](#lidateSSLClientConfig.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
