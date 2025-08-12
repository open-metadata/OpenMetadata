---
title: bot
slug: /main-concepts/metadata-standard/schemas/entity/bot
---

# Bot

*This schema defines a Bot entity. A bot automates tasks, such as adding description, identifying the importance of data. It performs this task as a special user in the system.*

## Properties

- **`id`**: Unique identifier of a bot instance. Refer to *../type/basic.json#/definitions/uuid*.
- **`name`**: Name of the bot. Refer to *../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'FirstName LastName'.
- **`description`**: Description of the bot. Refer to *../type/basic.json#/definitions/markdown*.
- **`botUser`**: Bot user created for this bot on behalf of which the bot performs all the operations, such as updating description, responding on the conversation threads, etc. Refer to *../type/entityReference.json*.
- **`provider`**: Refer to *../type/basic.json#/definitions/providerType*.
- **`version`**: Metadata version of the entity. Refer to *../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this bot. Refer to *../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`domains`**: Domains the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *../type/entityReferenceList.json*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
