# Team

This schema defines Team entity. A Team is a group of zero or more users. Team can have ownership of data assets.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschemaentityteamsteam.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json/properties/id">id</b> `required`
	 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json/properties/name">name</b> `required`
	 - &#36;ref: [#/definitions/teamName](#/definitions/teamName)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json/properties/displayName">displayName</b>
	 - Name used for display purposes. Example 'Data Science team'.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json/properties/description">description</b>
	 - Description of the team.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json/properties/href">href</b> `required`
	 - Link to the resource corresponding to this entity.
	 - &#36;ref: [../../type/basic.json#/definitions/href](#....typebasic.jsondefinitionshref)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json/properties/profile">profile</b>
	 - Team profile information.
	 - &#36;ref: [../../type/profile.json](#....typeprofile.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json/properties/deleted">deleted</b>
	 - When true the team has been deleted.
	 - Type: `boolean`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json/properties/users">users</b>
	 - Users that are part of the team.
	 - &#36;ref: [../../type/entityReference.json#/definitions/entityReferenceList](#....typeentityreference.jsondefinitionsentityreferencelist)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json/properties/owns">owns</b>
	 - List of entities owned by the team.
	 - &#36;ref: [../../type/entityReference.json#/definitions/entityReferenceList](#....typeentityreference.jsondefinitionsentityreferencelist)


## Definitions
**_teamName_**

 - Unique name of the team typically the team ID from the identify provider. Example - group Id from ldap.
 - Type: `string`
 - Length: between 1 and 64


