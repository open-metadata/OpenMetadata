# Usage Details

This schema defines the type for usage details. Daily, weekly, and monthly aggregation of usage is computed along with the percentile rank based on the usage for a given day.

**$id:** [**https://open-metadata.org/schema/type/usageDetails.json**](https://open-metadata.org/schema/type/usageDetails.json)

Type: `object`

## Properties

* **dailyStats** `required`
  * Daily usage stats of a data asset on the start date.
  * $ref: [\#/definitions/usageStats](usage-details.md#/definitions/usageStats)
* **weeklyStats**
  * Weekly \(last 7 days\) rolling usage stats of a data asset on the start date.
  * $ref: [\#/definitions/usageStats](usage-details.md#/definitions/usageStats)
* **monthlyStats**
  * Monthly \(last 30 days\) rolling usage stats of a data asset on the start date.
  * $ref: [\#/definitions/usageStats](usage-details.md#/definitions/usageStats)
* **date** `required`
  * Date in UTC.
  * $ref: [basic.json\#/definitions/date](usage-details.md#basic.jsondefinitionsdate)

## Types definitions in this schema

**usageStats**

* Type used to return usage statistics
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

