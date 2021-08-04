# usagedetails

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json
```

Type used to return usage details of an entity

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                         |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :--------------------------------------------------------------------------------- |
| Can be instantiated | Yes        | Unknown status | No           | Forbidden         | Allowed               | none                | [usageDetails.json](../../../../out/type/usageDetails.json "open original schema") |

## Type used to return usage details of an entity Type

`object` ([Type used to return usage details of an entity](usagedetails.md))

# Type used to return usage details of an entity Properties

| Property                      | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                                                       |
| :---------------------------- | :------- | :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [dailyStats](#dailystats)     | `object` | Required | cannot be null | [Type used to return usage details of an entity](#usagedetails-definitions-usagestats "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/properties/dailyStats")   |
| [weeklyStats](#weeklystats)   | `object` | Optional | cannot be null | [Type used to return usage details of an entity](#usagedetails-definitions-usagestats "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/properties/weeklyStats")  |
| [monthlyStats](#monthlystats) | `object` | Optional | cannot be null | [Type used to return usage details of an entity](#usagedetails-definitions-usagestats "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/properties/monthlyStats") |
| [date](#date)                 | `string` | Required | cannot be null | [Basic type](../types/basic.md#basic-definitions-date)                      |

## dailyStats



> Type used to return usage statistics

`dailyStats`

*   is required

*   Type: `object` ([Details](#usagedetails-definitions-usagestats))

*   cannot be null

*   defined in: [Type used to return usage details of an entity](#usagedetails-definitions-usagestats "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/properties/dailyStats")

### dailyStats Type

`object` ([Details](#usagedetails-definitions-usagestats))

## weeklyStats



> Type used to return usage statistics

`weeklyStats`

*   is optional

*   Type: `object` ([Details](#usagedetails-definitions-usagestats))

*   cannot be null

*   defined in: [Type used to return usage details of an entity](#usagedetails-definitions-usagestats "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/properties/weeklyStats")

### weeklyStats Type

`object` ([Details](#usagedetails-definitions-usagestats))

## monthlyStats



> Type used to return usage statistics

`monthlyStats`

*   is optional

*   Type: `object` ([Details](#usagedetails-definitions-usagestats))

*   cannot be null

*   defined in: [Type used to return usage details of an entity](#usagedetails-definitions-usagestats "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/properties/monthlyStats")

### monthlyStats Type

`object` ([Details](#usagedetails-definitions-usagestats))

## date

Date in ISO 8601 format in UTC time. Example - '2018-11-13'

`date`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Basic type](../types/basic.md#basic-definitions-date)

### date Type

`string`

### date Constraints

**date**: the string must be a date string, according to [RFC 3339, section 5.6](https://tools.ietf.org/html/rfc3339 "check the specification")

# Type used to return usage details of an entity Definitions

## Definitions group usageStats

Reference this group by using

```json
{"$ref":"https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats"}
```

| Property                          | Type      | Required | Nullable       | Defined by                                                                                                                                                                                                                                                                                                          |
| :-------------------------------- | :-------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [count](#count)                   | `integer` | Required | cannot be null | [Type used to return usage details of an entity](#usagedetails-definitions-usagestats-properties-count "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats/properties/count")                   |
| [percentileRank](#percentilerank) | `number`  | Optional | cannot be null | [Type used to return usage details of an entity](#usagedetails-definitions-usagestats-properties-percentilerank "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats/properties/percentileRank") |

### count



`count`

*   is required

*   Type: `integer`

*   cannot be null

*   defined in: [Type used to return usage details of an entity](#usagedetails-definitions-usagestats-properties-count "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats/properties/count")

#### count Type

`integer`

#### count Constraints

**minimum**: the value of this number must greater than or equal to: `0`

### percentileRank



`percentileRank`

*   is optional

*   Type: `number`

*   cannot be null

*   defined in: [Type used to return usage details of an entity](#usagedetails-definitions-usagestats-properties-percentilerank "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats/properties/percentileRank")

#### percentileRank Type

`number`

#### percentileRank Constraints

**maximum**: the value of this number must smaller than or equal to: `100`

**minimum**: the value of this number must greater than or equal to: `0`
# usagedetails-definitions-usagestats-properties-count

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats/properties/count
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                          |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :---------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [usageDetails.json*](../../../../out/type/usageDetails.json "open original schema") |

## count Type

`integer`

## count Constraints

**minimum**: the value of this number must greater than or equal to: `0`
# usagedetails-definitions-usagestats-properties-percentilerank

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats/properties/percentileRank
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                          |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :---------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [usageDetails.json*](../../../../out/type/usageDetails.json "open original schema") |

## percentileRank Type

`number`

## percentileRank Constraints

**maximum**: the value of this number must smaller than or equal to: `100`

**minimum**: the value of this number must greater than or equal to: `0`
# usagedetails-definitions-usagestats

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/properties/monthlyStats
```



> Type used to return usage statistics

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                          |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :---------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Forbidden             | none                | [usageDetails.json*](../../../../out/type/usageDetails.json "open original schema") |

## monthlyStats Type

`object` ([Details](#usagedetails-definitions-usagestats))

# monthlyStats Properties

| Property                          | Type      | Required | Nullable       | Defined by                                                                                                                                                                                                                                                                                                          |
| :-------------------------------- | :-------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [count](#count)                   | `integer` | Required | cannot be null | [Type used to return usage details of an entity](#usagedetails-definitions-usagestats-properties-count "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats/properties/count")                   |
| [percentileRank](#percentilerank) | `number`  | Optional | cannot be null | [Type used to return usage details of an entity](#usagedetails-definitions-usagestats-properties-percentilerank "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats/properties/percentileRank") |

## count



`count`

*   is required

*   Type: `integer`

*   cannot be null

*   defined in: [Type used to return usage details of an entity](#usagedetails-definitions-usagestats-properties-count "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats/properties/count")

### count Type

`integer`

### count Constraints

**minimum**: the value of this number must greater than or equal to: `0`

## percentileRank



`percentileRank`

*   is optional

*   Type: `number`

*   cannot be null

*   defined in: [Type used to return usage details of an entity](#usagedetails-definitions-usagestats-properties-percentilerank "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions/usageStats/properties/percentileRank")

### percentileRank Type

`number`

### percentileRank Constraints

**maximum**: the value of this number must smaller than or equal to: `100`

**minimum**: the value of this number must greater than or equal to: `0`
# usagedetails-definitions

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json#/definitions
```



| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                          |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :---------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [usageDetails.json*](../../../../out/type/usageDetails.json "open original schema") |

## definitions Type

unknown
