---
title: aggregatedUsedVsUnusedAssetsCount
slug: /main-concepts/metadata-standard/schemas/datainsight/type/aggregatedusedvsunusedassetscount
---

# AggregatedUsedVsUnusedAssetsCount

*AggregatedUsedVsUnusedAssetsCount data blob*

## Properties

- **`timestamp`**: timestamp. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`UnusedPercentage`** *(number)*: Percentage of the count of unused assets (last access >= 3 days).
- **`UsedPercentage`** *(number)*: Percentage of the count of used assets (last access < 3 days).
- **`Unused`** *(number)*: Count of unused assets (last access >= 3 days).
- **`Used`** *(number)*: Count of used assets (last access < 3 days).


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
