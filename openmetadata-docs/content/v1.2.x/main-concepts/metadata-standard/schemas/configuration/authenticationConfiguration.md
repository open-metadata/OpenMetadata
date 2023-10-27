---
title: authenticationConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/authenticationconfiguration
---

# AuthenticationConfiguration

*This schema defines the Authentication Configuration.*

## Properties

- **`provider`**: Refer to *[../entity/services/connections/metadata/openMetadataConnection.json#/definitions/authProvider](#/entity/services/connections/metadata/openMetadataConnection.json#/definitions/authProvider)*.
- **`providerName`** *(string)*: Custom OIDC Authentication Provider Name.
- **`publicKeyUrls`** *(array)*: List of Public Key URLs.
  - **Items** *(string)*
- **`authority`** *(string)*: Authentication Authority.
- **`clientId`** *(string)*: Client ID.
- **`callbackUrl`** *(string)*: Callback URL.
- **`jwtPrincipalClaims`** *(array)*: Jwt Principal Claim.
  - **Items** *(string)*
- **`enableSelfSignup`** *(boolean)*: Enable Self Sign Up. Default: `false`.
- **`ldapConfiguration`**: LDAP Configuration in case the Provider is LDAP. Refer to *[./ldapConfiguration.json](#ldapConfiguration.json)*.
- **`samlConfiguration`**: Saml Configuration that is applicable only when the provider is Saml. Refer to *[../security/client/samlSSOClientConfig.json](#/security/client/samlSSOClientConfig.json)*.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
