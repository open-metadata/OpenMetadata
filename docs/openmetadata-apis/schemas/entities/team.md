# Team

This schema defines the Team entity. A Team is a group of zero or more users. Teams can own zero or more data assets.

**$id:**[**https://open-metadata.org/schema/entity/teams/team.json**](https://open-metadata.org/schema/entity/teams/team.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **id** `required`
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
	 - $ref: [#/definitions/teamName](#teamname)
 - **displayName**
	 - Name used for display purposes. Example 'Data Science team'.
	 - Type: `string`
 - **description**
	 - Description of the team.
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
	 - Link to the resource corresponding to this entity.
	 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **profile**
	 - Team profile information.
	 - $ref: [../../type/profile.json](../types/profile.md)
 - **users**
	 - Users that are part of the team.
	 - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **owns**
	 - List of entities owned by the team.
	 - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **changeDescription**
	 - Change that lead to this version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
 - **deleted**
	 - When `true` indicates the entity has been soft deleted.
	 - Type: `boolean`
	 - Default: _false_
 - **defaultRoles**
	 - Roles to be assigned to all users that are part of this team.
	 - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)


## Type definitions in this schema
### teamName

 - A unique name of the team typically the team ID from an identity provider. Example - group Id from LDAP.
 - Type: `string`
 - Length: between 1 and 128




_This document was updated on: Wednesday, March 9, 2022_