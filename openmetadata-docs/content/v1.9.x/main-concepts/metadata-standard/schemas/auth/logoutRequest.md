---
title: Logout Request API | OpenMetadata Logout API
description: Request logout schema to invalidate active tokens and end user sessions.
slug: /main-concepts/metadata-standard/schemas/auth/logoutrequest
---

# LogoutRequest

*This schema defines Logout Request.*

## Properties

- **`username`** *(string)*: Logout Username.
- **`token`** *(string)*: Token To be Expired.
- **`logoutTime`**: Logout Time. Refer to *[../type/basic.json#/definitions/dateTime](#/type/basic.json#/definitions/dateTime)*.
- **`refreshToken`** *(string)*: Refresh Token.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
