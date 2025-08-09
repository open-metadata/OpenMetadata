---
title: searchLineageRequest
slug: /main-concepts/metadata-standard/schemas/api/lineage/searchlineagerequest
---

# SearchLineageRequest

*Search Lineage Request Schema to find linage from Elastic Search.*

## Properties

- **`fqn`** *(string)*: Entity Fqn to search lineage.
- **`isConnectedVia`** *(boolean)*: Connected Via.
- **`direction`**: Refer to *./lineageDirection.json*.
- **`directionValue`** *(array)*: Lineage Direction Value.
  - **Items** *(string)*
- **`upstreamDepth`** *(integer)*: The upstream depth of the lineage. Default: `3`.
- **`downstreamDepth`** *(integer)*: The downstream depth of the lineage. Default: `3`.
- **`layerFrom`** *(integer)*: Layer to start the search from. Default: `0`.
- **`layerSize`** *(integer)*: Size of the search result. Default: `1000`.
- **`queryFilter`** *(string)*: Query Filter.
- **`includeDeleted`** *(boolean)*: Include deleted entities. Default: `None`.
- **`includeSourceFields`** *(array)*: Include source fields.
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
