---
title: refreshToken
slug: /main-concepts/metadata-standard/schemas/auth/refreshtoken
---

# RefreshToken

*This schema defines Refresh Token Schema.*

## Properties

- **`token`**: Unique Refresh Token for user. Refer to *../type/basic.json#/definitions/uuid*.
- **`userId`**: User Id of the User this refresh token is given to. Refer to *../type/basic.json#/definitions/uuid*.
- **`tokenType`**: Token Type. Refer to *./emailVerificationToken.json#/definitions/tokenType*. Default: `REFRESH_TOKEN`.
- **`refreshCount`** *(integer)*: Refresh Count.
- **`maxRefreshCount`** *(integer)*: Refresh Count.
- **`expiryDate`**: Expiry Date-Time of the token. Refer to *../type/basic.json#/definitions/timestamp*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
