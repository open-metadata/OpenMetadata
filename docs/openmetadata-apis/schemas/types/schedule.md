# Schedule

This schema defines the type used for schedule with start time and repeat frequency.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/schedule.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/schedule.json)

Type: `object`

## Properties

* **startDate**
  * Start date and time of the schedule.
  * $ref: [basic.json\#/definitions/dateTime](schedule.md#basic.jsondefinitionsdatetime)
* **repeatFrequency**
  * Repeat frequency in ISO 8601 duration format. Example - 'P23DT23H'
  * $ref: [basic.json\#/definitions/duration](schedule.md#basic.jsondefinitionsduration)

