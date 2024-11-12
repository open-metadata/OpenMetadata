---
title: app
slug: /main-concepts/metadata-standard/schemas/entity/applications/app
---

# App

*This schema defines the applications for Open-Metadata.*

## Properties

- **`id`**: Unique identifier of this application. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of the Application. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name for the application.
- **`description`**: Description of the Application. Refer to *../../type/basic.json#/definitions/markdown*.
- **`features`**: Features of the Application. Refer to *../../type/basic.json#/definitions/markdown*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`owner`**: Owner of this workflow. Refer to *../../type/entityReference.json*. Default: `None`.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`provider`**: Refer to *../../type/basic.json#/definitions/providerType*.
- **`developer`** *(string)*: Developer For the Application.
- **`developerUrl`** *(string)*: Url for the developer.
- **`privacyPolicyUrl`** *(string)*: Privacy Policy for the developer.
- **`supportEmail`** *(string)*: Support Email for the application.
- **`className`** *(string)*: Full Qualified ClassName for the Schedule.
- **`appType`**: This schema defines the type of application. Refer to *#/definitions/appType*.
- **`scheduleType`**: This schema defines the Schedule Type of Application. Refer to *#/definitions/scheduleType*.
- **`permission`**: Permission used by Native Applications. Refer to *#/definitions/permissions*.
- **`bot`**: Bot User Associated with this application. Refer to *../../type/entityReference.json*. Default: `None`.
- **`runtime`**: Execution Configuration. Refer to *#/definitions/executionContext*.
- **`appConfiguration`**: Application Configuration object.
- **`pipelines`**: References to pipelines deployed for this database service to extract metadata, usage, lineage etc.. Refer to *../../type/entityReferenceList.json*.
- **`appSchedule`**: In case the app supports scheduling, list of different app schedules. Refer to *#/definitions/appSchedule*.
- **`openMetadataServerConnection`**: Refer to *../services/connections/metadata/openMetadataConnection.json*.
- **`appLogoUrl`** *(string)*: Application Logo Url.
- **`appScreenshots`** *(array)*: Application Screenshots.
  - **Items** *(string)*
## Definitions

- **`scheduleType`** *(string)*: This schema defines the type of application. Must be one of: `['Live', 'Scheduled']`.
- **`scheduleTimeline`** *(string)*: Must be one of: `['Hourly', ' Daily', 'Weekly', 'Monthly', 'Custom']`. Default: `Weekly`.
- **`appSchedule`**: This schema defines the type of application. Cannot contain additional properties.
  - **`scheduleType`**: Refer to *#/definitions/scheduleTimeline*.
  - **`cronExpression`** *(string)*: Cron Expression in case of Custom scheduled Trigger.
- **`appType`** *(string)*: This schema defines the type of application. Must be one of: `['internal', 'external']`.
- **`permissions`** *(string)*: This schema defines the Permission used by Native Application. Must be one of: `['All']`.
- **`executionContext`**: Execution Configuration. Cannot contain additional properties.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
