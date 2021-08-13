# Thread

This schema defines the Thread entity. A Thread is a collection of posts made by the users. The first post that starts a thread is **about** a data asset **from** a user. Other users can respond to this post by creating new posts in the thread. Note that bot users can also interact with a thread. A post can contains links that mention Users or other Data Assets.

<b id="httpsopen-metadata.orgschemaentityfeedthread.json">&#36;id: https://open-metadata.org/schema/entity/feed/thread.json</b>

Type: `object`

## Properties
 - <b id="#https://open-metadata.org/schema/entity/feed/thread.json/properties/id">id</b> `required`
	 - Unique identifier that identifies an entity instance.
	 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)
 - <b id="#https://open-metadata.org/schema/entity/feed/thread.json/properties/href">href</b>
	 - Link to the resource corresponding to this entity.
	 - &#36;ref: [../../type/basic.json#/definitions/href](#....typebasic.jsondefinitionshref)
 - <b id="#https://open-metadata.org/schema/entity/feed/thread.json/properties/threadTs">threadTs</b>
	 - Timestamp of the when the first post created the thread.
 - <b id="#https://open-metadata.org/schema/entity/feed/thread.json/properties/about">about</b> `required`
	 - Data asset about which this thread is created for with format <#E/{enties}/{entityName}/{field}/{fieldValue}.
	 - &#36;ref: [../../type/basic.json#/definitions/entityLink](#....typebasic.jsondefinitionsentitylink)
 - <b id="#https://open-metadata.org/schema/entity/feed/thread.json/properties/addressedTo">addressedTo</b>
	 - User or team this thread is addressed to in format <#E/{enties}/{entityName}/{field}/{fieldValue}.
	 - &#36;ref: [../../type/basic.json#/definitions/entityLink](#....typebasic.jsondefinitionsentitylink)
 - <b id="#https://open-metadata.org/schema/entity/feed/thread.json/properties/posts">posts</b> `required`
	 - Type: `array`
		 - **Items**
		 - &#36;ref: [#/definitions/post](#/definitions/post)


## Types definitions in this schema
**post**

 - Post within a feed.
 - Type: `object`
 - **Properties**
	 - <b id="#https://open-metadata.org/schema/entity/feed/thread.json/definitions/post/properties/message">message</b> `required`
		 - Message in markdown format. See markdown support for more details.
		 - Type: `string`
	 - <b id="#https://open-metadata.org/schema/entity/feed/thread.json/definitions/post/properties/postTs">postTs</b>
		 - Timestamp of the post.
		 - Type: `string`
		 - String format must be a "date-time"
	 - <b id="#https://open-metadata.org/schema/entity/feed/thread.json/definitions/post/properties/from">from</b> `required`
		 - ID of User (regular user or a bot) posting the message.
		 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)


