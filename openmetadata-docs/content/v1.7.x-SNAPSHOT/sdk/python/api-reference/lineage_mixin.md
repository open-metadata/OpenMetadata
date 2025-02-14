---
title: Lineage Mixin
slug: /sdk/python/api-reference/lineage-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/lineage_mixin.py#L0")

# module `lineage_mixin`
Mixin class containing Lineage specific methods 

To be used by OpenMetadata class 

**Global Variables**
---------------
- **LINEAGE_PARSING_TIMEOUT**


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/lineage_mixin.py#L35")

## class `OMetaLineageMixin`
OpenMetadata API methods related to Lineage. 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/lineage_mixin.py#L44")

### method `add_lineage`

```python
add_lineage(data: AddLineageRequest) → Dict[str, Any]
```

Add lineage relationship between two entities and returns the entity information of the origin node 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/lineage_mixin.py#L151")

### method `add_lineage_by_query`

```python
add_lineage_by_query(
    database_service: DatabaseService,
    sql: str,
    database_name: str = None,
    schema_name: str = None,
    timeout: int = 10
) → None
```

Method parses the query and generated the lineage between source and target tables 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/lineage_mixin.py#L138")

### method `delete_lineage_edge`

```python
delete_lineage_edge(edge: EntitiesEdge) → None
```

Remove the given Edge 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/lineage_mixin.py#L67")

### method `get_lineage_by_id`

```python
get_lineage_by_id(
    entity: Union[Type[~T], str],
    entity_id: str,
    up_depth: int = 1,
    down_depth: int = 1
) → Optional[Dict[str, Any]]
```

Get lineage details for an entity `id` :param entity: Type of the entity :param entity_id: Entity ID :param up_depth: Upstream depth of lineage (default=1, min=0, max=3)" :param down_depth: Downstream depth of lineage (default=1, min=0, max=3) 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/lineage_mixin.py#L85")

### method `get_lineage_by_name`

```python
get_lineage_by_name(
    entity: Union[Type[~T], str],
    fqn: str,
    up_depth: int = 1,
    down_depth: int = 1
) → Optional[Dict[str, Any]]
```

Get lineage details for an entity `id` :param entity: Type of the entity :param fqn: Entity FQN :param up_depth: Upstream depth of lineage (default=1, min=0, max=3)" :param down_depth: Downstream depth of lineage (default=1, min=0, max=3) 




---


