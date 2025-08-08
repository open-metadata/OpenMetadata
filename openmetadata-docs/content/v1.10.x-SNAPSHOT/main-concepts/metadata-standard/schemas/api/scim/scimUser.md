---
title: scimUser
slug: /main-concepts/metadata-standard/schemas/api/scim/scimuser
---

# ScimUser

*SCIM-compliant User object*

## Properties

- **`schemas`** *(array)*
  - **Items** *(string)*
- **`id`** *(string)*
- **`externalId`** *(string)*
- **`userName`** *(string)*
- **`displayName`** *(string)*
- **`active`** *(boolean)*: Default: `True`.
- **`title`** *(string)*
- **`preferredLanguage`** *(string)*
- **`emails`** *(array)*
  - **Items** *(object)*
    - **`value`** *(string)*
    - **`type`** *(string)*
    - **`primary`** *(boolean)*
- **`phoneNumbers`** *(array)*
  - **Items** *(object)*
    - **`value`** *(string)*
    - **`type`** *(string)*
- **`addresses`** *(array)*
  - **Items** *(object)*
    - **`type`** *(string)*
    - **`formatted`** *(string)*
    - **`streetAddress`** *(string)*
    - **`locality`** *(string)*
    - **`region`** *(string)*
    - **`postalCode`** *(string)*
    - **`country`** *(string)*
- **`name`** *(object)*
  - **`givenName`** *(string)*
  - **`familyName`** *(string)*
  - **`formatted`** *(string)*
- **`meta`** *(object)*: Can contain additional properties.
  - **`resourceType`** *(string)*
  - **`created`** *(string)*
  - **`lastModified`** *(string)*
  - **`location`** *(string)*
- **`urn:ietf:params:scim:schemas:extension:enterprise:2.0:User`** *(object)*
  - **`employeeId`** *(string)*
  - **`department`** *(string)*
  - **`manager`** *(object)*
    - **`value`** *(string)*
    - **`displayName`** *(string)*


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
