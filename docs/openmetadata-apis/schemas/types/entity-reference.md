# Entity Reference

This schema defines EntityReference type used for referencing an entity. EntityReference is used for capturing relationship from one entity to another. For example, table has an attribute called database of type EntityReference that captures the relationship of a table `belongs to a` database.

<b id="httpsopen-metadata.orgschematypeentityreference.json">&#36;id: https://open-metadata.org/schema/type/entityReference.json</b>

Type: `object`

## Properties
 - <b id="#https://open-metadata.org/schema/type/entityReference.json/properties/id">id</b> `required`
	 - Unique identifier that identifies an entity instance.
	 - &#36;ref: [basic.json#/definitions/uuid](#basic.jsondefinitionsuuid)
 - <b id="#https://open-metadata.org/schema/type/entityReference.json/properties/type">type</b> `required`
	 - Entity type/class name - Examples: `database`, `table`, `metrics`, `redshift`, `mysql`, `bigquery`, `snowflake`...
	 - Type: `string`
 - <b id="#https://open-metadata.org/schema/type/entityReference.json/properties/name">name</b>
	 - Name of the entity instance. For entities such as tables, database where name is not unique, fullyQualifiedName is returned in this field.
	 - Type: `string`
 - <b id="#https://open-metadata.org/schema/type/entityReference.json/properties/description">description</b>
	 - Optional description of entity.
	 - Type: `string`
 - <b id="#https://open-metadata.org/schema/type/entityReference.json/properties/href">href</b>
	 - Link to the entity resource.
	 - &#36;ref: [basic.json#/definitions/href](#basic.jsondefinitionshref)


## Types definitions in this schema
**entityReferenceList**

 - Type: `array`
	 - **Items**
	 - &#36;ref: [entityReference.json](#entityreference.json)


