# Entity Reference

This schema defines the EntityReference type used for referencing an entity. EntityReference is used for capturing relationships from one entity to another. For example, a table has an attribute called database of type EntityReference that captures the relationship of a table `belongs to a` database.

**$id: [https://open-metadata.org/schema/type/entityReference.json](https://open-metadata.org/schema/type/entityReference.json)**

Type: `object`

## Properties


## Type definitions in this schema

### entityReferenceList

* Type: `array`
  * **Items**
  * $ref: [entityReference.json](entityreference.md)

_This document was updated on: Monday, October 18, 2021_