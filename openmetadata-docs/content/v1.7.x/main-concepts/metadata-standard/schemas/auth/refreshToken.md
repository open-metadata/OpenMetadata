---
title: Refresh Token API | OpenMetadata Token Refresh
description: Refresh a user authentication token to maintain session continuity securely.
slug: /main-concepts/metadata-standard/schemas/auth/refreshtoken
---

# RefreshToken

*This schema defines Refresh Token Schema.*

## Properties

- **`token`**: Unique Refresh Token for user. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`userId`**: User Id of the User this refresh token is given to. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`tokenType`**: Token Type. Refer to *[./emailVerificationToken.json#/definitions/tokenType](#emailVerificationToken.json#/definitions/tokenType)*. Default: `"REFRESH_TOKEN"`.
- **`refreshCount`** *(integer)*: Refresh Count.
- **`maxRefreshCount`** *(integer)*: Refresh Count.
- **`expiryDate`**: Expiry Date-Time of the token. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
