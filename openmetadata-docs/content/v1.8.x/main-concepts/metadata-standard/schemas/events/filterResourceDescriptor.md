---
title: filterResourceDescriptor | Official Documentation
description: Connect Filterresourcedescriptor to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/events/filterresourcedescriptor
---

# FilterResourceDescriptor

*Filter descriptor*

## Properties

- **`name`** *(string)*: Name of the resource. For entity related resources, resource name is same as the entity name. Some resources such as lineage are not entities but are resources.
- **`supportedFilters`** *(array)*: List of operations supported filters by the resource.
  - **Items**: Refer to *[./eventFilterRule.json](#eventFilterRule.json)*.
- **`supportedActions`** *(array)*: List of actions supported filters by the resource.
  - **Items**: Refer to *[./eventFilterRule.json](#eventFilterRule.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
