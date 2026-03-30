import pytest
from sqlalchemy import create_engine, text

from metadata.generated.schema.entity.data.table import Table
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def mysql_engine(mysql_container):
    engine = create_engine(mysql_container.get_connection_url())
    yield engine
    engine.dispose()


@pytest.fixture()
def column_order_table(mysql_engine):
    with mysql_engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS employees.column_order_test"))
        conn.execute(
            text(
                "CREATE TABLE employees.column_order_test ("
                "  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,"
                "  name VARCHAR(100),"
                "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                ")"
            )
        )
        conn.commit()
    yield
    with mysql_engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS employees.column_order_test"))
        conn.commit()


def test_column_order_preserved_after_adding_column_in_middle(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    metadata,
    db_service,
    mysql_engine,
    column_order_table,
):
    run_workflow(MetadataWorkflow, ingestion_config)

    table_fqn = (
        f"{db_service.fullyQualifiedName.root}.default.employees.column_order_test"
    )
    table = metadata.get_by_name(entity=Table, fqn=table_fqn)
    assert table is not None
    assert len(table.columns) == 3
    assert table.columns[0].name.root == "id"
    assert table.columns[1].name.root == "name"
    assert table.columns[2].name.root == "created_at"

    with mysql_engine.connect() as conn:
        conn.execute(
            text(
                "ALTER TABLE employees.column_order_test "
                "ADD COLUMN email VARCHAR(255) AFTER name"
            )
        )
        conn.commit()

    run_workflow(MetadataWorkflow, ingestion_config)

    table = metadata.get_by_name(entity=Table, fqn=table_fqn)
    assert table is not None
    assert len(table.columns) == 4
    assert table.columns[0].name.root == "id"
    assert table.columns[1].name.root == "name"
    assert table.columns[2].name.root == "email"
    assert table.columns[3].name.root == "created_at"
