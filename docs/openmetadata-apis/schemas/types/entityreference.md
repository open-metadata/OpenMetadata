# Entity Reference

This schema defines the EntityReference type used for referencing an entity. EntityReference is used for capturing relationships from one entity to another. For example, a table has an attribute called database of type EntityReference that captures the relationship of a table `belongs to a` database.

<b id="https/open-metadata.org/schema/type/entityreference.json">&#36;id: https://open-metadata.org/schema/type/entityReference.json</b>

Type: `object`

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
 - **href**
	 - Link to the entity resource.
	 - $ref: [basic.json#/definitions/href](basic.md#href)


## Type definitions in this schema
### entityReferenceList

 - Type: `array`
	 - **Items**
	 - $ref: [entityReference.json](entityreference.md)




_This document was updated on: Thursday, August 26, 2021_