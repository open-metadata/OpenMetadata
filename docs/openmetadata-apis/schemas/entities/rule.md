# LifecycleRule

Describes an entity Lifecycle Rule used within a Policy.

**$id:**[**https://open-metadata.org/schema/entity/data/policies/lifecycle/rule.json**](https://open-metadata.org/schema/entity/policies/lifecycle/rule.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
- **filters** `required` 
  - $ref: [filters.json#/definitions/filters](filters.md#filters)
- **actions** `required`
  - A set of actions to take on the entities.
  - Type: `array`
    - **Items**

_This document was updated on: Thursday, December 9, 2021_