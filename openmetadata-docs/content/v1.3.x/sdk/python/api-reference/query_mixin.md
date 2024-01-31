---
title: Query Mixin
slug: /sdk/python/api-reference/query-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/query_mixin.py#L0")

# module `query_mixin`
Mixin class containing Query specific methods 

To be used by OpenMetadata class 



---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/query_mixin.py#L30")

## class `OMetaQueryMixin`
OpenMetadata API methods related to Queries. 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/query_mixin.py#L92")

### method `get_entity_queries`

```python
get_entity_queries(
    entity_id: Union[Uuid, str],
    fields: Optional[List[str]] = None
) → Optional[List[Query]]
```

Get the queries attached to a table 



**Args:**
 
 - <b>`entity_id`</b> (Union[Uuid,str]):  entity id of given entity 
 - <b>`fields`</b> (Optional[List[str]]):  list of fields to be included in response 





**Returns:**
 
 - <b>`Optional[List[Query]]`</b>:  List of queries 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/query_mixin.py#L52")

### method `ingest_entity_queries_data`

```python
ingest_entity_queries_data(
    entity: Union[Table, Dashboard],
    queries: List[CreateQueryRequest]
) → None
```

PUT queries for an entity 

:param entity: Entity to update :param queries: CreateQueryRequest to add 




---


