---
title: passwordResetToken
slug: /main-concepts/metadata-standard/schemas/auth/passwordresettoken
---

# PasswordResetToken

*This schema defines Password Verification Token Schema.*

## Properties

- **`token`**: Unique Refresh Token for user. Refer to *../type/basic.json#/definitions/uuid*.
- **`userId`**: User Id of the User this refresh token is given to. Refer to *../type/basic.json#/definitions/uuid*.
- **`tokenType`**: Token Type. Refer to *./emailVerificationToken.json#/definitions/tokenType*. Default: `PASSWORD_RESET`.
- **`expiryDate`**: Expiry Date-Time of the token. Refer to *../type/basic.json#/definitions/timestamp*.
- **`isActive`** *(boolean)*: Expiry Date-Time of the token. Default: `True`.
- **`isClaimed`** *(boolean)*: Expiry Date-Time of the token. Default: `False`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
