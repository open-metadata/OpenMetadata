---
title: authenticationConfiguration | Official Documentation
description: Connect Authenticationconfiguration to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/configuration/authenticationconfiguration
---

# AuthenticationConfiguration

*This schema defines the Authentication Configuration.*

## Properties

- **`clientType`** *(string)*: Client Type. Must be one of: `["public", "confidential"]`. Default: `"public"`.
- **`provider`**: Refer to *[../entity/services/connections/metadata/openMetadataConnection.json#/definitions/authProvider](#/entity/services/connections/metadata/openMetadataConnection.json#/definitions/authProvider)*.
- **`responseType`**: This is used by auth provider provide response as either id_token or code. Refer to *[#/definitions/responseType](#definitions/responseType)*.
- **`providerName`** *(string)*: Custom OIDC Authentication Provider Name.
- **`publicKeyUrls`** *(array)*: List of Public Key URLs.
  - **Items** *(string)*
- **`tokenValidationAlgorithm`** *(string)*: Token Validation Algorithm to use. Must be one of: `["RS256", "RS384", "RS512"]`. Default: `"RS256"`.
- **`authority`** *(string)*: Authentication Authority.
- **`clientId`** *(string)*: Client ID.
- **`callbackUrl`** *(string)*: Callback URL.
- **`jwtPrincipalClaims`** *(array)*: Jwt Principal Claim.
  - **Items** *(string)*
- **`jwtPrincipalClaimsMapping`** *(array)*: Jwt Principal Claim Mapping.
  - **Items** *(string)*
- **`enableSelfSignup`** *(boolean)*: Enable Self Sign Up. Default: `false`.
- **`ldapConfiguration`**: LDAP Configuration in case the Provider is LDAP. Refer to *[./ldapConfiguration.json](#ldapConfiguration.json)*.
- **`samlConfiguration`**: Saml Configuration that is applicable only when the provider is Saml. Refer to *[../security/client/samlSSOClientConfig.json](#/security/client/samlSSOClientConfig.json)*.
- **`oidcConfiguration`**: Oidc Configuration for Confidential Client Type. Refer to *[../security/client/oidcClientConfig.json](#/security/client/oidcClientConfig.json)*.
## Definitions

- **`responseType`** *(string)*: Response Type. Must be one of: `["id_token", "code"]`. Default: `"id_token"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
