# Schedule

This schema defines the type used for the schedule. The schedule has a start time and repeat frequency.

**$id:** [**https://open-metadata.org/schema/type/schedule.json**](https://open-metadata.org/schema/type/schedule.json)

Type: `object`

## Properties

* **startDate**
  * Start date and time of the schedule.
  * $ref: [basic.json\#/definitions/dateTime](basic.md#types-definitions-in-this-schema)
* **repeatFrequency**
  * Repeat frequency in ISO 8601 duration format. Example - 'P23DT23H'
  * $ref: [basic.json\#/definitions/duration](basic.md#types-definitions-in-this-schema)



