## Ingestion Workflow classes

We have different classes for different types of workflows. The logic is always the same, but you will need
to change your import path. The rest of the method calls will remain the same.

For example, for the `Metadata` workflow we'll use:

```python
import yaml

from metadata.workflow.metadata import MetadataWorkflow

def run():
    workflow_config = yaml.safe_load(CONFIG)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()
```

The classes for each workflow type are:

- `Metadata`: `from metadata.workflow.metadata import MetadataWorkflow`
- `Lineage`: `from metadata.workflow.metadata import MetadataWorkflow` (same as metadata)
- `Usage`: `from metadata.workflow.usage import UsageWorkflow`
- `dbt`: `from metadata.workflow.metadata import MetadataWorkflow`
- `Profiler`: `from metadata.workflow.profiler import ProfilerWorkflow`
- `Data Quality`: `from metadata.workflow.data_quality import TestSuiteWorkflow`
- `Data Insights`: `from metadata.workflow.data_insight import DataInsightWorkflow`
- `Elasticsearch Reindex`: `from metadata.workflow.metadata import MetadataWorkflow` (same as metadata)
