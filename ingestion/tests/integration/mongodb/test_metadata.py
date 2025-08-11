import sys

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.workflow.metadata import MetadataWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


@pytest.fixture(scope="module")
def prepare_mongodb(mongodbContainer):
    db = mongodbContainer.get_connection_client().test
    db.create_collection(
        "test_table",
        validator={
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["id", "name"],
                "properties": {
                    "id": {
                        "bsonType": "int",
                    },
                    "name": {
                        "bsonType": "string",
                        "maxLength": 100,
                    },
                    "age": {
                        "bsonType": "int",
                    },
                },
            }
        },
    )
    data = [
        {"id": 1, "name": "John Doe", "age": 25},
        {"id": 2, "name": "Jane Smith", "age": 30},
    ]

    db.test_table.insert_many(data)


@pytest.mark.parametrize(
    "table_fqn,expected_columns",
    [
        [
            "{service}.test.test.test_table",
            {
                "id": {"type": "int", "nullable": False},
                "name": {"type": "string", "nullable": False},
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
    prepare_mongodb,
):
    run_workflow(MetadataWorkflow, ingestion_config)
    table = metadata.get_by_name(
        entity=Table, fqn=table_fqn.format(service=db_service.fullyQualifiedName.root)
    )
    assert table
    assert table.fullyQualifiedName.root.split(".")[-1] == "test_table"
    assert len(table.columns) == 4
    for name, properties in expected_columns.items():
        column = next((col for col in table.columns if col.name.root == name), None)
        assert column is not None
        assert column.dataType.name.lower() == properties["type"]
