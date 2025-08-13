---
title: changeSummaryMap
slug: /main-concepts/metadata-standard/schemas/type/changesummarymap
---

# Change Summary

*This schema defines structure for change summaries.*

## Additional Properties

- **Additional Properties**: Refer to *#/definitions/changeSummary*.
## Definitions

- **`changeSource`** *(string)*: The source of the change. This will change based on the context of the change (example: manual vs programmatic). Must be one of: `['Manual', 'Propagated', 'Automated', 'Derived', 'Ingested', 'Suggested']`. Default: `Manual`.
- **`changeSummary`** *(object)*
  - **`changeSource`**: Refer to *#/definitions/changeSource*.
  - **`changedBy`** *(string)*: Name of the user or bot who made this change.
  - **`changedAt`**: Refer to *./basic.json#/definitions/timestamp*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
