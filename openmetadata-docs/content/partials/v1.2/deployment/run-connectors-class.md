## Ingestion Workflow classes

We have different classes for different types of workflows. The logic is always the same, but you will need
to change your import path. The rest of the method calls will remain the same.

For example, for the `Metadata` workflow we'll use:

```python
import yaml

from metadata.ingestion.api.workflow import Workflow

def run():
    workflow_config = yaml.safe_load(CONFIG)
    workflow = Workflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()
```

The classes for each workflow type are:

- `Metadata`: `from metadata.ingestion.api.workflow import Workflow`
- `Lineage`: `from metadata.ingestion.api.workflow import Workflow`
- `Usage`: `from metadata.ingestion.api.workflow import Workflow`
- `dbt`: `from metadata.ingestion.api.workflow import Workflow`
- `Profiler`: `from metadata.profiler.api.workflow import ProfilerWorkflow`
- `Data Quality`: `from metadata.data_quality.api.workflow import TestSuiteWorkflow`
