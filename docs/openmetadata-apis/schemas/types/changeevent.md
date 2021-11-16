# ChangeEvent

This schema defines the change event type to capture the changes to entities. Entities change due to user activity, such as updating description of a dataset, changing ownership, or adding new tags. Entity also changes due to activities at the metadata sources, such as a new dataset was created, a datasets was deleted, or schema of a dataset is modified. When state of entity changes, an event is produced. These events can be used to build apps and bots that respond to the change from activities.

**$id: [https://open-metadata.org/schema/type/auditLog.json](https://open-metadata.org/schema/type/auditLog.json)**

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
- **eventType** `required`
  - $ref: [#/definitions/eventType](#eventtype)
- **entityType** `required`
  - Entity type that changed. Use the schema of this entity to process the entity attribute.
  - Type: `string`
- **entityId** `required`
  - Identifier of entity that was modified by the operation.
  - $ref: [basic.json#/definitions/uuid](basic.md#uuid)
- **previousVersion**
  - Version of the entity before this change. Note that not all changes result in entity version change. When entity version is not changed, `previousVersion` is same as `currentVersion`.
  - $ref: [entityHistory.json#/definitions/entityVersion](entityhistory.md#entityversion)
- **currentVersion**
  - Current version of the entity after this change. Note that not all changes result in entity version change. When entity version is not changed, `previousVersion` is same as `currentVersion`.
  - $ref: [entityHistory.json#/definitions/entityVersion](entityhistory.md#entityversion)
- **userName**
  - Name of the user whose activity resulted in the change.
  - Type: `string`
- **dateTime** `required`
  - Date and time when the change was made.
  - $ref: [basic.json#/definitions/dateTime](basic.md#datetime)
- **changeDescription**
  - For `eventType` `entityUpdated` this field captures details about what fields were added/updated/deleted. For `eventType` `entityCreated` or `entityDeleted` this field is null.
  - $ref: [entityHistory.json#/definitions/changeDescription](entityhistory.md#changedescription)
- **entity**
  - For `eventType` `entityCreated`, this field captures JSON coded string of the entity using the schema corresponding to `entityType`.


## Type definitions in this schema

### eventType

- Type of event.
- Type: `string`
- The value is restricted to the following: 
  1. _"entityCreated"_
  2. _"entityUpdated"_
  3. _"entityDeleted"_


### eventFilter

- Type: `object`
- **Properties**
  - **eventType** `required`
    - Event type that is being requested.
    - $ref: [#/definitions/eventType](#eventtype)
  - **entities**
    - Entities for which the events are needed. Example - `table`, `topic`, etc. **When not set, events for all the entities will be provided**.
    - Type: `array`
      - **Items**
      - Type: `string`

_This document was updated on: Monday, November 15, 2021_