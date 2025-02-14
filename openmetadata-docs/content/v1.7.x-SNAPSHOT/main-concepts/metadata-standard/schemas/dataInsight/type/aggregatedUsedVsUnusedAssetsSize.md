---
title: aggregatedUsedVsUnusedAssetsSize
slug: /main-concepts/metadata-standard/schemas/datainsight/type/aggregatedusedvsunusedassetssize
---

# AggregatedUsedVsUnusedAssetsSize

*AggregatedUsedVsUnusedAssetsSize data blob*

## Properties

- **`timestamp`**: timestamp. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`UnusedPercentage`** *(number)*: Percentage of the size of unused assets (last access >= 3 days).
- **`UsedPercentage`** *(number)*: Percentage of the size of used assets (last access < 3 days).
- **`Unused`** *(number)*: Size of unused assets (last access >= 3 days).
- **`Used`** *(number)*: Size of used assets (last access < 3 days).


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
