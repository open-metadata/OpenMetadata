# Report

This schema defines the Report entity. Reports are static information computed from data periodically that includes data in text, table, and visual form.

**$id:**[**https://open-metadata.org/schema/entity/data/report.json**](https://open-metadata.org/schema/entity/data/report.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **id** `required`
	 - Unique identifier that identifies this report.
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
	 - Name that identifies this report instance uniquely.
	 - Type: `string`
	 - Length: between 1 and 128
 - **fullyQualifiedName**
	 - A unique name that identifies a report in the format 'ServiceName.ReportName'.
	 - Type: `string`
	 - Length: between 1 and 256
 - **displayName**
	 - Display Name that identifies this report. It could be title or label from the source services.
	 - Type: `string`
 - **description**
	 - Description of this report instance.
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
 - **href**
	 - Link to the resource corresponding to this report.
	 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **owner**
	 - Owner of this pipeline.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **service** `required`
	 - Link to service where this report is hosted in.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
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


_This document was updated on: Wednesday, March 9, 2022_