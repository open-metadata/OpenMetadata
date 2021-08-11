# Entity Reference

This schema defines the type EntityReference used for referencing an entity. EntityReference is used for capturing relationship from one entity to another. For example, table has an attribute called database of type EntityReference that captures the relationship of a table `belongs to a` database.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json)

Type: `object`

## Properties

* **id** `required`
  * Unique identifier that identifies an entity instance.
  * $ref: [basic.json\#/definitions/uuid](entity-reference.md#basic.jsondefinitionsuuid)
* **type** `required`
  * Entity type/class name - Examples: `database`, `table`, `metrics`, `redshift`, `mysql`, `bigquery`, `snowflake`...
  * Type: `string`
* **name**
  * Name of the entity instance.
  * Type: `string`
* **description**
  * Optional description of entity.
  * Type: `string`
* **href**
  * Link to the entity resource.
  * $ref: [basic.json\#/definitions/href](entity-reference.md#basic.jsondefinitionshref)

## Types defined in this schema

**entityReferenceList**

* Type: `array`
  * **Items**
  * $ref: [entityReference.json](entity-reference.md#entityreference.json)

