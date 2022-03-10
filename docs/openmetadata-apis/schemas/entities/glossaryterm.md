# GlossaryTerm

This schema defines te Glossary term entities.

**$id:**[**https//:open-metadata.org/schema/entity/data/glossaryTerm.json**](https://open-metadata.org/schema/entity/data/glossaryTerm.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **id** `required`
	 - Unique identifier of a glossary term instance.
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
	 - Preferred name for the glossary term.
	 - $ref: [#/definitions/name](#name)
 - **displayName**
	 - Display Name that identifies this glossary.
	 - Type: `string`
 - **description**
	 - Description of the glossary term.
	 - Type: `string`
 - **fullyQualifiedName**
	 - A unique name that identifies a glossary term. It captures name hierarchy of glossary of terms in the form of `glossaryName.parentTerm.childTerm`.
	 - Type: `string`
	 - Length: between 1 and 256
 - **synonyms**
	 - Alternate names that are synonyms or near-synonyms for the glossary term.
	 - Type: `array`
		 - **Items**
		 - $ref: [#/definitions/name](#name)
 - **glossary** `required`
	 - Glossary that this term belongs to.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **parent**
	 - Parent glossary term that this term is child of. When `null` this term is the root term of the glossary.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **children**
	 - Other glossary terms that are children of this glossary term.
	 - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **relatedTerms**
	 - Other glossary terms that are related to this glossary term.
	 - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **references**
	 - Link to a reference from an external glossary.
	 - Type: `array`
		 - **Items**
		 - $ref: [../../entity/data/glossaryTerm.json#/definitions/termReference](glossaryterm.md#termreference)
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
	 - User names of the reviewers for this glossary.
	 - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **usageCount**
	 - Count of how many times this and it's children glossary terms are used as labels.
	 - Type: `integer`
 - **tags**
	 - Tags for this glossary term.
	 - Type: `array`
		 - **Items**
		 - $ref: [../../type/tagLabel.json](../types/taglabel.md)
 - **changeDescription**
	 - Change that lead to this version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
 - **status**
	 - Status of the glossary term.
	 - $ref: [#/definitions/status](#status)
 - **deleted**
	 - When `true` indicates the entity has been soft deleted.
	 - Type: `boolean`
	 - Default: _false_


## Type definitions in this schema
### name

 - Name that identifies a glossary term.
 - Type: `string`
 - Length: between 1 and 128


### termReference

 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **name**
		 - Name that identifies the source of an external glossary term. Example `HealthCare.gov`.
		 - Type: `string`
	 - **endpoint**
		 - Name that identifies the source of an external glossary term. Example `HealthCare.gov`.
		 - Type: `string`
		 - String format must be a "uri"


### status

 - Type: `string`
 - The value is restricted to the following: 
	 1. _"Draft"_
	 2. _"Approved"_
	 3. _"Deprecated"_
 - Default: _"Draft"_




_This document was updated on: Wednesday, March 9, 2022_