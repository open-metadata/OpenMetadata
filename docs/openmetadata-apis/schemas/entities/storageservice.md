# Storage Service

This schema defines the Storage Service entity, such as S3, GCS, HDFS.

**$id:**[**https://open-metadata.org/schema/entity/services/storageService.json**](https://open-metadata.org/schema/entity/services/storageService.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **id** `required`
	 - Unique identifier of this storage service instance.
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
	 - Name that identifies this storage service.
	 - Type: `string`
	 - The value must match this pattern: `^[^.]*$`
	 - Length: between 1 and 128
 - **displayName**
	 - Display Name that identifies this storage service.
	 - Type: `string`
 - **serviceType** `required`
	 - Type of storage service such as S3, GCS, HDFS...
	 - $ref: [../../type/storage.json#/definitions/storageServiceType](../types/storage.md#storageservicetype)
 - **description**
	 - Description of a storage service instance.
	 - Type: `string`
 - **version**
	 - Metadata version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
 - **updatedAt**
	 - Last update time corresponding to the new version of the entity in Unix epoch time milliseconds.
	 - $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
 - **updatedBy**
	 - User who made the update.
	 - Type: `string`
 - **href** `required`
	 - Link to the resource corresponding to this storage service.
	 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **owner**
	 - Owner of this storage service.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **changeDescription**
	 - Change that lead to this version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
 - **deleted**
	 - When `true` indicates the entity has been soft deleted.
	 - Type: `boolean`
	 - Default: _false_


_This document was updated on: Monday, March 7, 2022_