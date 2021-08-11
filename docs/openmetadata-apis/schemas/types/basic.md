# Basic

This schema defines basic common types that are used by other schemas.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschematypebasic.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/basic.json</b>



## Types definitions in this schema
**uuid**

 - Unique id used to identify an entity.
 - Type: `string`
 - String format must be a "uuid"


**email**

 - Email address of a user or other entities.
 - Type: `string`
 - String format must be a "email"
 - The value must match this pattern: `^\S+@\S+\.\S+$`
 - Length: between 6 and 127


**entityLink**

 - Link to an entity or field of an entity of format `<#E/{enties}/{entityName}/{field}/{fieldValue}`.
 - Type: `string`
 - The value must match this pattern: `^<#E/\S+/\S+>$`


**timestamp**

 - Timestamp in unixTimeMillis
 - Type: `string`
 - String format must be a "utc-millisec"


**href**

 - href that points to a resource.
 - Type: `string`
 - String format must be a "uri"


**timeInterval**

 - Type: `object`
 - **Properties**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/basic.json/definitions/timeInterval/properties/start">start</b>
		 - Start time in unixTimeMillis.
		 - Type: `integer`
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/basic.json/definitions/timeInterval/properties/end">end</b>
		 - End time in unixTimeMillis.
		 - Type: `integer`


**duration**

 - Duration in ISO 8601 format in UTC. Example - 'P23DT23H'.
 - Type: `string`


**date**

 - Date in ISO 8601 format in UTC. Example - '2018-11-13'.
 - Type: `string`
 - String format must be a "date"


**dateTime**

 - Date and time in ISO 8601 format. Example - '2018-11-13T20:20:39+00:00'.
 - Type: `string`
 - String format must be a "date-Time"


