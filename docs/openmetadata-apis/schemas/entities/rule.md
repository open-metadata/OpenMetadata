# LifecycleRule

Describes an entity Lifecycle Rule used within a Policy.

**$id:**[**https://open-metadata.org/schema/entity/data/policies/lifecycle/rule.json**](https://open-metadata.org/schema/entity/policies/lifecycle/rule.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **name**
	 - Name that identifies this Rule.
	 - Type: `string`
 - **prefixFilter**
	 - $ref: [filters.json#/definitions/prefix](filters.md#prefix)
 - **regexFilter**
	 - $ref: [filters.json#/definitions/regex](filters.md#regex)
 - **tagsFilter**
	 - $ref: [filters.json#/definitions/tags](filters.md#tags)
 - **actions** `required`
	 - A set of actions to take on the entities.
	 - Type: `array`
	 - Item Count:  &ge; 1
		 - **Items**
 - **enabled**
	 - Is the rule enabled.
	 - Type: `boolean`
	 - Default: _true_


_This document was updated on: Wednesday, March 9, 2022_