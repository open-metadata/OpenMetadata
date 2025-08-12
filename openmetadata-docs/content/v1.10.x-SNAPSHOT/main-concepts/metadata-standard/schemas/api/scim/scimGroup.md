---
title: scimGroup
slug: /main-concepts/metadata-standard/schemas/api/scim/scimgroup
---

# ScimGroup

*SCIM-compliant Group object*

## Properties

- **`schemas`** *(array)*: SCIM schemas used for this resource. Default: `['urn:ietf:params:scim:schemas:core:2.0:Group']`.
  - **Items** *(string)*
- **`id`** *(string)*: Unique identifier for the group.
- **`displayName`** *(string)*: Human-readable name of the group.
- **`externalId`** *(string)*: External system identifier.
- **`active`** *(boolean)*: Whether the group is active.
- **`members`** *(array)*: Members of the group.
  - **Items** *(object)*
    - **`value`** *(string)*: ID of the member (user).
    - **`display`** *(string)*: Display name of the member.
    - **`type`** *(string)*: Type of member - typically 'User'.
- **`meta`** *(object)*: Metadata about the group.
  - **`resourceType`** *(string)*
  - **`created`** *(string)*
  - **`lastModified`** *(string)*
  - **`location`** *(string)*


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
