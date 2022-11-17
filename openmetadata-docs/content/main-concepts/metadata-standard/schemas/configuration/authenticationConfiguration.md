---
title: authenticationConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/authenticationconfiguration
---

# AuthenticationConfiguration

*This schema defines the Authentication Configuration.*

## Properties

- **`provider`** *(string)*: SSO provider , no-auth, okta, google , azure etc.
- **`providerName`** *(string)*: Custom OIDC Authentication Provider Name.
- **`publicKeyUrls`** *(array)*: List of Public Key URLs.
  - **Items** *(string)*
- **`authority`** *(string)*: Authentication Authority.
- **`clientId`** *(string)*: Client ID.
- **`callbackUrl`** *(string)*: Callback URL.
- **`jwtPrincipalClaims`** *(array)*: Jwt Principal Claim.
  - **Items** *(string)*


Documentation file automatically generated at 2022-09-18 19:21:45.413954.
