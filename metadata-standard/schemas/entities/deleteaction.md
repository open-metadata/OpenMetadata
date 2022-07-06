# Delete Action

An action to delete or expire the entity.

**$id:**[**https://open-metadata.org/schema/entity/data/dbtmodel.json**](https://open-metadata.org/schema/entity/policies/lifecycle/deleteAction.json)

Type: `object`

This schema does not accept additional properties.

## Properties

* **daysAfterCreation**
  * Number of days after creation of the entity that the deletion should be triggered.
  * Type: `integer`
  * Range: ≥ 1
* **daysAfterModification**
  * Number of days after last modification of the entity that the deletion should be triggered.
  * Type: `integer`
  * Range: ≥ 1

_This document was updated on: Wednesday, March 9, 2022_
