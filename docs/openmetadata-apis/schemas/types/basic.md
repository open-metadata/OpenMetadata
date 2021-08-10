# Basic

This schema defines basic common types that are used by other schemas.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschematypebasic.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/basic.json</b>



## Definitions
**_uuid_**

 - Unique id used to identify an entity.
 - Type: `string`
 - String format must be a "uuid"


**_email_**

 - Email address of a user or other entities.
 - Type: `string`
 - String format must be a "email"
 - The value must match this pattern: `^\S+@\S+\.\S+$`
 - Length: between 6 and 127


**_entityLink_**

 - Link to an entity or field of an entity of format `<#E/{enties}/{entityName}/{field}/{fieldValue}`.
 - Type: `string`
 - The value must match this pattern: `^<#E/\S+/\S+>$`


**_timestamp_**

 - Time stamp in unixTimeMillis
 - Type: `string`
 - String format must be a "utc-millisec"


**_href_**

 - href that points to a resource.
 - Type: `string`
 - String format must be a "uri"


**_timeInterval_**

 - Type: `object`
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/basic.json/definitions/timeInterval/properties/start">start</b>
		 - Start time in unixTimeMillis.
		 - Type: `integer`
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/basic.json/definitions/timeInterval/properties/end">end</b>
		 - End time in unixTimeMillis.
		 - Type: `integer`


**_duration_**

 - Duration in ISO 8601 format in UTC time. Example - 'P23DT23H'.
 - Type: `string`


**_date_**

 - Date in ISO 8601 format in UTC time. Example - '2018-11-13'.
 - Type: `string`
 - String format must be a "date"


**_dateTime_**

 - Date and time in ISO 8601 format. Example - '2018-11-13T20:20:39+00:00'.
 - Type: `string`
 - String format must be a "date-Time"



_Generated with [json-schema-md-doc](https://brianwendt.github.io/json-schema-md-doc/)_ _Mon Aug 09 2021 19:12:30 GMT-0700 (Pacific Daylight Time)_