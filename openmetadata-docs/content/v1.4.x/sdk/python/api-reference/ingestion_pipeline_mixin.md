---
title: Ingestion Pipeline Mixin
slug: /sdk/python/api-reference/ingestion-pipeline-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/ingestion_pipeline_mixin.py#L0")

# module `ingestion_pipeline_mixin`
Mixin class containing ingestion pipeline specific methods 

To be used by OpenMetadata class 



---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/ingestion_pipeline_mixin.py#L29")

## class `OMetaIngestionPipelineMixin`
OpenMetadata API methods related to ingestion pipeline. 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/ingestion_pipeline_mixin.py#L38")

### method `create_or_update_pipeline_status`

```python
create_or_update_pipeline_status(
    ingestion_pipeline_fqn: str,
    pipeline_status: PipelineStatus
) → None
```

PUT create or update pipeline status 

:param ingestion_pipeline_fqn: Ingestion Pipeline FQN :param pipeline_status: Pipeline Status data to add 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/ingestion_pipeline_mixin.py#L109")

### method `get_ingestion_pipeline_by_name`

```python
get_ingestion_pipeline_by_name(
    fields: Optional[List[str]] = None,
    params: Optional[Dict[str, str]] = None
) → Optional[IngestionPipeline]
```

Get ingestion pipeline statues based on name 



**Args:**
 
 - <b>`name`</b> (str):  Ingestion Pipeline Name 
 - <b>`fields`</b> (List[str]):  List of all the fields 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/ingestion_pipeline_mixin.py#L56")

### method `get_pipeline_status`

```python
get_pipeline_status(
    ingestion_pipeline_fqn: str,
    pipeline_status_run_id: str
) → Optional[PipelineStatus]
```

GET pipeline status 

:param ingestion_pipeline_fqn: Ingestion Pipeline FQN :param pipeline_status_run_id: Pipeline Status run id 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/ingestion_pipeline_mixin.py#L84")

### method `get_pipeline_status_between_ts`

```python
get_pipeline_status_between_ts(
    ingestion_pipeline_fqn: str,
    start_ts: int,
    end_ts: int
) → Optional[List[PipelineStatus]]
```

Get pipeline status between timestamp 



**Args:**
 
 - <b>`ingestion_pipeline_fqn`</b> (str):  pipeline fqn 
 - <b>`start_ts`</b> (int):  start_ts 
 - <b>`end_ts`</b> (int):  end_ts 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/ingestion_pipeline_mixin.py#L72")

### method `run_pipeline`

```python
run_pipeline(ingestion_pipeline_id: str) → IngestionPipeline
```

Run ingestion pipeline workflow 



**Args:**
 
 - <b>`ingestion_pipeline_id`</b> (str):  ingestion pipeline uuid 




---


