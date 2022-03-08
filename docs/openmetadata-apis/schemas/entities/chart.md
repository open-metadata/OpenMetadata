# Chart

This schema defines the Chart entity. Charts are built using tables or sql queries by analyzing the data. Charts can be part of Dashboard.

**$id:**[**https://open-metadata.org/schema/entity/data/chart.json**](https://open-metadata.org/schema/entity/data/chart.json)

Type: `object`

This schema does not accept additional properties.

## Properties
 - **id** `required`
	 - Unique identifier that identifies a chart instance.
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
	 - Name that identifies this Chart.
	 - Type: `string`
	 - Length: between 1 and 128
 - **displayName**
	 - Display Name that identifies this Chart. It could be title or label from the source services.
	 - Type: `string`
 - **fullyQualifiedName**
	 - A unique name that identifies a dashboard in the format 'ServiceName.ChartName'.
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
 - **chartType**
	 - $ref: [#/definitions/chartType](#charttype)
 - **chartUrl**
	 - Chart URL, pointing to its own Service URL.
	 - Type: `string`
	 - String format must be a "uri"
 - **href**
	 - Link to the resource corresponding to this entity.
	 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **owner**
	 - Owner of this dashboard.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **tables**
	 - Link to table used in this chart.
	 - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **followers**
	 - Followers of this chart.
	 - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **tags**
	 - Tags for this chart.
	 - Type: `array`
		 - **Items**
		 - $ref: [../../type/tagLabel.json](../types/taglabel.md)
 - **service** `required`
	 - Link to service where this dashboard is hosted in.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **serviceType**
	 - Service type where this chart is hosted in.
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
  * Unique identifier that identifies a chart instance.
  * $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
* **name** `required`
  * Name that identifies this Chart.
  * Type: `string`
  * Length: between 1 and 128
* **displayName**
  * Display Name that identifies this Chart. It could be title or label from the source services.
  * Type: `string`
* **fullyQualifiedName**
  * A unique name that identifies a dashboard in the format 'ServiceName.ChartName'.
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
* **chartType**
  * $ref: [#/definitions/chartType](chart.md#charttype)
* **chartUrl**
  * Chart URL, pointing to its own Service URL.
  * Type: `string`
  * String format must be a "uri"
* **href**
  * Link to the resource corresponding to this entity.
  * $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
* **owner**
  * Owner of this dashboard.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **tables**
  * Link to table used in this chart.
  * $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
* **followers**
  * Followers of this chart.
  * $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
* **tags**
  * Tags for this chart.
  * Type: `array`
    * **Items**
    * $ref: [../../type/tagLabel.json](../types/taglabel.md)
* **service** `required`
  * Link to service where this dashboard is hosted in.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **serviceType**
  * Service type where this chart is hosted in.
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

## Type definitions in this schema

### chartType

* This schema defines the type used for describing different types of charts.
* Type: `string`
* The value is restricted to the following:
  1. _"Line"_
  2. _"Table"_
  3. _"Bar"_
  4. _"Area"_
  5. _"Pie"_
  6. _"Histogram"_
  7. _"Scatter"_
  8. _"Text"_
  9. _"BoxPlot"_
  10. _"Other"_

<<<<<<< HEAD
_This document was updated on: Monday, March 7, 2022_=======
_This document was updated on: Monday, March 7, 2022_
>>>>>>> a07bc411 (updated json schema and schema docs (#3219))
