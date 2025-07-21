---
title: authorizerConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/authorizerconfiguration
---

# AuthorizerConfiguration

*This schema defines the Authorization Configuration.*

## Properties

- **`className`** *(string)*: Class Name for authorizer.
- **`containerRequestFilter`** *(string)*: Filter for the request authorization.
- **`adminPrincipals`** *(array)*: List of unique admin principals.
  - **Items** *(string)*
- **`botPrincipals`** *(array)*: **@Deprecated** List of unique bot principals. Default: `null`.
  - **Items** *(string)*
- **`testPrincipals`** *(array)*: List of unique principals used as test users. **NOTE THIS IS ONLY FOR TEST SETUP AND NOT TO BE USED IN PRODUCTION SETUP**.
  - **Items** *(string)*
- **`allowedEmailRegistrationDomains`** *(array)*: List of unique email domains that are allowed to signup on the platforms.
  - **Items** *(string)*
- **`principalDomain`** *(string)*: Principal Domain.
- **`enforcePrincipalDomain`** *(boolean)*: Enable Enforce Principal Domain.
- **`enableSecureSocketConnection`** *(boolean)*: Enable Secure Socket Connection.
- **`useRolesFromProvider`** *(boolean)*: Use Roles from Provider. Default: `false`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
