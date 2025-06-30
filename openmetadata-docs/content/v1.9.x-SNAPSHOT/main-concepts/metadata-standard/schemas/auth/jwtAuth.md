---
title: JWT Auth Schema | OpenMetadata JWT Authentication
slug: /main-concepts/metadata-standard/schemas/auth/jwtauth
---

# JWTAuthMechanism

*User/Bot JWTAuthMechanism.*

## Properties

- **`JWTToken`** *(string, format: password)*: JWT Auth Token.
- **`JWTTokenExpiry`**: Refer to *[#/definitions/JWTTokenExpiry](#definitions/JWTTokenExpiry)*.
- **`JWTTokenExpiresAt`**: JWT Auth Token expiration time. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
## Definitions

- **`JWTTokenExpiry`** *(string)*: JWT Auth Token expiration in days. Must be one of: `["OneHour", "1", "7", "30", "60", "90", "Unlimited"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
