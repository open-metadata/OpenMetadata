---
title: usageDetails
slug: /main-concepts/metadata-standard/schemas/type/usagedetails
---

# UsageDetails

*This schema defines the type for usage details. Daily, weekly, and monthly aggregation of usage is computed along with the percentile rank based on the usage for a given day.*

## Properties

- **`dailyStats`**: Daily usage stats of a data asset on the start date. Refer to *#/definitions/usageStats*.
- **`weeklyStats`**: Weekly (last 7 days) rolling usage stats of a data asset on the start date. Refer to *#/definitions/usageStats*.
- **`monthlyStats`**: Monthly (last 30 days) rolling usage stats of a data asset on the start date. Refer to *#/definitions/usageStats*.
- **`date`**: Date in UTC. Refer to *basic.json#/definitions/date*.
## Definitions

- **`usageStats`** *(object)*: Type used to return usage statistics. Cannot contain additional properties.
  - **`count`** *(integer)*: Usage count of a data asset on the start date. Minimum: `0`.
  - **`percentileRank`** *(number)*: Optional daily percentile rank data asset use when relevant. Minimum: `0`. Maximum: `100`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
