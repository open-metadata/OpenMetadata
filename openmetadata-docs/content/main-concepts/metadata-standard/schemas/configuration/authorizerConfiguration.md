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
- **`botPrincipals`** *(array)*: List of unique bot principals.
  - **Items** *(string)*
- **`testPrincipals`** *(array)*: List of unique principals used as test users. **NOTE THIS IS ONLY FOR TEST SETUP AND NOT TO BE USED IN PRODUCTION SETUP**.
  - **Items** *(string)*
- **`principalDomain`** *(string)*: Principal Domain.
- **`enforcePrincipalDomain`** *(boolean)*: Enable Enforce Principal Domain.
- **`enableSecureSocketConnection`** *(boolean)*: Enable Secure Socket Connection.


Documentation file automatically generated at 2022-09-18 19:21:45.413954.
