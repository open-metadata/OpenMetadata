# LifecycleMoveAction

An action to move the entity to a different location. For eg: Move from Standard storage tier to Archive storage tier.

**$id:**[**https://open-metadata.org/schema/entity/data/policies/lifecycle/moveaction.json.json**](https://open-metadata.org/schema/entity/policies/lifecycle/moveAction.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **daysAfterCreation**
	 - Number of days after creation of the entity that the move should be triggered.
	 - Type: `integer`
	 - Range:  &ge; 1
 - **daysAfterModification**
	 - Number of days after last modification of the entity that the move should be triggered.
	 - Type: `integer`
	 - Range:  &ge; 1
 - **destination**
	 - Location where this entity needs to be moved to.
	 - Type: `object`
	 - This schema <u>does not</u> accept additional properties.
	 - **Properties**
		 - **storageServiceType**
			 - The storage service to move this entity to.
			 - $ref: [../services/storageService.json](storageservice.md)
		 - **storageClassType**
			 - The storage class to move this entity to.
			 - $ref: [../../type/storage.json#/definitions/storageClassType](../types/storage.md#storageclasstype)
		 - **location**
			 - The location where to move this entity to.
			 - $ref: [../data/location.json](location.md)


_This document was updated on: Wednesday, March 9, 2022_