# Entity Relationship

This schema defines the EntityRelationship type used for establishing relationship between two entities. EntityRelationship is used for capturing relationships from one entity to another. For example, a database contains tables.

**$id:** [**https://open-metadata.org/schema/type/entityRelationship.json**](https://open-metadata.org/schema/type/entityRelationship.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **fromId**
	 - Unique identifier that identifies the entity from which the relationship originates.
	 - $ref: [basic.json#/definitions/uuid](basic.md#uuid)
 - **fromFQN**
	 - Fully qualified name of the entity from which the relationship originates.
	 - Type: `string`
 - **fromEntity** `required`
	 - Type of the entity from which the relationship originates. Examples: `database`, `table`, `metrics` ...
	 - Type: `string`
 - **toId**
	 - Unique identifier that identifies the entity towards which the relationship refers to.
	 - $ref: [basic.json#/definitions/uuid](basic.md#uuid)
 - **toFQN**
	 - Fully qualified name of the entity towards which the relationship refers to.
	 - Type: `string`
 - **toEntity** `required`
	 - Type of the entity towards which the relationship refers to. Examples: `database`, `table`, `metrics` ...
	 - Type: `string`
 - **relation** `required`
	 - Describes relationship between the two entities.
	 - Type: `string`
 - **deleted**
	 - `true` indicates the relationship has been soft deleted.
	 - Type: `boolean`
	 - Default: _false_


_This document was updated on: Tuesday, January 25, 2022_