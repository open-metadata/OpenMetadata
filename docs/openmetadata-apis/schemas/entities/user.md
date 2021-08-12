# User

This schema defines the User entity. A user can be part of 0 or more teams. A special type of user called Bot is used for automation. A user can be an owner of zero or more data assets. A user can also follow zero or more data assets.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json)

Type: `object`

This schema does not accept additional properties.

## Properties

* **id** `required`
  * Unique identifier that identifies a user entity instance.
  * $ref: [../../type/basic.json\#/definitions/uuid](user.md#....typebasic.jsondefinitionsuuid)
* **name** `required`
  * $ref: [\#/definitions/userName](user.md#/definitions/userName)
* **displayName**
  * Name used for display purposes. Example 'FirstName LastName'.
  * Type: `string`
* **email** `required`
  * Email address of the user.
  * $ref: [../../type/basic.json\#/definitions/email](user.md#....typebasic.jsondefinitionsemail)
* **href** `required`
  * Link to the resource corresponding to this entity.
  * $ref: [../../type/basic.json\#/definitions/href](user.md#....typebasic.jsondefinitionshref)
* **timezone**
  * Timezone of the user.
  * Type: `string`
  * String format must be a "timezone"
* **deactivated**
  * When true indicates the user has been deactivated. Users are deactivated instead of deleted.
  * Type: `boolean`
* **isBot**
  * When true indicates a special type of user called Bot.
  * Type: `boolean`
* **isAdmin**
  * When true indicates user is an administrator for the system with superuser privileges.
  * Type: `boolean`
* **profile**
  * Profile of the user.
  * $ref: [../../type/profile.json](user.md#....typeprofile.json)
* **teams**
  * Teams that the user belongs to.
  * $ref: [../../type/entityReference.json\#/definitions/entityReferenceList](user.md#....typeentityreference.jsondefinitionsentityreferencelist)
* **owns**
  * List of entities owned by the user.
  * $ref: [../../type/entityReference.json\#/definitions/entityReferenceList](user.md#....typeentityreference.jsondefinitionsentityreferencelist)
* **follows**
  * List of entities followed by the user.
  * $ref: [../../type/entityReference.json\#/definitions/entityReferenceList](user.md#....typeentityreference.jsondefinitionsentityreferencelist)

## Types definitions in this schema

**userName**

* A unique name of the user typically the user ID from an identity provider. Example - uid from ldap.
* Type: `string`
* Length: between 1 and 64

