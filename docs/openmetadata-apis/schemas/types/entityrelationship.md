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
 - **relation**
	 - Describes relationship between the two entities as an integer.
	 - Type: `integer`
	 - Range:  &ge; 0
 - **relationshipType** `required`
	 - Describes relationship between the two entities. Eg: Database --- Contains --> Table.
	 - $ref: [#/definitions/relationshipType](#relationshiptype)
 - **deleted**
	 - `true` indicates the relationship has been soft deleted.
	 - Type: `boolean`
	 - Default: _false_


## Type definitions in this schema
### relationshipType

 - This enum captures all the relationships between Catalog entities. Note that the relationship from is a Strong entity and to is Weak entity when possible.
 - Type: `string`
 - The value is restricted to the following: 
	 1. _"contains"_
	 2. _"createdBy"_
	 3. _"repliedTo"_
	 4. _"isAbout"_
	 5. _"addressedTo"_
	 6. _"mentionedIn"_
	 7. _"testedBy"_
	 8. _"uses"_
	 9. _"owns"_
	 10. _"parentOf"_
	 11. _"has"_
	 12. _"follows"_
	 13. _"joinedWith"_
	 14. _"upstream"_
	 15. _"appliedTo"_
	 16. _"relatedTo"_
	 17. _"reviews"_




_This document was updated on: Monday, March 7, 2022_