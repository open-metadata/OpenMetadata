# Entity Reference

This schema defines the type Entity Reference used for referencing an entity.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschematypeentityreference.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json/properties/id">id</b> `required`
	 - Unique identifier that identifies an entity instance.
	 - &#36;ref: [basic.json#/definitions/uuid](#basic.jsondefinitionsuuid)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json/properties/type">type</b> `required`
	 - Entity type/class name - Examples: `database`, `table`, `metrics`, `redshift`, `mysql`, `bigquery`, `snowflake`...
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json/properties/name">name</b>
	 - Name of the entity instance.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json/properties/description">description</b>
	 - Optional description of entity.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json/properties/href">href</b>
	 - Link to the entity resource.
	 - &#36;ref: [basic.json#/definitions/href](#basic.jsondefinitionshref)


## Definitions
**_entityReferenceList_**

 - Type: `array`
	 - **_Items_**
	 - &#36;ref: [entityReference.json](#entityreference.json)


