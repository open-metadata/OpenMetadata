---
title: esEntityRelationshipData
slug: /main-concepts/metadata-standard/schemas/api/entityrelationship/esentityrelationshipdata
---

# EsEntityRelationshipData

*Response object for the search entity relationship request from Elastic Search.*

## Properties

- **`entity`**: Entity in the relationship (upstream/source entity). Refer to *./relationshipRef.json*.
- **`relatedEntity`**: Related Entity in the relationship (downstream/target entity). Refer to *./relationshipRef.json*.
- **`columns`** *(array)*: Columns associated with the relationship.
  - **Items** *(object)*
    - **`columnFQN`** *(string)*: Column FQN in the entity.
    - **`relatedColumnFQN`** *(string)*: Related column FQN in the related entity.
    - **`relationshipType`** *(string)*: Type of relationship between columns.
- **`description`** *(string)*: Description of the relationship.
- **`docId`** *(string)*: Doc Id for the Entity Relationship.
- **`relationshipType`** *(string)*: Type of relationship.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
