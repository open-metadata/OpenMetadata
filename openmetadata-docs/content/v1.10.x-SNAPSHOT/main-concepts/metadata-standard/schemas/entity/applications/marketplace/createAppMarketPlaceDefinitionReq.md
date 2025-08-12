---
title: createAppMarketPlaceDefinitionReq
slug: /main-concepts/metadata-standard/schemas/entity/applications/marketplace/createappmarketplacedefinitionreq
---

# CreateAppMarketPlaceDefinitionRequest

*This schema defines the applications for Open-Metadata.*

## Properties

- **`name`**: Name of the Application. Refer to *../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name for the application.
- **`description`**: Description of the Application. Refer to *../../../type/basic.json#/definitions/markdown*.
- **`features`**: Features of the Application. Refer to *../../../type/basic.json#/definitions/markdown*.
- **`owners`**: Owners of this workflow. Refer to *../../../type/entityReferenceList.json*. Default: `None`.
- **`tags`** *(array)*: Tags associated with the entity. Default: `None`.
  - **Items**: Refer to *../../../type/tagLabel.json*.
- **`developer`** *(string)*: Developer For the Application.
- **`developerUrl`** *(string)*: Url for the developer.
- **`privacyPolicyUrl`** *(string)*: Privacy Policy for the developer.
- **`supportEmail`** *(string)*: Support Email for the application.
- **`className`** *(string)*: Full Qualified ClassName for the the application. Use can use 'org.openmetadata.service.apps.AbstractNativeApplication' if you don't have one yet.
- **`sourcePythonClass`** *(string)*: Fully Qualified class name for the Python source that will execute the external application.
- **`appType`**: This schema defines the type of application. Refer to *../app.json#/definitions/appType*.
- **`agentType`**: This schema defines the type of the agent. Refer to *../app.json#/definitions/agentType*.
- **`scheduleType`**: This schema defines the Schedule Type of Application. Refer to *../app.json#/definitions/scheduleType*.
- **`permission`**: Permission used by Native Applications. Refer to *../app.json#/definitions/permissions*.
- **`runtime`**: If app type is live, user can provide additional runtime context. Refer to *../app.json#/definitions/executionContext*.
- **`allowConfiguration`** *(boolean)*: Allow users to configure the app from the UI. If `false`, the `configure` step will be hidden. Default: `True`.
- **`appConfiguration`**: Application Configuration object. Refer to *../configuration/applicationConfig.json#/definitions/appConfig*.
- **`appLogoUrl`** *(string)*: Application Logo Url.
- **`appScreenshots`** *(array)*: Application Screenshots.
  - **Items** *(string)*
- **`system`** *(boolean)*: A system app cannot be uninstalled or modified. Default: `False`.
- **`domains`** *(array)*: Fully qualified names of the domains the Application belongs to.
  - **Items** *(string)*
- **`supportsInterrupt`** *(boolean)*: If the app run can be interrupted as part of the execution. Default: `False`.
- **`eventSubscriptions`** *(array)*: Event subscriptions that will be created when the application is installed. Default: `[]`.
  - **Items**: Refer to *../../../events/api/createEventSubscription.json*.
- **`enabled`** *(boolean)*: The app will be installable only if this flag is set to true. Default: `True`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
