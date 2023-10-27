---
title: createAppMarketPlaceDefinitionReq
slug: /main-concepts/metadata-standard/schemas/entity/applications/marketplace/createappmarketplacedefinitionreq
---

# CreateAppMarketPlaceDefinitionReq

*This schema defines the applications for Open-Metadata.*

## Properties

- **`name`**: Name of the Application. Refer to *[../../../type/basic.json#/definitions/entityName](#/../../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name for the application.
- **`description`**: Description of the Application. Refer to *[../../../type/basic.json#/definitions/markdown](#/../../type/basic.json#/definitions/markdown)*.
- **`features`**: Features of the Application. Refer to *[../../../type/basic.json#/definitions/markdown](#/../../type/basic.json#/definitions/markdown)*.
- **`owner`**: Owner of this workflow. Refer to *[../../../type/entityReference.json](#/../../type/entityReference.json)*. Default: `null`.
- **`developer`** *(string)*: Developer For the Application.
- **`developerUrl`** *(string)*: Url for the developer.
- **`privacyPolicyUrl`** *(string)*: Privacy Policy for the developer.
- **`supportEmail`** *(string)*: Support Email for the application.
- **`className`** *(string)*: Full Qualified ClassName for the the application.
- **`appType`**: This schema defines the type of application. Refer to *[../app.json#/definitions/appType](#/app.json#/definitions/appType)*.
- **`scheduleType`**: This schema defines the Schedule Type of Application. Refer to *[../app.json#/definitions/scheduleType](#/app.json#/definitions/scheduleType)*.
- **`permission`**: Permission used by Native Applications. Refer to *[../app.json#/definitions/permissions](#/app.json#/definitions/permissions)*.
- **`runtime`**: If app type is live, user can provide additional runtime context. Refer to *[../app.json#/definitions/executionContext](#/app.json#/definitions/executionContext)*.
- **`appConfiguration`**: Application Configuration object.
- **`appLogoUrl`** *(string, format: uri)*: Application Logo Url.
- **`appScreenshots`** *(array)*: Application Screenshots.
  - **Items** *(string)*


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
