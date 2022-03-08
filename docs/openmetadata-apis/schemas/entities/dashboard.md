# Dashboard

This schema defines the Dashboard entity. Dashboards are computed from data and visually present data, metrics, and KPIs. They are updated in real-time and allow interactive data exploration.

**$id:**[**https://open-metadata.org/schema/entity/data/dashboard.json**](https://open-metadata.org/schema/entity/data/dashboard.json)

Type: `object`

This schema does not accept additional properties.

## Properties
 - **id** `required`
	 - Unique identifier that identifies a dashboard instance.
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
	 - Name that identifies this dashboard.
	 - Type: `string`
	 - Length: between 1 and 128
 - **displayName**
	 - Display Name that identifies this Dashboard. It could be title or label from the source services.
	 - Type: `string`
 - **fullyQualifiedName**
	 - A unique name that identifies a dashboard in the format 'ServiceName.DashboardName'.
	 - Type: `string`
	 - Length: between 1 and 256
 - **description**
	 - Description of the dashboard, what it is, and how to use it.
	 - Type: `string`
 - **version**
	 - Metadata version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
 - **updatedAt**
	 - Last update time corresponding to the new version of the entity in Unix epoch time milliseconds.
	 - $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
 - **updatedBy**
	 - User who made the update.
	 - Type: `string`
 - **dashboardUrl**
	 - Dashboard URL.
	 - Type: `string`
	 - String format must be a "uri"
 - **charts**
	 - All the charts included in this Dashboard.
	 - Type: `array`
		 - **Items**
		 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **href**
	 - Link to the resource corresponding to this entity.
	 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **owner**
	 - Owner of this dashboard.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **followers**
	 - Followers of this dashboard.
	 - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **tags**
	 - Tags for this dashboard.
	 - Type: `array`
		 - **Items**
		 - $ref: [../../type/tagLabel.json](../types/taglabel.md)
 - **service** `required`
	 - Link to service where this dashboard is hosted in.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **serviceType**
	 - Service type where this dashboard is hosted in.
	 - $ref: [../services/dashboardService.json#/definitions/dashboardServiceType](dashboardservice.md#dashboardservicetype)
 - **usageSummary**
	 - Latest usage information for this database.
	 - $ref: [../../type/usageDetails.json](../types/usagedetails.md)
 - **changeDescription**
	 - Change that lead to this version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
 - **deleted**
	 - When `true` indicates the entity has been soft deleted.
	 - Type: `boolean`
	 - Default: _false_
>>>>>>> a07bc411 (updated json schema and schema docs (#3219))

* **id** `required`
  * Unique identifier that identifies a dashboard instance.
  * $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
* **name** `required`
  * Name that identifies this dashboard.
  * Type: `string`
  * Length: between 1 and 128
* **displayName**
  * Display Name that identifies this Dashboard. It could be title or label from the source services.
  * Type: `string`
* **fullyQualifiedName**
  * A unique name that identifies a dashboard in the format 'ServiceName.DashboardName'.
  * Type: `string`
  * Length: between 1 and 256
* **description**
  * Description of the dashboard, what it is, and how to use it.
  * Type: `string`
* **version**
  * Metadata version of the entity.
  * $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
* **updatedAt**
  * Last update time corresponding to the new version of the entity in Unix epoch time milliseconds.
  * $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
* **updatedBy**
  * User who made the update.
  * Type: `string`
* **dashboardUrl**
  * Dashboard URL.
  * Type: `string`
  * String format must be a "uri"
* **charts**
  * All the charts included in this Dashboard.
  * Type: `array`
    * **Items**
    * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **href**
  * Link to the resource corresponding to this entity.
  * $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
* **owner**
  * Owner of this dashboard.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **followers**
  * Followers of this dashboard.
  * $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
* **tags**
  * Tags for this dashboard.
  * Type: `array`
    * **Items**
    * $ref: [../../type/tagLabel.json](../types/taglabel.md)
* **service** `required`
  * Link to service where this dashboard is hosted in.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **serviceType**
  * Service type where this dashboard is hosted in.
  * $ref: [../services/dashboardService.json#/definitions/dashboardServiceType](https://github.com/open-metadata/OpenMetadata/blob/main/docs/openmetadata-apis/schemas/services/dashboardservice.md#dashboardservicetype)
* **usageSummary**
  * Latest usage information for this database.
  * $ref: [../../type/usageDetails.json](../types/usagedetails.md)
* **changeDescription**
  * Change that lead to this version of the entity.
  * $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
* **deleted**
  * When `true` indicates the entity has been soft deleted.
  * Type: `boolean`
  * Default: _false_

<<<<<<< HEAD
_This document was updated on: Monday, March 7, 2022_=======
_This document was updated on: Monday, March 7, 2022_
>>>>>>> a07bc411 (updated json schema and schema docs (#3219))
