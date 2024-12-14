import sys

import pytest
from sqlalchemy import create_engine

from metadata.generated.schema.entity.data.table import Constraint, Table
from metadata.workflow.metadata import MetadataWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


@pytest.fixture(scope="module")
def prepare_cockroach(cockroach_container):
    engine = create_engine(cockroach_container.get_connection_url())

    sql = [
        """
        CREATE TABLE test_table (
            id INTEGER NOT NULL DEFAULT unique_rowid(),
            name VARCHAR(100),
            age INTEGER,
            PRIMARY KEY (id)
        );
        """,
        """
        INSERT INTO test_table (name, age) VALUES 
            ('John Doe', 25),
            ('Jane Smith', 30);
        """,
    ]
    for stmt in sql:
        engine.execute(stmt)


@pytest.mark.parametrize(
    "table_fqn,expected_columns",
    [
        [
            "{service}.roach.public.test_table",
            {
                "id": {"type": "int", "nullable": False},
                "name": {"type": "varchar", "nullable": True},
                "age": {"type": "int", "nullable": True},
            },
        ]
    ],
    ids=lambda x: x.split(".")[-1] if isinstance(x, str) else "",
)
def test_ingest_metadata(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    metadata,
    table_fqn,
    expected_columns,
    db_service,
    prepare_cockroach,
):
    run_workflow(MetadataWorkflow, ingestion_config)

    table = metadata.get_by_name(
        entity=Table, fqn=table_fqn.format(service=db_service.fullyQualifiedName.root)
    )
    assert table
    assert table.fullyQualifiedName.root.split(".")[-1] == "test_table"

    for name, properties in expected_columns.items():
        column = next((col for col in table.columns if col.name.root == name), None)
        assert column is not None
        assert column.dataType.name.lower() == properties["type"]
        assert (
            column.constraint == Constraint.PRIMARY_KEY
            if name == "id"
            else Constraint.NULL
        )
