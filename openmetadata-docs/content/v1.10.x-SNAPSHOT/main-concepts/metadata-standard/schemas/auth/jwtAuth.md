---
title: jwtAuth
slug: /main-concepts/metadata-standard/schemas/auth/jwtauth
---

# JWTAuthMechanism

*User/Bot JWTAuthMechanism.*

## Properties

- **`JWTToken`** *(string)*: JWT Auth Token.
- **`JWTTokenExpiry`**: Refer to *#/definitions/JWTTokenExpiry*.
- **`JWTTokenExpiresAt`**: JWT Auth Token expiration time. Refer to *../type/basic.json#/definitions/timestamp*.
## Definitions

- **`JWTTokenExpiry`** *(string)*: JWT Auth Token expiration in days. Must be one of: `['OneHour', '1', '7', '30', '60', '90', 'Unlimited']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
