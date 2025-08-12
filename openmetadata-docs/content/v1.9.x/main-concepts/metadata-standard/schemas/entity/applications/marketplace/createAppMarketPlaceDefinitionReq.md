---
title: createAppMarketPlaceDefinitionReq | Official Documentation
description: Schema for creating app marketplace entries including config, supported types, and metadata fields.
slug: /main-concepts/metadata-standard/schemas/entity/applications/marketplace/createappmarketplacedefinitionreq
---

# CreateAppMarketPlaceDefinitionRequest

*This schema defines the applications for Open-Metadata.*

## Properties

- **`name`**: Name of the Application. Refer to *[../../../type/basic.json#/definitions/entityName](#/../../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name for the application.
- **`description`**: Description of the Application. Refer to *[../../../type/basic.json#/definitions/markdown](#/../../type/basic.json#/definitions/markdown)*.
- **`features`**: Features of the Application. Refer to *[../../../type/basic.json#/definitions/markdown](#/../../type/basic.json#/definitions/markdown)*.
- **`owners`**: Owners of this workflow. Refer to *[../../../type/entityReferenceList.json](#/../../type/entityReferenceList.json)*. Default: `null`.
- **`tags`** *(array)*: Tags associated with the entity. Default: `null`.
  - **Items**: Refer to *[../../../type/tagLabel.json](#/../../type/tagLabel.json)*.
- **`developer`** *(string)*: Developer For the Application.
- **`developerUrl`** *(string)*: Url for the developer.
- **`privacyPolicyUrl`** *(string)*: Privacy Policy for the developer.
- **`supportEmail`** *(string)*: Support Email for the application.
- **`className`** *(string)*: Full Qualified ClassName for the the application.
- **`sourcePythonClass`** *(string)*: Fully Qualified class name for the Python source that will execute the external application.
- **`appType`**: This schema defines the type of application. Refer to *[../app.json#/definitions/appType](#/app.json#/definitions/appType)*.
- **`scheduleType`**: This schema defines the Schedule Type of Application. Refer to *[../app.json#/definitions/scheduleType](#/app.json#/definitions/scheduleType)*.
- **`permission`**: Permission used by Native Applications. Refer to *[../app.json#/definitions/permissions](#/app.json#/definitions/permissions)*.
- **`runtime`**: If app type is live, user can provide additional runtime context. Refer to *[../app.json#/definitions/executionContext](#/app.json#/definitions/executionContext)*.
- **`allowConfiguration`** *(boolean)*: Allow users to configure the app from the UI. If `false`, the `configure` step will be hidden. Default: `true`.
- **`appConfiguration`**: Application Configuration object. Refer to *[../configuration/applicationConfig.json#/definitions/appConfig](#/configuration/applicationConfig.json#/definitions/appConfig)*.
- **`appLogoUrl`** *(string, format: uri)*: Application Logo Url.
- **`appScreenshots`** *(array)*: Application Screenshots.
  - **Items** *(string)*
- **`system`** *(boolean)*: A system app cannot be uninstalled or modified. Default: `false`.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.
- **`supportsInterrupt`** *(boolean)*: If the app run can be interrupted as part of the execution. Default: `false`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
