# Bot

This schema defines Bot entity. A bot automates tasks, such as adding description, identifying the importance of data. It runs as a special user in the system.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/bots.json)

Type: `object`

## Properties

* **id**
  * Unique identifier of a bot instance.
  * $ref: [../type/basic.json\#/definitions/uuid](bots.md#..typebasic.jsondefinitionsuuid)
* **name**
  * Name of the bot.
  * Type: `string`
  * Length: between 1 and 64
* **displayName**
  * Name used for display purposes. Example 'FirstName LastName'.
  * Type: `string`
* **description**
  * Description of the bot.
  * Type: `string`
* **href**
  * Link to the resource corresponding to this bot.
  * $ref: [../type/basic.json\#/definitions/href](bots.md#..typebasic.jsondefinitionshref)

