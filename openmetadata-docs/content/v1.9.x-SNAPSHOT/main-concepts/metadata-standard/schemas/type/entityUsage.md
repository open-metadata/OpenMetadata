---
title: Entity Usage | OpenMetadata Entity Usage Information
description: EntityUsage schema records interaction patterns and usage frequency of metadata entities.
slug: /main-concepts/metadata-standard/schemas/type/entityusage
---

# EntityUsage

*This schema defines the type used for capturing usage details of an entity.*

## Properties

- **`entity`**: Entity for which usage is returned. Refer to *[entityReference.json](#tityReference.json)*.
- **`usage`** *(array)*: List usage details per day.
  - **Items**: Refer to *[usageDetails.json](#ageDetails.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
