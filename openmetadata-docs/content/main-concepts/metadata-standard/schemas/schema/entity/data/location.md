---
title: location
slug: /main-concepts/metadata-standard/schemas/schema/entity/data
---

# Location

*This schema defines the Location entity. A Location can contain the data of a table or group other subLocation together.*

## Properties

- **`id`**: Unique identifier of this location instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of a location. Refer to *../../type/basic.json#/definitions/entityName*.
- **`path`** *(string)*: Location full path.
- **`displayName`** *(string)*: Display Name that identifies this table. It could be title or label from the source services.
- **`fullyQualifiedName`** *(string)*: Fully qualified name of a location in the form `serviceName.locationName`.
- **`description`**: Description of a location. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to this location resource. Refer to *../../type/basic.json#/definitions/href*.
- **`locationType`**: Refer to *#/definitions/locationType*.
- **`owner`**: Owner of this location. Refer to *../../type/entityReference.json*. Default: `None`.
- **`followers`**: Followers of this location. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`tags`** *(array)*: Tags for this location. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`service`**: Link to the database cluster/service where this database is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this storage location is hosted in. Refer to *../../type/storage.json#/definitions/storageServiceType*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
## Definitions

- **`locationType`** *(string)*: This schema defines the type used for describing different types of Location. Must be one of: `['Bucket', 'Prefix', 'Database', 'Table', 'Iceberg']`.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
