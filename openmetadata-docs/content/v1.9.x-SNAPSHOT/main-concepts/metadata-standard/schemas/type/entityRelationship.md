---
title: entityRelationship | OpenMetadata Entity Relationship
description: EntityRelationship schema captures direct relationships between two metadata objects.
slug: /main-concepts/metadata-standard/schemas/type/entityrelationship
---

# EntityRelationship

*This schema defines the EntityRelationship type used for establishing relationship between two entities. EntityRelationship is used for capturing relationships from one entity to another. For example, a database contains tables.*

## Properties

- **`fromId`**: Unique identifier that identifies the entity from which the relationship originates. Refer to *[basic.json#/definitions/uuid](#sic.json#/definitions/uuid)*.
- **`fromFQN`** *(string)*: Fully qualified name of the entity from which the relationship originates.
- **`fromEntity`** *(string)*: Type of the entity from which the relationship originates. Examples: `database`, `table`, `metrics` ...
- **`toId`**: Unique identifier that identifies the entity towards which the relationship refers to. Refer to *[basic.json#/definitions/uuid](#sic.json#/definitions/uuid)*.
- **`toFQN`** *(string)*: Fully qualified name of the entity towards which the relationship refers to.
- **`toEntity`** *(string)*: Type of the entity towards which the relationship refers to. Examples: `database`, `table`, `metrics` ...
- **`relation`** *(integer)*: Describes relationship between the two entities as an integer. Minimum: `0`.
- **`relationshipType`**: Describes relationship between the two entities. Eg: Database --- Contains --> Table. Refer to *[#/definitions/relationshipType](#definitions/relationshipType)*.
- **`deleted`** *(boolean)*: `true` indicates the relationship has been soft deleted. Default: `false`.
## Definitions

- **`relationshipType`** *(string)*: This enum captures all the relationships between Catalog entities. Note that the relationship from is a Strong entity and to is Weak entity when possible. Must be one of: `["contains", "createdBy", "repliedTo", "isAbout", "addressedTo", "mentionedIn", "testedBy", "uses", "owns", "parentOf", "has", "follows", "joinedWith", "upstream", "appliedTo", "relatedTo", "reviews", "reactedTo", "voted", "expert", "editedBy", "defaultsTo", "relatesTo"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
