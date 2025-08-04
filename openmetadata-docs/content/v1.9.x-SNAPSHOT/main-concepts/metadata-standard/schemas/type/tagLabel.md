---
title: Tag Label | OpenMetadata Tag Label Schema
description: TagLabel schema tracks tag assignments, state (suggested/approved), and source system.
slug: /main-concepts/metadata-standard/schemas/type/taglabel
---

# TagLabel

*This schema defines the type for labeling an entity with a Tag.*

## Properties

- **`tagFQN`**: Refer to *[#/definitions/tagFQN](#definitions/tagFQN)*.
- **`name`** *(string)*: Name of the tag or glossary term.
- **`displayName`** *(string)*: Display Name that identifies this tag.
- **`description`**: Description for the tag label. Refer to *[../type/basic.json#/definitions/markdown](#/type/basic.json#/definitions/markdown)*.
- **`style`**: Refer to *[../type/basic.json#/definitions/style](#/type/basic.json#/definitions/style)*.
- **`source`**: Label is from Tags or Glossary. Refer to *[#/definitions/TagSource](#definitions/TagSource)*.
- **`labelType`** *(string)*: Label type describes how a tag label was applied. 'Manual' indicates the tag label was applied by a person. 'Derived' indicates a tag label was derived using the associated tag relationship (see Classification.json for more details). 'Propagated` indicates a tag label was propagated from upstream based on lineage. 'Automated' is used when a tool was used to determine the tag label. Must be one of: `["Manual", "Propagated", "Automated", "Derived"]`. Default: `"Manual"`.
- **`state`** *(string)*: 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the entity must confirm the suggested labels before it is marked as 'Confirmed'. Must be one of: `["Suggested", "Confirmed"]`. Default: `"Confirmed"`.
- **`href`**: Link to the tag resource. Refer to *[basic.json#/definitions/href](#sic.json#/definitions/href)*.
## Definitions

- **`tagFQN`** *(string)*
- **`TagSource`** *(string)*: Must be one of: `["Classification", "Glossary"]`. Default: `"Classification"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
