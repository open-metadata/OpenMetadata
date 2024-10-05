import sys

import pytest

from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.usage import UsageWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


@pytest.fixture()
def usage_config(db_service, workflow_config, db_name):
    return {
        "source": {
            "type": "mssql-usage",
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "queryLogDuration": 2,
                    "resultLimit": 1000,
                    "databaseFilterPattern": {"includes": ["TestDB", db_name]},
                },
            },
        },
        "processor": {"type": "query-parser", "config": {}},
        "stage": {"type": "table-usage", "config": {"filename": "/tmp/mssql_usage"}},
        "bulkSink": {
            "type": "metadata-usage",
            "config": {"filename": "/tmp/mssql_usage"},
        },
        "workflowConfig": workflow_config,
    }


def test_usage(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    usage_config,
):
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(UsageWorkflow, usage_config)
