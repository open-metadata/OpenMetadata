---
title: changeEvent
slug: /main-concepts/metadata-standard/schemas/type/changeevent
---

# ChangeEvent

*This schema defines the change event type to capture the changes to entities. Entities change due to user activity, such as updating description of a dataset, changing ownership, or adding new tags. Entity also changes due to activities at the metadata sources, such as a new dataset was created, a datasets was deleted, or schema of a dataset is modified. When state of entity changes, an event is produced. These events can be used to build apps and bots that respond to the change from activities.*

## Properties

- **`eventType`**: Refer to *#/definitions/eventType*.
- **`entityType`** *(string)*: Entity type that changed. Use the schema of this entity to process the entity attribute.
- **`entityId`**: Identifier of entity that was modified by the operation. Refer to *basic.json#/definitions/uuid*.
- **`entityFullyQualifiedName`** *(string)*: Fully Qualified Name of entity that was modified by the operation.
- **`previousVersion`**: Version of the entity before this change. Note that not all changes result in entity version change. When entity version is not changed, `previousVersion` is same as `currentVersion`. Refer to *entityHistory.json#/definitions/entityVersion*.
- **`currentVersion`**: Current version of the entity after this change. Note that not all changes result in entity version change. When entity version is not changed, `previousVersion` is same as `currentVersion`. Refer to *entityHistory.json#/definitions/entityVersion*.
- **`userName`** *(string)*: Name of the user whose activity resulted in the change.
- **`timestamp`**: Timestamp when the change was made in Unix epoch time milliseconds. Refer to *basic.json#/definitions/timestamp*.
- **`changeDescription`**: For `eventType` `entityUpdated` this field captures details about what fields were added/updated/deleted. For `eventType` `entityCreated` or `entityDeleted` this field is null. Refer to *entityHistory.json#/definitions/changeDescription*.
- **`entity`**: For `eventType` `entityCreated`, this field captures JSON coded string of the entity using the schema corresponding to `entityType`.
## Definitions

- **`eventType`** *(string)*: Type of event. Must be one of: `['entityCreated', 'entityUpdated', 'entitySoftDeleted', 'entityDeleted']`.
- **`eventFilter`** *(object)*: Cannot contain additional properties.
  - **`eventType`**: Event type that is being requested. Refer to *#/definitions/eventType*.
  - **`entities`** *(array)*: Entities for which the events are needed. Example - `table`, `topic`, etc. **When not set, events for all the entities will be provided**.
    - **Items** *(string)*


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
