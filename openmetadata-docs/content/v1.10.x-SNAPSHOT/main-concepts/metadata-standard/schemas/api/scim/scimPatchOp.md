---
title: scimPatchOp
slug: /main-concepts/metadata-standard/schemas/api/scim/scimpatchop
---

# ScimPatchOp

*SCIM PatchOp request as per RFC 7644*

## Properties

- **`schemas`** *(array)*: Default: `['urn:ietf:params:scim:api:messages:2.0:PatchOp']`.
  - **Items** *(string)*
- **`Operations`** *(array)*
  - **Items** *(object)*
    - **`op`** *(string)*: Must be one of: `['add', 'replace', 'remove']`.
    - **`path`** *(string)*
    - **`value`** *(['object', 'array', 'string', 'boolean', 'number'])*


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
