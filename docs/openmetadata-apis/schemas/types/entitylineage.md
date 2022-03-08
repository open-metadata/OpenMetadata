# Entity Lineage

This schema defines the type used for lineage of an entity.

**$id:** [**https://open-metadata.org/schema/type/entitylineage.json**](https://open-metadata.org/schema/type/entitylineage.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **entity** `required`
	 - Primary entity for which this lineage graph is created.
	 - $ref: [entityReference.json](entityreference.md)
 - **nodes**
	 - Type: `array`
		 - **Items**
		 - $ref: [entityReference.json](entityreference.md)
 - **upstreamEdges**
	 - Type: `array`
		 - **Items**
		 - $ref: [#/definitions/edge](#edge)
 - **downstreamEdges**
	 - Type: `array`
		 - **Items**
		 - $ref: [#/definitions/edge](#edge)


## Type definitions in this schema
### edge

 - Edge in the lineage graph from one entity to another by entity IDs.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **fromEntity**
		 - From entity that is upstream of lineage edge.
		 - $ref: [basic.json#/definitions/uuid](basic.md#uuid)
	 - **toEntity**
		 - To entity that is downstream of lineage edge.
		 - $ref: [basic.json#/definitions/uuid](basic.md#uuid)
	 - **description**
		 - Type: `string`


### entitiesEdge

 - Edge in the lineage graph from one entity to another using entity references.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **fromEntity**
		 - From entity that is upstream of lineage edge.
		 - $ref: [entityReference.json](entityreference.md)
	 - **toEntity**
		 - To entity that is downstream of lineage edge.
		 - $ref: [entityReference.json](entityreference.md)
	 - **description**
		 - Type: `string`




_This document was updated on: Monday, March 7, 2022_