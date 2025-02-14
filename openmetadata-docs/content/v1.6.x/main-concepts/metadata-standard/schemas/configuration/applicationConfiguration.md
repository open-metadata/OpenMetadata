---
title: applicationConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/applicationconfiguration
---

# ApplicationConfiguration

*This schema defines the Application Configuration.*

## Properties

- **`logoConfig`**: Refer to *#/definitions/logoConfiguration*.
- **`loginConfig`**: Refer to *#/definitions/loginConfiguration*.
## Definitions

- **`logoConfiguration`** *(object)*: This schema defines the Logo Configuration. Cannot contain additional properties.
  - **`customLogoUrlPath`** *(string)*: Login Page Logo Image Url.
  - **`customMonogramUrlPath`** *(string)*: Navigation Bar Logo Image Url.
- **`loginConfiguration`** *(object)*: This schema defines the Login Configuration. Cannot contain additional properties.
  - **`maxLoginFailAttempts`** *(integer)*: Failed Login Attempts allowed for user. Default: `3`.
  - **`accessBlockTime`** *(integer)*: Access Block time for user on exceeding failed attempts(in seconds). Default: `600`.
  - **`jwtTokenExpiryTime`** *(integer)*: Jwt Token Expiry time for login in seconds. Default: `3600`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
