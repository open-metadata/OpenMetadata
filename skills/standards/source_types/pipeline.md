# Pipeline Connector Standards

## Base Class
`PipelineServiceSource` in `ingestion/src/metadata/ingestion/source/pipeline/pipeline_service.py`

## Reference Connector
`ingestion/src/metadata/ingestion/source/pipeline/airflow/`

## Entity Hierarchy
```
PipelineService → Pipeline → Task
                           → PipelineStatus (execution history)
```

## Required Methods

| Method | Returns | Purpose |
|--------|---------|---------|
| `get_pipelines_list()` | `Iterable[dict]` | List all pipelines |
| `get_pipeline_name(pipeline)` | `str` | Extract pipeline name |
| `yield_pipeline(pipeline_details)` | `Iterable[Either[..., CreatePipelineRequest]]` | Create pipeline with tasks |
| `yield_pipeline_status(pipeline_details)` | `Iterable[Either[..., OMetaPipelineStatus]]` | Pipeline execution history |

## Optional Methods

| Method | Purpose |
|--------|---------|
| `yield_pipeline_lineage_details(pipeline_details)` | Pipeline → table lineage |
| `get_owners(pipeline_details)` | Extract pipeline owners |

## Task Modeling

Tasks are modeled as part of the pipeline entity:

```python
CreatePipelineRequest(
    name=pipeline_name,
    service=self.context.get().pipeline_service,
    tasks=[
        Task(
            name=task["id"],
            displayName=task["name"],
            taskType=task.get("type", "Unknown"),
        )
        for task in pipeline_details.get("tasks", [])
    ],
)
```

## Pipeline Status

Report execution history as `PipelineStatus` with per-task status:

```python
OMetaPipelineStatus(
    pipeline_fqn=pipeline_fqn,
    pipeline_status=PipelineStatus(
        executionStatus=StatusType.Successful,
        timestamp=Timestamp(execution["start_time"]),
        taskStatus=[
            TaskStatus(
                name=task["name"],
                executionStatus=StatusType.Successful,
            )
            for task in execution.get("tasks", [])
        ],
    ),
)
```

## Schema Properties
- `hostPort` (required)
- Auth (token or basic)
- `pipelineFilterPattern`
- `supportsMetadataExtraction`
