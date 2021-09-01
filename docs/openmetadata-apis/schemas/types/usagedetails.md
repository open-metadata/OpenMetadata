# Usage Details

This schema defines the type for usage details. Daily, weekly, and monthly aggregation of usage is computed along with the percentile rank based on the usage for a given day.

**$id:** [**https://open-metadata.org/schema/type/usageDetails.json**](https://open-metadata.org/schema/type/usageDetails.json)

Type: `object`

## Properties

* **dailyStats** `required`
  * Daily usage stats of a data asset on the start date.
  * $ref: [\#/definitions/usageStats](usagedetails.md#usagestats)
* **weeklyStats**
  * Weekly \(last 7 days\) rolling usage stats of a data asset on the start date.
  * $ref: [\#/definitions/usageStats](usagedetails.md#usagestats)
* **monthlyStats**
  * Monthly \(last 30 days\) rolling usage stats of a data asset on the start date.
  * $ref: [\#/definitions/usageStats](usagedetails.md#usagestats)
* **date** `required`
  * Date in UTC.
  * $ref: [basic.json\#/definitions/date](basic.md#date)

## Type definitions in this schema

### usageStats

* Type used to return usage statistics.
* Type: `object`
* This schema does not accept additional properties.
* **Properties**
  * **count** `required`
    * Usage count of a data asset on the start date.
    * Type: `integer`
    * Range:  ≥ 0
  * **percentileRank**
    * Optional daily percentile rank data asset use when relevant.
    * Type: `number`
    * Range: between 0 and 100

_This document was updated on: Thursday, August 26, 2021_

