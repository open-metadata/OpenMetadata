# Daily Count

This schema defines the type used for capturing and reporting the daily count of some measurement, such as usage, joins.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/dailyCount.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/dailyCount.json)

Type: `object`

## Properties

* **count** `required`
  * Daily count of a measurement on the given date.
  * Type: `integer`
  * Range:  ≥ 0
* **date** `required`
  * $ref: [basic.json\#/definitions/date](daily-count.md#basic.jsondefinitionsdate)

