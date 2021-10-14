# Team

This schema defines the Team entity. A Team is a group of zero or more users. Teams can own zero or more data assets.

**$id: **[https://open-metadata.org/schema/entity/teams/team.json](https://open-metadata.org/schema/entity/teams/team.json)

Type: `object`

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
 - **href** `required`
   - Link to the resource corresponding to this entity.
   - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **profile**
   - Team profile information.
   - $ref: [../../type/profile.json](../types/profile.md)
 - **deleted**
   - When true the team has been deleted.
   - Type: `boolean`
 - **users**
   - Users that are part of the team.
   - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **owns**
   - List of entities owned by the team.
   - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)

* **id** `required`
  * $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
* **name** `required`
  * $ref: [#/definitions/teamName](team.md#teamname)
* **displayName**
  * Name used for display purposes. Example 'Data Science team'.
  * Type: `string`
* **description**
  * Description of the team.
  * Type: `string`
* **href** `required`
  * Link to the resource corresponding to this entity.
  * $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
* **profile**
  * Team profile information.
  * $ref: [../../type/profile.json](../types/profile.md)
* **deleted**
  * When true the team has been deleted.
  * Type: `boolean`
* **users**
  * Users that are part of the team.
  * $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
* **owns**
  * List of entities owned by the team.
  * $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)

## Type definitions in this schema
### teamName

 - A unique name of the team typically the team ID from an identity provider. Example - group Id from LDAP.
 - Type: `string`
 - Length: between 1 and 64


_This document was updated on: Thursday, September 16, 2021_
