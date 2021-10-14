# Entity Reference

This schema defines the EntityReference type used for referencing an entity. EntityReference is used for capturing relationships from one entity to another. For example, a table has an attribute called database of type EntityReference that captures the relationship of a table `belongs to a` database.

**$id: **[https://open-metadata.org/schema/type/entityReference.json](https://open-metadata.org/schema/type/entityReference.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **id** `required`
   - Unique identifier that identifies an entity instance.
   - $ref: [basic.json#/definitions/uuid](basic.md#uuid)
 - **type** `required`
   - Entity type/class name - Examples: `database`, `table`, `metrics`, `redshift`, `mysql`, `bigquery`, `snowflake`...
   - Type: `string`
 - **name**
   - Name of the entity instance. For entities such as tables, databases where the name is not unique, fullyQualifiedName is returned in this field.
   - Type: `string`
 - **description**
   - Optional description of entity.
   - Type: `string`
 - **displayName**
   - Display Name that identifies this entity.
   - Type: `string`
 - **href**
   - Link to the entity resource.
   - $ref: [basic.json#/definitions/href](basic.md#href)

* **id** `required`
  * Unique identifier that identifies an entity instance.
  * $ref: [basic.json#/definitions/uuid](basic.md#uuid)
* **type** `required`
  * Entity type/class name - Examples: `database`, `table`, `metrics`, `redshift`, `mysql`, `bigquery`, `snowflake`...
  * Type: `string`
* **name**
  * Name of the entity instance. For entities such as tables, databases where the name is not unique, fullyQualifiedName is returned in this field.
  * Type: `string`
* **description**
  * Optional description of the entity.
  * Type: `string`
* **href**
  * Link to the entity resource.
  * $ref: [basic.json#/definitions/href](basic.md#href)

## Type definitions in this schema
### entityReferenceList

 - Type: `array`
   - **Items**
   - $ref: [entityReference.json](entityreference.md)


_This document was updated on: Thursday, September 16, 2021_
