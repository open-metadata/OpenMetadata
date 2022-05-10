# Entity History

This schema defines the type used for capturing version of history of entity.

**$id:**[**https://open-metadata.org/schema/type/entityHistory.json**](https://open-metadata.org/schema/type/entityHistory.json)

Type: `object`

This schema does not accept additional properties.

## Properties

* **entityType** `required`
  * Entity type, such as `database`, `table`, `dashboard`, for which this version history is produced.
  * Type: `string`
* **versions** `required`
  * Type: `array`

## Type definitions in this schema

### entityVersion

* Metadata version of the entity in the form `Major.Minor`. First version always starts from `0.1` when the entity is created. When the backward compatible changes are made to the entity, only the `Minor` version is incremented - example `1.0` is changed to `1.1`. When backward incompatible changes are made the `Major` version is incremented - example `1.1` to `2.0`.
* Type: `number`
* Default: `0.1`
* Range: ≥ 0.1
* The value must be a multiple of `0.1`

### fieldName

* Name of the field of an entity.
* Type: `string`

### fieldChange

* Type: `object`
* This schema does not accept additional properties.
* **Properties**
  * **name**
    * Name of the entity field that changed.
    * $ref: [#/definitions/fieldName](entityhistory.md#fieldname)
  * **oldValue**
    * Previous value of the field. Note that this is a JSON string and use the corresponding field type to deserialize it.
  * **newValue**
    * New value of the field. Note that this is a JSON string and use the corresponding field type to deserialize it.

### changeDescription

* Description of the change.
* Type: `object`
* This schema does not accept additional properties.
* **Properties**
  * **fieldsAdded**
    * Names of fields added during the version changes.
    * Type: `array`
      * **Items**
      * $ref: [#/definitions/fieldChange](entityhistory.md#fieldchange)
  * **fieldsUpdated**
    * Fields modified during the version changes with old and new values.
    * Type: `array`
      * **Items**
      * $ref: [#/definitions/fieldChange](entityhistory.md#fieldchange)
  * **fieldsDeleted**
    * Fields deleted during the version changes with old value before deleted.
    * Type: `array`
      * **Items**
      * $ref: [#/definitions/fieldChange](entityhistory.md#fieldchange)
  * **previousVersion**
    * When a change did not result in change, this could be same as the current version.
    * $ref: [#/definitions/entityVersion](entityhistory.md#entityversion)

_This document was updated on: Wednesday, March 9, 2022_
