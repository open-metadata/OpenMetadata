# Dashboard

This schema defines the Dashboard entity.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/dashboard.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/dashboard.json)

Type: `object`

## Properties

* **id** `required`
  * Unique identifier that identifies a dashboard instance.
  * $ref: [../../type/basic.json\#/definitions/uuid](dashboard.md#....typebasic.jsondefinitionsuuid)
* **name** `required`
  * Name that identifies this dashboard.
  * Type: `string`
  * Length: between 1 and 64
* **fullyQualifiedName**
  * A unique name that identifies a dashboard in the format 'ServiceName.DashboardName'.
  * Type: `string`
  * Length: between 1 and 64
* **description**
  * Description of the dashboard, what it is, and how to use it.
  * Type: `string`
* **href**
  * Link to the resource corresponding to this entity.
  * $ref: [../../type/basic.json\#/definitions/href](dashboard.md#....typebasic.jsondefinitionshref)
* **owner**
  * Owner of this dashboard.
  * $ref: [../../type/entityReference.json](dashboard.md#....typeentityreference.json)
* **service** `required`
  * Link to service where this dashboard is hosted in.
  * $ref: [../../type/entityReference.json](dashboard.md#....typeentityreference.json)
* **usageSummary**
  * Latest usage information for this database.
  * $ref: [../../type/usageDetails.json](dashboard.md#....typeusagedetails.json)

