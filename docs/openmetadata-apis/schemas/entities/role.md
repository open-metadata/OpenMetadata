# Role

This schema defines the Role entity. A Role has access to zero or more data assets.

**$id:** [**https://open-metadata.org/schema/entity/teams/role.json**](https://open-metadata.org/schema/entity/teams/role.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **id** `required`
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
	 - $ref: [#/definitions/roleName](#rolename)
 - **displayName**
	 - Name used for display purposes. Example 'Data Consumer'.
	 - Type: `string`
 - **description**
	 - Description of the role.
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
 - **href**
	 - Link to the resource corresponding to this entity.
	 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **changeDescription**
	 - Change that lead to this version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
 - **deleted**
	 - When `true` indicates the entity has been soft deleted.
	 - Type: `boolean`
	 - Default: _false_
 - **policy**
	 - Policy that is attached to this role.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **users**
	 - Users that have this role assigned.
	 - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)


## Type definitions in this schema
### roleName

 - A unique name of the role.
 - Type: `string`
 - Length: between 1 and 128




_This document was updated on: Tuesday, January 25, 2022_