# Bot

This schema defines Bot entity. A bot automates tasks, such as adding description, identifying the importance of data. It runs as a special user in the system.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschemaentitybots.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json/properties/id">id</b>
	 - Unique identifier of a bot instance.
	 - &#36;ref: [../type/basic.json#/definitions/uuid](#..typebasic.jsondefinitionsuuid)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json/properties/name">name</b>
	 - Name of the bot.
	 - Type: `string`
	 - Length: between 1 and 64
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json/properties/displayName">displayName</b>
	 - Name used for display purposes. Example 'FirstName LastName'.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json/properties/description">description</b>
	 - Description of the bot.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json/properties/href">href</b>
	 - Link to the resource corresponding to this bot.
	 - &#36;ref: [../type/basic.json#/definitions/href](#..typebasic.jsondefinitionshref)
