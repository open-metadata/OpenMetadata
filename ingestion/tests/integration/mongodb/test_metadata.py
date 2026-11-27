import pytest

from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def prepare_mongodb(mongodbContainer):  # noqa: N803
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
        {"id": 1, "name": "John Doe", "age": 25, "zip_code": "01051"},
        {"id": 2, "name": "Jane Smith", "age": 30, "zip_code": "01052"},
    ]

    db.test_table.insert_many(data)
    db.create_collection("test_view", viewOn="test_table", pipeline=[])


@pytest.mark.parametrize(
    "table_fqn,expected_columns",
    [
        [
            "{service}.test.test.test_table",
            {
                "id": {"type": "int", "nullable": False},
                "name": {"type": "string", "nullable": False},
                "age": {"type": "int", "nullable": True},
                "zip_code": {"type": "string", "nullable": True},
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
    table = metadata.get_by_name(entity=Table, fqn=table_fqn.format(service=db_service.fullyQualifiedName.root))
    assert table
    assert table.fullyQualifiedName.root.split(".")[-1] == "test_table"
    assert len(table.columns) == 5
    for name, properties in expected_columns.items():
        column = next((col for col in table.columns if col.name.root == name), None)
        assert column is not None
        assert column.dataType.name.lower() == properties["type"]


def test_views_are_ingested_as_views(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    metadata,
    db_service,
    prepare_mongodb,
):
    run_workflow(MetadataWorkflow, ingestion_config)
    service = db_service.fullyQualifiedName.root

    assert metadata.get_by_name(entity=Table, fqn=f"{service}.test.test.test_view").tableType == TableType.View
    assert metadata.get_by_name(entity=Table, fqn=f"{service}.test.test.test_table").tableType == TableType.Regular
