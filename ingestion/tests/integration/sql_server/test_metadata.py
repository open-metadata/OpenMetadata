import pytest

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import (
    Constraint,
    ConstraintType,
    Table,
    TableType,
)
from metadata.workflow.metadata import MetadataWorkflow

from .conftest import (  # noqa: TID252
    FIRST_DATABASE_DESCRIPTION,
    FIRST_SCHEMA_DESCRIPTION,
    SECOND_DATABASE,
    SECOND_DATABASE_DESCRIPTION,
    SECOND_PROCEDURE_DESCRIPTION,
    SECOND_SCHEMA,
    SECOND_SCHEMA_DESCRIPTION,
    SECOND_TABLE_DESCRIPTION,
)


@pytest.fixture(scope="module")
def ingested(patch_passwords_for_db_services, run_workflow, ingestion_config, db_service):
    """Ingest once for the module: every assertion below reads the same catalogue."""
    run_workflow(MetadataWorkflow, ingestion_config)
    return db_service


def test_ingest_metadata(
    ingested,
    metadata,
    db_name,
):
    table: Table = metadata.get_by_name(
        Table,
        f"{ingested.fullyQualifiedName.root}.{db_name}.SalesLT.Customer",
    )
    assert table is not None
    assert [c.name.root for c in table.columns] == [
        "CustomerID",
        "NameStyle",
        "Title",
        "FirstName",
        "MiddleName",
        "LastName",
        "Suffix",
        "CompanyName",
        "SalesPerson",
        "EmailAddress",
        "Phone",
        "PasswordHash",
        "PasswordSalt",
        "rowguid",
        "ModifiedDate",
    ]
    assert table.columns[0].constraint == Constraint.PRIMARY_KEY


def test_descriptions_are_ingested_for_every_database(ingested, metadata, db_name):
    """Descriptions are read per database, so a two-database run is what tells a
    correct read from one that keeps reporting the previous database's."""
    service = ingested.fullyQualifiedName.root

    descriptions = {
        database_name: (
            metadata.get_by_name(Database, f"{service}.{database_name}").description,
            metadata.get_by_name(DatabaseSchema, f"{service}.{database_name}.{schema_name}").description,
        )
        for database_name, schema_name in ((db_name, "SalesLT"), (SECOND_DATABASE, SECOND_SCHEMA))
    }

    assert {
        database_name: (database.root, schema.root) for database_name, (database, schema) in descriptions.items()
    } == {
        db_name: (FIRST_DATABASE_DESCRIPTION, FIRST_SCHEMA_DESCRIPTION),
        SECOND_DATABASE: (SECOND_DATABASE_DESCRIPTION, SECOND_SCHEMA_DESCRIPTION),
    }


def test_table_and_stored_procedure_descriptions_are_ingested(ingested, metadata):
    service = ingested.fullyQualifiedName.root
    prefix = f"{service}.{SECOND_DATABASE}.{SECOND_SCHEMA}"

    table: Table = metadata.get_by_name(Table, f"{prefix}.orders")
    procedure: StoredProcedure = metadata.get_by_name(StoredProcedure, f"{prefix}.get_orders")

    assert table.description.root == SECOND_TABLE_DESCRIPTION
    assert procedure.description.root == SECOND_PROCEDURE_DESCRIPTION


def test_unique_constraints_reach_the_catalogue(ingested, metadata):
    """A single-column UNIQUE lands on the column, a composite one on the table."""
    table: Table = metadata.get_by_name(
        Table,
        f"{ingested.fullyQualifiedName.root}.{SECOND_DATABASE}.{SECOND_SCHEMA}.orders",
    )

    constraints = {column.name.root: column.constraint for column in table.columns}
    composite = [
        constraint.columns
        for constraint in (table.tableConstraints or [])
        if constraint.constraintType == ConstraintType.UNIQUE
    ]

    assert constraints["code"] == Constraint.UNIQUE
    assert composite == [["region", "ref"]]


def test_an_indexed_view_is_ingested_as_a_materialized_view(ingested, metadata):
    prefix = f"{ingested.fullyQualifiedName.root}.{SECOND_DATABASE}.{SECOND_SCHEMA}"

    indexed: Table = metadata.get_by_name(Table, f"{prefix}.orders_indexed")
    plain: Table = metadata.get_by_name(Table, f"{prefix}.orders_plain")

    assert indexed.tableType == TableType.MaterializedView
    assert plain.tableType == TableType.View
