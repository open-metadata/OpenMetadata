---
title: Pipeline Mixin
slug: /sdk/python/api-reference/pipeline-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/pipeline_mixin.py#L0")

# module `pipeline_mixin`
Mixin class containing Pipeline specific methods 

To be used by OpenMetadata class 



---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/pipeline_mixin.py#L30")

## class `OMetaPipelineMixin`
OpenMetadata API methods related to the Pipeline Entity 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/pipeline_mixin.py#L39")

### method `add_pipeline_status`

```python
add_pipeline_status(fqn: str, status: PipelineStatus) → Pipeline
```

Given a pipeline and a PipelineStatus, send it to the Pipeline Entity 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/pipeline_mixin.py#L51")

### method `add_task_to_pipeline`

```python
add_task_to_pipeline(pipeline: Pipeline, *tasks: Task) → Pipeline
```

The background logic for this method is that during Airflow backend lineage, we compute one task at a time. 

Let's generalise a bit the approach by preparing a method capable of updating a tuple of tasks from the client. 

Latest changes leave all the task management to the client. Therefore, a Pipeline will only contain the tasks sent in each PUT from the client. 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/pipeline_mixin.py#L95")

### method `clean_pipeline_tasks`

```python
clean_pipeline_tasks(pipeline: Pipeline, task_ids: List[str]) → Pipeline
```

Given a list of tasks, remove from the Pipeline Entity those that are not received as an input. 

e.g., if a Pipeline has tasks A, B, C, but we only receive A & C, we will remove the task B from the entity 




---


