# Team

This schema defines the Team entity. A Team is a group of zero or more users. Teams can own zero or more data assets.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json)

Type: `object`

## Properties

* **id** `required`
  * $ref: [../../type/basic.json\#/definitions/uuid](team.md#....typebasic.jsondefinitionsuuid)
* **name** `required`
  * $ref: [\#/definitions/teamName](team.md#/definitions/teamName)
* **displayName**
  * Name used for display purposes. Example 'Data Science team'.
  * Type: `string`
* **description**
  * Description of the team.
  * Type: `string`
* **href** `required`
  * Link to the resource corresponding to this entity.
  * $ref: [../../type/basic.json\#/definitions/href](team.md#....typebasic.jsondefinitionshref)
* **profile**
  * Team profile information.
  * $ref: [../../type/profile.json](team.md#....typeprofile.json)
* **deleted**
  * When true the team has been deleted.
  * Type: `boolean`
* **users**
  * Users that are part of the team.
  * $ref: [../../type/entityReference.json\#/definitions/entityReferenceList](team.md#....typeentityreference.jsondefinitionsentityreferencelist)
* **owns**
  * List of entities owned by the team.
  * $ref: [../../type/entityReference.json\#/definitions/entityReferenceList](team.md#....typeentityreference.jsondefinitionsentityreferencelist)

## Types definitions in this schema

**teamName**

* A unique name of the team typically the team ID from an identity provider. Example - group Id from ldap.
* Type: `string`
* Length: between 1 and 64

