# Metrics

This schema defines the Metrics entity. Metrics are measurements computed from data such as `Monthly Active Users`. Some of the metrics that measures used to determine performance against an objective are called KPIs or Key Performance Indicators, such as `User Retention`.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json)

Type: `object`

## Properties

* **id** `required`
  * Unique identifier that identifies this metrics instance.
  * $ref: [../../type/basic.json\#/definitions/uuid](metrics.md#....typebasic.jsondefinitionsuuid)
* **name** `required`
  * Name that identifies this metrics instance uniquely.
  * Type: `string`
  * Length: between 1 and 64
* **fullyQualifiedName**
  * A unique name that identifies a metric in the format 'ServiceName.MetricName'.
  * Type: `string`
  * Length: between 1 and 64
* **description**
  * Description of metrics instance, what it is, and how to use it.
  * Type: `string`
* **href**
  * Link to the resource corresponding to this entity.
  * $ref: [../../type/basic.json\#/definitions/href](metrics.md#....typebasic.jsondefinitionshref)
* **owner**
  * Owner of this metrics.
  * $ref: [../../type/entityReference.json](metrics.md#....typeentityreference.json)
* **service** `required`
  * Link to service where this metrics is hosted in.
  * $ref: [../../type/entityReference.json](metrics.md#....typeentityreference.json)
* **usageSummary**
  * Latest usage information for this database.
  * $ref: [../../type/usageDetails.json](metrics.md#....typeusagedetails.json)

