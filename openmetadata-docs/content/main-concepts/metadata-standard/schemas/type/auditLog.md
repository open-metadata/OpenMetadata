---
title: auditLog
slug: /main-concepts/metadata-standard/schemas/type/auditlog
---

# AuditLog

*This schema defines the Audit Log type to capture the audit trail of POST, PUT, and PATCH API operations.*

## Properties

- **`method`** *(string)*: HTTP Method used in a call. Must be one of: `['POST', 'PUT', 'PATCH', 'DELETE']`.
- **`responseCode`** *(integer)*: HTTP response code for the api requested.
- **`path`** *(string)*: Requested API Path.
- **`userName`** *(string)*: Name of the user who made the API request.
- **`entityId`**: Identifier of entity that was modified by the operation. Refer to *basic.json#/definitions/uuid*.
- **`entityType`** *(string)*: Type of Entity that is modified by the operation.
- **`timestamp`**: Timestamp when the API call is made in Unix epoch time milliseconds in Unix epoch time milliseconds. Refer to *basic.json#/definitions/timestamp*.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
