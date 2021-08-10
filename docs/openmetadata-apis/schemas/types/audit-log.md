# Audit Log

This schema defines type for Audit Log. Audit Log is used to capture audit trail of POST, PUT, and PATCH API operations.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschematypeauditlog.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/auditLog.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/auditLog.json/properties/method">method</b> `required`
	 - HTTP Method used in a call.
	 - Type: `string`
	 - The value is restricted to the following: 
		 1. _"POST"_
		 2. _"PUT"_
		 3. _"PATCH"_
		 4. _"DELETE"_
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/auditLog.json/properties/responseCode">responseCode</b> `required`
	 - HTTP response code for the api requested.
	 - Type: `integer`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/auditLog.json/properties/path">path</b> `required`
	 - Requested API Path.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/auditLog.json/properties/userName">userName</b> `required`
	 - Name of the user who requested for the API.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/auditLog.json/properties/dateTime">dateTime</b>
	 - Date which the api call is made.
	 - &#36;ref: [basic.json#/definitions/dateTime](#basic.jsondefinitionsdatetime)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/auditLog.json/properties/entityId">entityId</b> `required`
	 - Entity Id that was modified by the operation.
	 - &#36;ref: [basic.json#/definitions/uuid](#basic.jsondefinitionsuuid)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/auditLog.json/properties/entityType">entityType</b> `required`
	 - Entity Type that modified by the operation.
	 - Type: `string`

_Generated with [json-schema-md-doc](https://brianwendt.github.io/json-schema-md-doc/)_ _Mon Aug 09 2021 19:12:30 GMT-0700 (Pacific Daylight Time)_