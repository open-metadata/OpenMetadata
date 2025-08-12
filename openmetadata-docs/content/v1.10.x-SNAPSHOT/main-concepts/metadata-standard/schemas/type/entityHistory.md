---
title: entityHistory
slug: /main-concepts/metadata-standard/schemas/type/entityhistory
---

# Entity Version History

*This schema defines the type used for capturing version of history of entity.*

## Properties

- **`entityType`** *(string)*: Entity type, such as `database`, `table`, `dashboard`, for which this version history is produced.
- **`versions`** *(array)*
## Definitions

- **`entityVersion`** *(number)*: Metadata version of the entity in the form `Major.Minor`. First version always starts from `0.1` when the entity is created. When the backward compatible changes are made to the entity, only the `Minor` version is incremented - example `1.0` is changed to `1.1`. When backward incompatible changes are made the `Major` version is incremented - example `1.1` to `2.0`. Minimum: `0.1`. Default: `0.1`.
- **`fieldName`** *(string)*: Name of the field of an entity.
- **`fieldChange`** *(object)*: Cannot contain additional properties.
  - **`name`**: Name of the entity field that changed. Refer to *#/definitions/fieldName*.
  - **`oldValue`**: Previous value of the field. Note that this is a JSON string and use the corresponding field type to deserialize it.
  - **`newValue`**: New value of the field. Note that this is a JSON string and use the corresponding field type to deserialize it.
- **`changeDescription`** *(object)*: Description of the change. Cannot contain additional properties.
  - **`fieldsAdded`** *(array)*: Names of fields added during the version changes.
    - **Items**: Refer to *#/definitions/fieldChange*.
  - **`fieldsUpdated`** *(array)*: Fields modified during the version changes with old and new values.
    - **Items**: Refer to *#/definitions/fieldChange*.
  - **`fieldsDeleted`** *(array)*: Fields deleted during the version changes with old value before deleted.
    - **Items**: Refer to *#/definitions/fieldChange*.
  - **`previousVersion`**: When a change did not result in change, this could be same as the current version. Refer to *#/definitions/entityVersion*.
  - **`changeSummary`**: Refer to *./changeSummaryMap.json*.
- **`incrementalChangeDescription`** *(object)*: Description of the change. Cannot contain additional properties.
  - **`fieldsAdded`** *(array)*: Names of fields added during the version changes.
    - **Items**: Refer to *#/definitions/fieldChange*.
  - **`fieldsUpdated`** *(array)*: Fields modified during the version changes with old and new values.
    - **Items**: Refer to *#/definitions/fieldChange*.
  - **`fieldsDeleted`** *(array)*: Fields deleted during the version changes with old value before deleted.
    - **Items**: Refer to *#/definitions/fieldChange*.
  - **`previousVersion`**: When a change did not result in change, this could be same as the current version. Refer to *#/definitions/entityVersion*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
