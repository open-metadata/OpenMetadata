# Daily Count

This schema defines the type for reporting the daily count of some measurement. Example - number of times a table was used in queries per day.

**$id:** [**https://open-metadata.org/schema/type/dailyCount.json**](https://open-metadata.org/schema/type/dailyCount.json)

Type: `object`

This schema does not accept additional properties.

## Properties

* **count** `required`
  * Daily count of a measurement on the given date.
  * Type: `integer`
  * Range:  ≥ 0
* **date** `required`
  * $ref: [basic.json\#/definitions/date](daily-count.md#basic.jsondefinitionsdate)

