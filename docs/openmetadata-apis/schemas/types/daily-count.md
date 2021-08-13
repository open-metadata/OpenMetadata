# Daily count of some measurement

This schema defines the type for reporting the daily count of some measurement. Example - number of times a table was used in queries per day.

<b id="httpsopen-metadata.orgschematypedailycount.json">&#36;id: https://open-metadata.org/schema/type/dailyCount.json</b>

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - <b id="#https://open-metadata.org/schema/type/dailyCount.json/properties/count">count</b> `required`
	 - Daily count of a measurement on the given date.
	 - Type: `integer`
	 - Range:  &ge; 0
 - <b id="#https://open-metadata.org/schema/type/dailyCount.json/properties/date">date</b> `required`
	 - &#36;ref: [basic.json#/definitions/date](#basic.jsondefinitionsdate)
