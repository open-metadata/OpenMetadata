# Report

This schema defines the Report entity.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json)

Type: `object`

## Properties

* **id** `required`
  * Unique identifier that identifies this report.
  * $ref: [../../type/basic.json\#/definitions/uuid](report.md#....typebasic.jsondefinitionsuuid)
* **name** `required`
  * Name that identifies the this report instance uniquely.
  * Type: `string`
  * Length: between 1 and 64
* **fullyQualifiedName**
  * A unique name that identifies a report in the format 'ServiceName.ReportName'.
  * Type: `string`
  * Length: between 1 and 64
* **description**
  * Description of this report instance.
  * Type: `string`
* **href**
  * Link to the resource corresponding to this report.
  * $ref: [../../type/basic.json\#/definitions/href](report.md#....typebasic.jsondefinitionshref)
* **owner**
  * Owner of this pipeline.
  * $ref: [../../type/entityReference.json](report.md#....typeentityreference.json)
* **service** `required`
  * Link to service where this report is hosted in.
  * $ref: [../../type/entityReference.json](report.md#....typeentityreference.json)
* **usageSummary**
  * Latest usage information for this database.
  * $ref: [../../type/usageDetails.json](report.md#....typeusagedetails.json)

