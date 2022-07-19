---
title: jwtAuth
slug: /main-concepts/metadata-standard/schemas/entity/teams/authn/jwtauth
---

# JWTAuthMechanism

*User/Bot JWTAuthMechanism.*

## Properties

- **`JWTToken`** *(string)*: JWT Auth Token.
- **`JWTTokenExpiry`**: Refer to *#/definitions/JWTTokenExpiry*.
- **`JWTTokenExpiresAt`**: JWT Auth Token expiration time. Refer to *../../../type/basic.json#/definitions/timestamp*.
## Definitions

- **`JWTTokenExpiry`** *(string)*: JWT Auth Token expiration in days. Must be one of: `['7', '30', '60', '90', 'Unlimited']`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
