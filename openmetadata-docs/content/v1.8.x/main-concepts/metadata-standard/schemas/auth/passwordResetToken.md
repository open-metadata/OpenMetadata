---
title: Password Reset Token | OpenMetadata Password Reset
slug: /main-concepts/metadata-standard/schemas/auth/passwordresettoken
---

# PasswordResetToken

*This schema defines Password Verification Token Schema.*

## Properties

- **`token`**: Unique Refresh Token for user. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`userId`**: User Id of the User this refresh token is given to. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`tokenType`**: Token Type. Refer to *[./emailVerificationToken.json#/definitions/tokenType](#emailVerificationToken.json#/definitions/tokenType)*. Default: `"PASSWORD_RESET"`.
- **`expiryDate`**: Expiry Date-Time of the token. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`isActive`** *(boolean)*: Expiry Date-Time of the token. Default: `true`.
- **`isClaimed`** *(boolean)*: Expiry Date-Time of the token. Default: `false`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
