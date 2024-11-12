import sys

import pytest
from freezegun import freeze_time
from sqlalchemy import create_engine

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


@pytest.fixture(
    params=["german", "english"],  # test for both languages
)
def language_config(mssql_container, request):
    language = request.param
    engine = create_engine(
        "mssql+pytds://" + mssql_container.get_connection_url().split("://")[1],
        connect_args={"autocommit": True},
    )
    engine.execute(
        f"ALTER LOGIN {mssql_container.username} WITH DEFAULT_LANGUAGE={language};"
    )


@pytest.fixture()
def lineage_config(language_config, db_service, workflow_config, sink_config, db_name):
    return {
        "source": {
            "type": "mssql-lineage",
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "DatabaseLineage",
                    "databaseFilterPattern": {"includes": ["TestDB", db_name]},
                },
            },
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@freeze_time("2024-01-30")  # to demonstrate the issue with german language
def test_lineage(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    lineage_config,
    db_service,
    metadata,
    db_name,
):
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(MetadataWorkflow, lineage_config)
    department_table = metadata.get_by_name(
        Table,
        f"{db_service.fullyQualifiedName.root}.{db_name}.SalesLT.Customer",
        nullable=False,
    )
    lineage = metadata.get_lineage_by_id(Table, department_table.id.root)
    assert lineage is not None
