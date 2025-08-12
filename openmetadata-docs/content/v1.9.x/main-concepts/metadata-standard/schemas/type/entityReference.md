---
title: entityReference | OpenMetadata Entity Reference
description: EntityReference schema allows linking to metadata objects using ID, type, and qualified name.
slug: /main-concepts/metadata-standard/schemas/type/entityreference
---

# Entity Reference

*This schema defines the EntityReference type used for referencing an entity. EntityReference is used for capturing relationships from one entity to another. For example, a table has an attribute called database of type EntityReference that captures the relationship of a table `belongs to a` database.*

## Properties

- **`id`**: Unique identifier that identifies an entity instance. Refer to *[basic.json#/definitions/uuid](#sic.json#/definitions/uuid)*.
- **`type`** *(string)*: Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`, `dashboardService`...
- **`name`** *(string)*: Name of the entity instance.
- **`fullyQualifiedName`** *(string)*: Fully qualified name of the entity instance. For entities such as tables, databases fullyQualifiedName is returned in this field. For entities that don't have name hierarchy such as `user` and `team` this will be same as the `name` field.
- **`description`**: Optional description of entity. Refer to *[basic.json#/definitions/markdown](#sic.json#/definitions/markdown)*.
- **`displayName`** *(string)*: Display Name that identifies this entity.
- **`deleted`** *(boolean)*: If true the entity referred to has been soft-deleted.
- **`inherited`** *(boolean)*: If true the relationship indicated by this entity reference is inherited from the parent entity.
- **`href`**: Link to the entity resource. Refer to *[basic.json#/definitions/href](#sic.json#/definitions/href)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
