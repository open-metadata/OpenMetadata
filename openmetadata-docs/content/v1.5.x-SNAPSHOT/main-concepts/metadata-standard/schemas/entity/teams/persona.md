---
title: persona
slug: /main-concepts/metadata-standard/schemas/entity/teams/persona
---

# Team

*This schema defines the Persona entity. A `Persona` is a job function associated with a user. An Example, Data Engineer or Data Consumer is a Persona of a user in Metadata world.*

## Properties

- **`id`**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: A unique name of Persona. Example 'data engineer'. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Data Steward'.
- **`description`**: Description of the persona. Refer to *../../type/basic.json#/definitions/markdown*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`users`**: Users that are assigned a persona. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
