---
title: authenticationConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/authenticationconfiguration
---

# AuthenticationConfiguration

*This schema defines the Authentication Configuration.*

## Properties

- **`provider`** *(string)*: SSO provider: no-auth, okta, google, azure, auth0, custom-oidc, aws-cognito, ldap, saml, etc.
- **`providerName`** *(string)*: Custom OIDC Authentication Provider Name.
- **`publicKeyUrls`** *(array)*: List of Public Key URLs.
  - **Items** *(string)*
- **`authority`** *(string)*: Authentication Authority.
- **`clientId`** *(string)*: Client ID.
- **`callbackUrl`** *(string)*: Callback URL.
- **`jwtPrincipalClaims`** *(array)*: Jwt Principal Claim.
  - **Items** *(string)*
- **`enableSelfSignup`** *(boolean)*: Enable Self Sign Up. Default: `False`.
- **`ldapConfiguration`**: LDAP Configuration in case the Provider is LDAP. Refer to *./ldapConfiguration.json*.
- **`samlConfiguration`**: Saml Configuration that is applicable only when the provider is Saml. Refer to *../../schema/security/client/samlSSOClientConfig.json*.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
