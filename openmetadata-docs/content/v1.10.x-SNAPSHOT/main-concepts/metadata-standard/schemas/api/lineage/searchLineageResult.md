---
title: searchLineageResult
slug: /main-concepts/metadata-standard/schemas/api/lineage/searchlineageresult
---

# SearchLineageResult

*Search Lineage Response for the Lineage Request*

## Properties

- **`nodes`**: Nodes in the lineage response.
- **`upstreamEdges`**: Upstream Edges for the entity.
- **`downstreamEdges`**: Downstream Edges for the node.
## Definitions

- **`directionPaging`**
  - **`upstream`** *(array)*
    - **Items**: Refer to *#/definitions/layerPaging*.
  - **`downstream`** *(array)*
    - **Items**: Refer to *#/definitions/layerPaging*.
- **`layerPaging`** *(object)*: Type used for cursor based pagination information in GET list responses. Cannot contain additional properties.
  - **`entityDownstreamCount`** *(integer)*: Count of entities downstream current layer entity.
  - **`entityUpstreamCount`** *(integer)*: Count of entities upstream current layer entity.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
