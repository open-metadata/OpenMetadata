# Bot

This schema defines Bot entity. A bot automates tasks, such as adding description, identifying the importance of data. It runs as a special user in the system.

<b id="httpsopen-metadata.orgschemaentitybots.json">&#36;id: https://open-metadata.org/schema/entity/bots.json</b>

Type: `object`

## Properties
 - <b id="#https://open-metadata.org/schema/entity/bots.json/properties/id">id</b>
	 - Unique identifier of a bot instance.
	 - &#36;ref: [../type/basic.json#/definitions/uuid](#..typebasic.jsondefinitionsuuid)
 - <b id="#https://open-metadata.org/schema/entity/bots.json/properties/name">name</b>
	 - Name of the bot.
	 - Type: `string`
	 - Length: between 1 and 64
 - <b id="#https://open-metadata.org/schema/entity/bots.json/properties/displayName">displayName</b>
	 - Name used for display purposes. Example 'FirstName LastName'.
	 - Type: `string`
 - <b id="#https://open-metadata.org/schema/entity/bots.json/properties/description">description</b>
	 - Description of the bot.
	 - Type: `string`
 - <b id="#https://open-metadata.org/schema/entity/bots.json/properties/href">href</b>
	 - Link to the resource corresponding to this bot.
	 - &#36;ref: [../type/basic.json#/definitions/href](#..typebasic.jsondefinitionshref)
