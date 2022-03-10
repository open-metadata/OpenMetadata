# Thread

This schema defines the Thread entity. A Thread is a collection of posts made by the users. The first post that starts a thread is **about** a data asset **from** a user. Other users can respond to this post by creating new posts in the thread. Note that bot users can also interact with a thread. A post can contains links that mention Users or other Data Assets.

**$id:**[**https://open-metadata.org/schema/entity/feed/thread.json**](https://open-metadata.org/schema/entity/feed/thread.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **id** `required`
	 - Unique identifier that identifies an entity instance.
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **href**
	 - Link to the resource corresponding to this entity.
	 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **threadTs**
	 - Timestamp of the when the first post created the thread in Unix epoch time milliseconds.
	 - $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
 - **about** `required`
	 - Data asset about which this thread is created for with format <#E/{entities}/{entityName}/{field}/{fieldValue}.
	 - $ref: [../../type/basic.json#/definitions/entityLink](../types/basic.md#entitylink)
 - **entityId**
	 - Entity Id of the entity that the thread belongs to.
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **addressedTo**
	 - User or team this thread is addressed to in format <#E/{entities}/{entityName}/{field}/{fieldValue}.
	 - $ref: [../../type/basic.json#/definitions/entityLink](../types/basic.md#entitylink)
 - **createdBy**
	 - User who created the thread.
	 - Type: `string`
 - **updatedAt**
	 - Last update time corresponding to the new version of the entity in Unix epoch time milliseconds.
	 - $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
 - **updatedBy**
	 - User who made the update.
	 - Type: `string`
 - **resolved**
	 - When `true` indicates the thread has been resolved.
	 - Type: `boolean`
	 - Default: _false_
 - **message** `required`
	 - The main message of the thread in markdown format.
	 - Type: `string`
 - **postsCount**
	 - The total count of posts in the thread.
	 - Type: `integer`
	 - Default: `0`
 - **posts**
	 - Type: `array`
		 - **Items**
		 - $ref: [#/definitions/post](#post)


## Type definitions in this schema
### post

 - Post within a feed.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **id** `required`
		 - Unique identifier that identifies the post.
		 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
	 - **message** `required`
		 - Message in markdown format. See markdown support for more details.
		 - Type: `string`
	 - **postTs**
		 - Timestamp of the post in Unix epoch time milliseconds.
		 - $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
	 - **from** `required`
		 - Name of the User posting the message.
		 - Type: `string`




_This document was updated on: Wednesday, March 9, 2022_