# Bot

This schema defines Bot entity. A bot automates tasks, such as adding description, identifying the importance of data. It runs as a special user in the system.

**$id:** [**https://open-metadata.org/schema/entity/bots.json**](https://open-metadata.org/schema/entity/bots.json)

Type: `object`

## Properties

* **id**
  * Unique identifier of a bot instance.
  * $ref: [../type/basic.json\#/definitions/uuid](../types/basic.md#uuid)
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
  * $ref: [../type/basic.json\#/definitions/href](../types/basic.md#href)

_This document was updated on: Thursday, August 26, 2021_

