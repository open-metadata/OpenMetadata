---
title: personalAccessToken
slug: /main-concepts/metadata-standard/schemas/auth/personalaccesstoken
---

# PersonalAccessToken

*This schema defines Personal Access Token Schema.*

## Properties

- **`token`**: Unique Refresh Token for user. Refer to *../type/basic.json#/definitions/uuid*.
- **`tokenName`** *(string)*: Name of the token.
- **`userId`**: User Id of the User this refresh token is given to. Refer to *../type/basic.json#/definitions/uuid*.
- **`tokenType`**: Token Type. Refer to *./emailVerificationToken.json#/definitions/tokenType*. Default: `PERSONAL_ACCESS`.
- **`expiryDate`**: Expiry Date-Time of the token. Refer to *../type/basic.json#/definitions/timestamp*.
- **`jwtToken`** *(string)*: JWT Auth Token.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
