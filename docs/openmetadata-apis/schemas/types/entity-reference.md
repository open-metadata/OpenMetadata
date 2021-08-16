# Entity Reference

This schema defines EntityReference type used for referencing an entity. EntityReference is used for capturing relationship from one entity to another. For example, table has an attribute called database of type EntityReference that captures the relationship of a table `belongs to a` database.

**$id:** [**https://open-metadata.org/schema/type/entityReference.json**](https://open-metadata.org/schema/type/entityReference.json)

Type: `object`

## Properties

* **id** `required`
  * Unique identifier that identifies an entity instance.
  * $ref: [basic.json\#/definitions/uuid](basic.md#types-definitions-in-this-schema)
* **type** `required`
  * Entity type/class name - Examples: `database`, `table`, `metrics`, `redshift`, `mysql`, `bigquery`, `snowflake`...
  * Type: `string`
* **name**
  * Name of the entity instance. For entities such as tables, database where name is not unique, fullyQualifiedName is returned in this field.
  * Type: `string`
* **description**
  * Optional description of entity.
  * Type: `string`
* **href**
  * Link to the entity resource.
  * $ref: [basic.json\#/definitions/href](basic.md#types-definitions-in-this-schema)

## Types definitions in this schema

**entityReferenceList**

* Type: `array`
  * **Items**
  * $ref: [entityReference.json](entity-reference.md)

