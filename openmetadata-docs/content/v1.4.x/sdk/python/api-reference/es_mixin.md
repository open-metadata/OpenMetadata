---
title: ES Mixin
slug: /sdk/python/api-reference/es-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/es_mixin.py#L0")

# module `es_mixin`
Mixin class containing Lineage specific methods 

To be used by OpenMetadata class 

**Global Variables**
---------------
- **ES_INDEX_MAP**


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/es_mixin.py#L38")

## class `ESMixin`
OpenMetadata API methods related to Elasticsearch. 

To be inherited by OpenMetadata 



---

#### handler es_get_queries_with_lineage


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/es_mixin.py#L82")

### method `es_search_from_fqn`

```python
es_search_from_fqn(
    entity_type: Type[~T],
    fqn_search_string: str,
    from_count: int = 0,
    size: int = 10,
    fields: Optional[str] = None
) → Optional[List[~T]]
```

Given a service_name and some filters, search for entities using ES 

:param entity_type: Entity to look for :param fqn_search_string: string used to search by FQN. E.g., service.*.schema.table :param from_count: Records to expect :param size: Number of records :param fields: Comma separated list of fields to be returned :return: List of entities 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/es_mixin.py#L151")

### method `get_query_with_lineage_filter`

```python
get_query_with_lineage_filter(service_name: str) → str
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/es_mixin.py#L139")

### method `get_reindex_job_status`

```python
get_reindex_job_status(job_id: str) → Optional[EventPublisherResult]
```

Method to fetch the elasticsearch reindex job status 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/es_mixin.py#L124")

### method `reindex_es`

```python
reindex_es(config: CreateEventPublisherJob) → Optional[EventPublisherResult]
```

Method to trigger elasticsearch reindex 




---


