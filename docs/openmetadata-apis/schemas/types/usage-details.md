# Usage Details

This schema defines the type used for capturing usage details. Based on usage, daily, weekly, and monthly aggregation of usage is provided along with the percentile rank based on the usage.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/usageDetails.json)

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
  * Date in UTC time.
  * $ref: [basic.json\#/definitions/date](usage-details.md#basic.jsondefinitionsdate)

## Types defined in this schema

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

