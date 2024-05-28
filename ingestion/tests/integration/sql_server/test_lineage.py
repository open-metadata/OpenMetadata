import sys

import pytest

from metadata.generated.schema.entity.data.table import Table

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


def test_lineage(
    ingest_metadata,
    run_lineage_workflow,
    metadata,
):
    service_fqn = ingest_metadata.fullyQualifiedName.__root__
    department_table = metadata.get_by_name(
        Table, f"{service_fqn}.AdventureWorks.HumanResources.Department", nullable=False
    )
    lineage = metadata.get_lineage_by_id(Table, department_table.id.__root__)
    assert lineage is not None
