---
title: verifySSLConfig
slug: /main-concepts/metadata-standard/schemas/security/ssl/verifysslconfig
---

# Verify SSL Config

*Client configuration to validate SSL certificates.*

## Definitions

- **`verifySSL`** *(string)*: Client SSL verification. Make sure to configure the SSLConfig if enabled. Must be one of: `['no-ssl', 'ignore', 'validate']`. Default: `no-ssl`.
- **`sslMode`**: SSL Mode to connect to database. Must be one of: `['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full']`. Default: `disable`.
- **`sslConfig`**: Client SSL configuration.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
