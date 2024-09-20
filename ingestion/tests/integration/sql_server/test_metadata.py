import sys

import pytest

from metadata.generated.schema.entity.data.table import Constraint, Table
from metadata.workflow.metadata import MetadataWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


def test_ingest_metadata(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    db_service,
    metadata,
    db_name,
):
    run_workflow(MetadataWorkflow, ingestion_config)
    table: Table = metadata.get_by_name(
        Table,
        f"{db_service.fullyQualifiedName.root}.{db_name}.SalesLT.Customer",
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
