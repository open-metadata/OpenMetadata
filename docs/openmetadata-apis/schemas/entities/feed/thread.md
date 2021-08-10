# Thread

This schema defines Thread entity. A Thread is a collection of posts made the users. First post that starts a thread is about a data asset created by a user. Other users can respond to this post by creating new posts in the thread. Note that bot users can also interact with a thread. A post can contains links that mentions Users or other Data Assets.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschemaentityfeedthread.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json/properties/id">id</b> `required`
	 - Unique identifier that identifies an entity instance.
	 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json/properties/href">href</b>
	 - Link to the resource corresponding to this entity.
	 - &#36;ref: [../../type/basic.json#/definitions/href](#....typebasic.jsondefinitionshref)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json/properties/threadTs">threadTs</b>
	 - Timestamp of the when the first post created the thread.
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json/properties/about">about</b> `required`
	 - Data asset about which this thread is created for with format <#E/{enties}/{entityName}/{field}/{fieldValue}.
	 - &#36;ref: [../../type/basic.json#/definitions/entityLink](#....typebasic.jsondefinitionsentitylink)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json/properties/addressedTo">addressedTo</b>
	 - User or team this thread is addressed to in format <#E/{enties}/{entityName}/{field}/{fieldValue}.
	 - &#36;ref: [../../type/basic.json#/definitions/entityLink](#....typebasic.jsondefinitionsentitylink)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json/properties/posts">posts</b> `required`
	 - Type: `array`
		 - **_Items_**
		 - &#36;ref: [#/definitions/post](#/definitions/post)


## Definitions
**_post_**

 - Post within a feed.
 - Type: `object`
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json/definitions/post/properties/message">message</b> `required`
		 - Message in markdown format. See markdown support for more details.
		 - Type: `string`
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json/definitions/post/properties/postTs">postTs</b>
		 - Timestamp of the post.
		 - Type: `string`
		 - String format must be a "date-time"
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json/definitions/post/properties/from">from</b> `required`
		 - ID of User (regular user or a bot) posting the message.
		 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)



_Generated with [json-schema-md-doc](https://brianwendt.github.io/json-schema-md-doc/)_ _Mon Aug 09 2021 18:41:36 GMT-0700 (Pacific Daylight Time)_