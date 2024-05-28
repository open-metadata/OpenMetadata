import sys

import pytest
from metadata.generated.schema.entity.data.table import Constraint, Table

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


def test_pass(
    ingest_metadata,
    metadata,
):
    table: Table = metadata.get_by_name(
        Table,
        f"{ingest_metadata.fullyQualifiedName.__root__}.AdventureWorks.HumanResources.Department",
    )
    assert table is not None
    assert table.columns[0].name.__root__ == "DepartmentID"
    assert table.columns[0].constraint == Constraint.PRIMARY_KEY
    assert table.columns[1].name.__root__ == "Name"
    assert table.columns[2].name.__root__ == "GroupName"
    assert table.columns[3].name.__root__ == "ModifiedDate"
