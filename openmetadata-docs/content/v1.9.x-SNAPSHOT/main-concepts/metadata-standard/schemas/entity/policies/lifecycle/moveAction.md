---
title: moveAction
slug: /main-concepts/metadata-standard/schemas/entity/policies/lifecycle/moveaction
---

# LifecycleMoveAction

*An action to move the entity to a different location. For eg: Move from Standard storage tier to Archive storage tier.*

## Properties

- **`daysAfterCreation`** *(integer)*: Number of days after creation of the entity that the move should be triggered. Minimum: `1`.
- **`daysAfterModification`** *(integer)*: Number of days after last modification of the entity that the move should be triggered. Minimum: `1`.
- **`destination`** *(object)*: Location where this entity needs to be moved to. Cannot contain additional properties.
  - **`storageServiceType`**: The storage service to move this entity to. Refer to *../../services/storageService.json*.
  - **`storageClassType`**: The storage class to move this entity to. Refer to *../../../type/storage.json#/definitions/storageClassType*.
  - **`location`**: The location where to move this entity to. Refer to *../../data/location.json*.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
