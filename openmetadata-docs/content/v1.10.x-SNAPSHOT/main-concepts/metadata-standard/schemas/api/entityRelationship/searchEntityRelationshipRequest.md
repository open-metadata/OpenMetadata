---
title: searchEntityRelationshipRequest
slug: /main-concepts/metadata-standard/schemas/api/entityrelationship/searchentityrelationshiprequest
---

# SearchEntityRelationshipRequest

*Search Entity Relationship Request Schema to find entity relationships from Elastic Search.*

## Properties

- **`fqn`** *(string)*: Entity Fqn to search entity relationships.
- **`direction`**: Refer to *./entityRelationshipDirection.json*.
- **`directionValue`** *(array)*: Entity Relationship Direction Value.
  - **Items** *(string)*
- **`upstreamDepth`** *(integer)*: The upstream depth of the entity relationship. Default: `3`.
- **`downstreamDepth`** *(integer)*: The downstream depth of the entity relationship. Default: `3`.
- **`layerFrom`** *(integer)*: Layer to start the search from. Default: `0`.
- **`layerSize`** *(integer)*: Size of the search result. Default: `1000`.
- **`queryFilter`** *(string)*: Query Filter.
- **`includeDeleted`** *(boolean)*: Include deleted entities. Default: `None`.
- **`includeSourceFields`** *(array)*: Include source fields.
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
