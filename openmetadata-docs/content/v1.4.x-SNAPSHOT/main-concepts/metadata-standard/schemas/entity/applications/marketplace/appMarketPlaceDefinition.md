---
title: appMarketPlaceDefinition
slug: /main-concepts/metadata-standard/schemas/entity/applications/marketplace/appmarketplacedefinition
---

# AppMarketPlaceDefinition

*This schema defines the applications for Open-Metadata.*

## Properties

- **`id`**: Unique identifier of this application. Refer to *../../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of the Application. Refer to *../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name for the application.
- **`description`**: Description of the Application. Refer to *../../../type/basic.json#/definitions/markdown*.
- **`features`**: Features of the Application. Refer to *../../../type/basic.json#/definitions/markdown*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`owner`**: Owner of this workflow. Refer to *../../../type/entityReference.json*. Default: `None`.
- **`version`**: Metadata version of the entity. Refer to *../../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`tags`** *(array)*: Tags associated with the column. Default: `None`.
  - **Items**: Refer to *../../../type/tagLabel.json*.
- **`developer`** *(string)*: Developer For the Application.
- **`developerUrl`** *(string)*: Url for the developer.
- **`privacyPolicyUrl`** *(string)*: Privacy Policy for the developer.
- **`supportEmail`** *(string)*: Support Email for the application.
- **`className`** *(string)*: Full Qualified ClassName for the the application.
- **`appType`**: This schema defines the type of application. Refer to *../app.json#/definitions/appType*.
- **`scheduleType`**: This schema defines the Schedule Type of Application. Refer to *../app.json#/definitions/scheduleType*.
- **`permission`**: Permission used by Native Applications. Refer to *../app.json#/definitions/permissions*.
- **`runtime`**: If app type is live, user can provide additional runtime context. Refer to *../app.json#/definitions/executionContext*.
- **`appConfiguration`**: Application Configuration object.
- **`appLogoUrl`** *(string)*: Application Logo Url.
- **`appScreenshots`** *(array)*: Application Screenshots.
  - **Items** *(string)*


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
