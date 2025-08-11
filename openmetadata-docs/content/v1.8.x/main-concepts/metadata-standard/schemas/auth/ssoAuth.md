---
title: SSO Auth Schema | OpenMetadata Single Sign-On
description: Authenticate with a single sign-on provider using this SSO auth schema.
slug: /main-concepts/metadata-standard/schemas/auth/ssoauth
---

# SSOAuthMechanism

*User/Bot SSOAuthN.*

## Properties

- **`ssoServiceType`** *(string)*: Type of database service such as Amundsen, Atlas... Must be one of: `["google", "okta", "auth0", "custom-oidc", "azure"]`.
- **`authConfig`**: The authentication configuration used by the SSO.
  - **One of**
    - : Google SSO Configuration. Refer to *[../security/client/googleSSOClientConfig.json](#/security/client/googleSSOClientConfig.json)*.
    - : Okta SSO Configuration. Refer to *[../security/client/oktaSSOClientConfig.json](#/security/client/oktaSSOClientConfig.json)*.
    - : Auth0 SSO Configuration. Refer to *[../security/client/auth0SSOClientConfig.json](#/security/client/auth0SSOClientConfig.json)*.
    - : Azure SSO Configuration. Refer to *[../security/client/azureSSOClientConfig.json](#/security/client/azureSSOClientConfig.json)*.
    - : Custom OIDC SSO Configuration. Refer to *[../security/client/customOidcSSOClientConfig.json](#/security/client/customOidcSSOClientConfig.json)*.
    - : SAML SSO Configuration. Refer to *[../security/client/samlSSOClientConfig.json](#/security/client/samlSSOClientConfig.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
