# schedule

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/schedule.json
```

Type used for schedule with start time and repeat frequency

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                 |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Allowed               | none                | [schedule.json](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/schedule.json "open original schema") |

## Type used for schedule with start time and repeat frequency Type

`object` ([Type used for schedule with start time and repeat frequency](schedule.md))

# Type used for schedule with start time and repeat frequency Properties

| Property                            | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                          |
| :---------------------------------- | :------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [startDate](#startdate)             | `string` | Optional | cannot be null | [Type used for schedule with start time and repeat frequency](basic-definitions-datetime.md "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/schedule.json#/properties/startDate")       |
| [repeatFrequency](#repeatfrequency) | `string` | Optional | cannot be null | [Type used for schedule with start time and repeat frequency](basic-definitions-duration.md "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/schedule.json#/properties/repeatFrequency") |

## startDate

Date and time in ISO 8601 format. Example - '2018-11-13T20:20:39+00:00'

`startDate`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used for schedule with start time and repeat frequency](basic-definitions-datetime.md "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/schedule.json#/properties/startDate")

### startDate Type

`string`

### startDate Constraints

**unknown format**: the value of this string must follow the format: `date-Time`

## repeatFrequency

Duration in ISO 8601 format in UTC time. Example - 'P23DT23H'

> Jsonschema does not handle ISO 8601 duration yet and hence no format for this type

`repeatFrequency`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Type used for schedule with start time and repeat frequency](basic-definitions-duration.md "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/schedule.json#/properties/repeatFrequency")

### repeatFrequency Type

`string`
