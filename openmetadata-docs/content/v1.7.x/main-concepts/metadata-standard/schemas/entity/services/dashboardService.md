---
title: Dashboard Service | OpenMetadata Dashboard Service
slug: /main-concepts/metadata-standard/schemas/entity/services/dashboardservice
---

# Dashboard Service

*This schema defines the Dashboard Service entity, such as Looker and Superset.*

## Properties

- **`id`**: Unique identifier of this dashboard service instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this dashboard service. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this dashboard service.
- **`serviceType`**: Type of dashboard service such as Looker or Superset... Refer to *[#/definitions/dashboardServiceType](#definitions/dashboardServiceType)*.
- **`description`**: Description of a dashboard service instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`connection`**: Refer to *[#/definitions/dashboardConnection](#definitions/dashboardConnection)*.
- **`pipelines`**: References to pipelines deployed for this dashboard service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *[connections/testConnectionResult.json](#nnections/testConnectionResult.json)*.
- **`tags`** *(array)*: Tags for this Dashboard Service. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this dashboard service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this dashboard service. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`domain`**: Domain the Dashboard service belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
## Definitions

- **`dashboardServiceType`** *(string)*: Type of Dashboard service - Superset, Looker, Redash, Tableau, Metabase, PowerBi, Mode, or Lightdash. Must be one of: `["Superset", "Looker", "Tableau", "Redash", "Metabase", "PowerBI", "PowerBIReportServer", "Mode", "CustomDashboard", "DomoDashboard", "QuickSight", "QlikSense", "Lightdash", "MicroStrategy", "QlikCloud", "Sigma"]`.
- **`dashboardConnection`** *(object)*: Dashboard Connection. Cannot contain additional properties.
  - **`config`**
    - **One of**
      - : Refer to *[./connections/dashboard/lookerConnection.json](#connections/dashboard/lookerConnection.json)*.
      - : Refer to *[./connections/dashboard/metabaseConnection.json](#connections/dashboard/metabaseConnection.json)*.
      - : Refer to *[./connections/dashboard/powerBIConnection.json](#connections/dashboard/powerBIConnection.json)*.
      - : Refer to *[./connections/dashboard/powerBIReportServerConnection.json](#connections/dashboard/powerBIReportServerConnection.json)*.
      - : Refer to *[./connections/dashboard/redashConnection.json](#connections/dashboard/redashConnection.json)*.
      - : Refer to *[./connections/dashboard/supersetConnection.json](#connections/dashboard/supersetConnection.json)*.
      - : Refer to *[./connections/dashboard/tableauConnection.json](#connections/dashboard/tableauConnection.json)*.
      - : Refer to *[./connections/dashboard/modeConnection.json](#connections/dashboard/modeConnection.json)*.
      - : Refer to *[./connections/dashboard/customDashboardConnection.json](#connections/dashboard/customDashboardConnection.json)*.
      - : Refer to *[./connections/dashboard/domoDashboardConnection.json](#connections/dashboard/domoDashboardConnection.json)*.
      - : Refer to *[./connections/dashboard/quickSightConnection.json](#connections/dashboard/quickSightConnection.json)*.
      - : Refer to *[./connections/dashboard/qlikSenseConnection.json](#connections/dashboard/qlikSenseConnection.json)*.
      - : Refer to *[./connections/dashboard/lightdashConnection.json](#connections/dashboard/lightdashConnection.json)*.
      - : Refer to *[./connections/dashboard/microStrategyConnection.json](#connections/dashboard/microStrategyConnection.json)*.
      - : Refer to *[./connections/dashboard/qlikCloudConnection.json](#connections/dashboard/qlikCloudConnection.json)*.
      - : Refer to *[./connections/dashboard/sigmaConnection.json](#connections/dashboard/sigmaConnection.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
