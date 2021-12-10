# Bot

This schema defines Bot entity. A bot automates tasks, such as adding description, identifying the importance of data. It runs as a special user in the system.

**$id:**[**https://open-metadata.org/schema/entity/bots.json**](https://open-metadata.org/schema/entity/bots.json)

Type: `object`

## Properties
- **id**
  - Unique identifier of a bot instance.
  - $ref: [../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
- **name**
  - Name of the bot.
  - Type: `string`
  - Length: between 1 and 128
- **displayName**
  - Name used for display purposes. Example 'FirstName LastName'.
  - Type: `string`
- **description**
  - Description of the bot.
  - Type: `string`
- **version**
  - Metadata version of the entity.
  - $ref: [../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
- **updatedAt**
  - Last update time corresponding to the new version of the entity.
  - $ref: [../type/basic.json#/definitions/dateTime](../types/basic.md#datetime)
- **updatedBy**
  - User who made the update.
  - Type: `string`
- **href**
  - Link to the resource corresponding to this bot.
  - $ref: [../type/basic.json#/definitions/href](../types/basic.md#href)
- **changeDescription**
  - Change that lead to this version of the entity.
  - $ref: [../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)

_This document was updated on: Thursday, December 9, 2021_