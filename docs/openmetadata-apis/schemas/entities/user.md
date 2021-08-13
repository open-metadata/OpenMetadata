# User

This schema defines the User entity. A user can be part of 0 or more teams. A special type of user called Bot is used for automation. A user can be an owner of zero or more data assets. A user can also follow zero or more data assets.

<b id="httpsopen-metadata.orgschemaentityteamsuser.json">&#36;id: https://open-metadata.org/schema/entity/teams/user.json</b>

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - <b id="#https://open-metadata.org/schema/entity/teams/user.json/properties/id">id</b> `required`
	 - Unique identifier that identifies a user entity instance.
	 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)
 - <b id="#https://open-metadata.org/schema/entity/teams/user.json/properties/name">name</b> `required`
	 - &#36;ref: [#/definitions/userName](#/definitions/userName)
 - <b id="#https://open-metadata.org/schema/entity/teams/user.json/properties/displayName">displayName</b>
	 - Name used for display purposes. Example 'FirstName LastName'.
	 - Type: `string`
 - <b id="#https://open-metadata.org/schema/entity/teams/user.json/properties/email">email</b> `required`
	 - Email address of the user.
	 - &#36;ref: [../../type/basic.json#/definitions/email](#....typebasic.jsondefinitionsemail)
 - <b id="#https://open-metadata.org/schema/entity/teams/user.json/properties/href">href</b> `required`
	 - Link to the resource corresponding to this entity.
	 - &#36;ref: [../../type/basic.json#/definitions/href](#....typebasic.jsondefinitionshref)
 - <b id="#https://open-metadata.org/schema/entity/teams/user.json/properties/timezone">timezone</b>
	 - Timezone of the user.
	 - Type: `string`
	 - String format must be a "timezone"
 - <b id="#https://open-metadata.org/schema/entity/teams/user.json/properties/deactivated">deactivated</b>
	 - When true indicates the user has been deactivated. Users are deactivated instead of deleted.
	 - Type: `boolean`
 - <b id="#https://open-metadata.org/schema/entity/teams/user.json/properties/isBot">isBot</b>
	 - When true indicates a special type of user called Bot.
	 - Type: `boolean`
 - <b id="#https://open-metadata.org/schema/entity/teams/user.json/properties/isAdmin">isAdmin</b>
	 - When true indicates user is an administrator for the system with superuser privileges.
	 - Type: `boolean`
 - <b id="#https://open-metadata.org/schema/entity/teams/user.json/properties/profile">profile</b>
	 - Profile of the user.
	 - &#36;ref: [../../type/profile.json](#....typeprofile.json)
 - <b id="#https://open-metadata.org/schema/entity/teams/user.json/properties/teams">teams</b>
	 - Teams that the user belongs to.
	 - &#36;ref: [../../type/entityReference.json#/definitions/entityReferenceList](#....typeentityreference.jsondefinitionsentityreferencelist)
 - <b id="#https://open-metadata.org/schema/entity/teams/user.json/properties/owns">owns</b>
	 - List of entities owned by the user.
	 - &#36;ref: [../../type/entityReference.json#/definitions/entityReferenceList](#....typeentityreference.jsondefinitionsentityreferencelist)
 - <b id="#https://open-metadata.org/schema/entity/teams/user.json/properties/follows">follows</b>
	 - List of entities followed by the user.
	 - &#36;ref: [../../type/entityReference.json#/definitions/entityReferenceList](#....typeentityreference.jsondefinitionsentityreferencelist)


## Types definitions in this schema
**userName**

 - A unique name of the user typically the user ID from an identity provider. Example - uid from ldap.
 - Type: `string`
 - Length: between 1 and 64


