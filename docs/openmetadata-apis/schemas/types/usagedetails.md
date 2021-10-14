# Usage Details

This schema defines the type for usage details. Daily, weekly, and monthly aggregation of usage is computed along with the percentile rank based on the usage for a given day.

**$id: [https://open-metadata.org/schema/type/usageDetails.json](https://open-metadata.org/schema/type/usageDetails.json)**

Type: `object`

## Properties


## Type definitions in this schema

### usageStats

 - Type used to return usage statistics.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
   - **count** `required`
     - Usage count of a data asset on the start date.
     - Type: `integer`
     - Range:  &ge; 0
   - **percentileRank**
     - Optional daily percentile rank data asset use when relevant.
     - Type: `number`
     - Range: between 0 and 100

_This document was updated on: Monday, October 18, 2021_