---
title: filterResourceDescriptor
slug: /main-concepts/metadata-standard/schemas/events/filterresourcedescriptor
---

# FilterResourceDescriptor

*Filter descriptor*

## Properties

- **`name`** *(string)*: Name of the resource. For entity related resources, resource name is same as the entity name. Some resources such as lineage are not entities but are resources.
- **`supportedFilters`** *(array)*: List of operations supported filters by the resource.
  - **Items**: Refer to *./eventFilterRule.json*.
- **`supportedActions`** *(array)*: List of actions supported filters by the resource.
  - **Items**: Refer to *./eventFilterRule.json*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
