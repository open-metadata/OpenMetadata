# Glossary

This schema defines the Glossary entity. A Glossary is collection of hierarchical GlossaryTerms.

**$id:**[**https//:open-metadata.org/schema/entity/data/glossary.json**](https://open-metadata.org/schema/entity/data/glossary.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **id** `required`
	 - Unique identifier of a glossary instance.
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
	 - Preferred name for the glossary term.
	 - $ref: [#/definitions/name](#name)
	 - Type: `string`
 - **displayName**
	 - Display Name that identifies this glossary.
	 - Type: `string`
 - **description**
	 - Description of the glossary.
	 - Type: `string`
 - **version**
	 - Metadata version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
 - **updatedAt**
	 - Last update time corresponding to the new version of the entity in Unix epoch time milliseconds.
	 - $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
 - **updatedBy**
	 - User who made the update.
	 - Type: `string`
 - **href**
	 - Link to the resource corresponding to this entity.
	 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **reviewers**
	 - User references of the reviewers for this glossary.
	 - Type: `array`
		 - **Items**
		 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **owner**
	 - Owner of this glossary.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **tags**
	 - Tags for this glossary.
	 - Type: `array`
		 - **Items**
		 - $ref: [../../type/tagLabel.json](../types/taglabel.md)
 - **changeDescription**
	 - Change that lead to this version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
 - **deleted**
	 - When `true` indicates the entity has been soft deleted.
	 - Type: `boolean`
	 - Default: _false_


## Type definitions in this schema
### name

 - Name that identifies a glossary term.
 - Type: `string`
 - Length: between 1 and 128




_This document was updated on: Monday, March 7, 2022_