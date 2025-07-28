---
title: appMarketPlaceDefinition | Official Documentation
description: Metadata schema for app marketplace items including definitions, publishers, and versions.
slug: /main-concepts/metadata-standard/schemas/entity/applications/marketplace/appmarketplacedefinition
---

# AppMarketPlaceDefinition

*This schema defines the applications for Open-Metadata.*

## Properties

- **`id`**: Unique identifier of this application. Refer to *[../../../type/basic.json#/definitions/uuid](#/../../type/basic.json#/definitions/uuid)*.
- **`name`**: Name of the Application. Refer to *[../../../type/basic.json#/definitions/entityName](#/../../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name for the application.
- **`description`**: Description of the Application. Refer to *[../../../type/basic.json#/definitions/markdown](#/../../type/basic.json#/definitions/markdown)*.
- **`features`**: Features of the Application. Refer to *[../../../type/basic.json#/definitions/markdown](#/../../type/basic.json#/definitions/markdown)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`owners`**: Owners of this workflow. Refer to *[../../../type/entityReferenceList.json](#/../../type/entityReferenceList.json)*. Default: `null`.
- **`version`**: Metadata version of the entity. Refer to *[../../../type/entityHistory.json#/definitions/entityVersion](#/../../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../../type/basic.json#/definitions/timestamp](#/../../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../../type/basic.json#/definitions/href](#/../../type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../../type/entityHistory.json#/definitions/changeDescription](#/../../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
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
- **`preview`** *(boolean)*: Flag to enable/disable preview for the application. If the app is in preview mode, it can't be installed. Default: `false`.
- **`domain`**: Domain the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *[../../../type/entityReference.json](#/../../type/entityReference.json)*.
- **`supportsInterrupt`** *(boolean)*: If the app run can be interrupted as part of the execution. Default: `false`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
