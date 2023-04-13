---
title: createLocation
slug: /main-concepts/metadata-standard/schemas/api/data/createlocation
---

# CreateLocationRequest

*Create Location entity request*

## Properties

- **`name`**: Refer to *../../entity/data/location.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this location.
- **`path`** *(string)*: Location full path.
- **`description`**: Description of the location instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`locationType`**: Refer to *../../entity/data/location.json#/definitions/locationType*.
- **`tags`** *(array)*: Tags for this location. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owner`**: Owner of this Location. Refer to *../../type/entityReference.json*.
- **`service`**: Link to the service where this location is from. Note this could be of multiple storage service types. Refer to *../../type/entityReference.json*.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
