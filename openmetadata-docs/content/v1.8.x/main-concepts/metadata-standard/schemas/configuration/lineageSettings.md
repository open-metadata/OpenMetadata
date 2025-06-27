---
title: Lineage Settings | OpenMetadata Lineage Config
slug: /main-concepts/metadata-standard/schemas/configuration/lineagesettings
---

# LineageSettings

*This schema defines the Lineage Settings.*

## Properties

- **`upstreamDepth`** *(integer)*: Upstream Depth for Lineage. Minimum: `1`. Maximum: `5`. Default: `2`.
- **`downstreamDepth`** *(integer)*: DownStream Depth for Lineage. Minimum: `1`. Maximum: `5`. Default: `2`.
- **`lineageLayer`**: Lineage Layer. Refer to *[#/definitions/lineageLayer](#definitions/lineageLayer)*.
## Definitions

- **`lineageLayer`** *(string)*: Lineage Layers. Must be one of: `["EntityLineage", "ColumnLevelLineage", "DataObservability"]`. Default: `"EntityLineage"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
