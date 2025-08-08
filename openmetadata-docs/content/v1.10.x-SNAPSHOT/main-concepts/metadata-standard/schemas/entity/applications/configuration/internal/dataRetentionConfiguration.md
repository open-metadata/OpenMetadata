---
title: dataRetentionConfiguration
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/internal/dataretentionconfiguration
---

# Retention Configuration

*Configure retention policies for each entity.*

## Properties

- **`changeEventRetentionPeriod`** *(integer)*: Enter the retention period for change event records in days (e.g., 7 for one week, 30 for one month). Minimum: `1`. Default: `7`.
- **`activityThreadsRetentionPeriod`** *(integer)*: Enter the retention period for Activity Threads of type = 'Conversation' records in days (e.g., 30 for one month, 60 for two months). Minimum: `0`. Default: `60`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
