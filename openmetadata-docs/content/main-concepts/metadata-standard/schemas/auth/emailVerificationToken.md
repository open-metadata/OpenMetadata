---
title: emailVerificationToken
slug: /main-concepts/metadata-standard/schemas/auth/emailverificationtoken
---

# EmailVerificationToken

*This schema defines Email Verification Token Schema.*

## Properties

- **`token`**: Unique Refresh Token for user. Refer to *../type/basic.json#/definitions/uuid*.
- **`userId`**:  User this email Verification token is given to. Refer to *../type/basic.json#/definitions/uuid*.
- **`tokenType`**: Token Type. Refer to *#/definitions/tokenType*. Default: `EMAIL_VERIFICATION`.
- **`tokenStatus`** *(string)*: Refresh Count. Must be one of: `['STATUS_PENDING', 'STATUS_CONFIRMED']`.
- **`expiryDate`**: Expiry Date-Time of the token. Refer to *../type/basic.json#/definitions/timestamp*.
## Definitions

- **`tokenType`** *(string)*: Refresh Count. Must be one of: `['REFRESH_TOKEN', 'EMAIL_VERIFICATION', 'PASSWORD_RESET']`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
