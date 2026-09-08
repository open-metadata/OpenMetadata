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
        timestamp=Timestamp(execution["run_id_or_logical_date"]),
        endTime=Timestamp(execution["finished_at"]),
        taskStatus=[
            TaskStatus(
                name=task["name"],
                executionStatus=StatusType.Successful,
                startTime=Timestamp(task["started_at"]),
                endTime=Timestamp(task["finished_at"]),
            )
            for task in execution.get("tasks", [])
        ],
    ),
)
```

`timestamp` is the **unique key** for an execution, not a clock. It only has to be stable per run so
re-ingesting the same run updates one row instead of creating another.

Populate a real wall clock separately, in `endTime` or in the per-task `startTime`/`endTime`.
Alerting uses it to tell a run that just failed from one backfilled out of the source's history; a
connector that supplies neither has its executions delivered unfiltered.

## Schema Properties
- `hostPort` (required)
- Auth (token or basic)
- `pipelineFilterPattern`
- `supportsMetadataExtraction`
