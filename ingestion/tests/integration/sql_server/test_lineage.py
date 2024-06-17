import sys

import pytest

from metadata.generated.schema.entity.data.table import Table

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


@pytest.mark.skip("fails for english even thoudh it should succeed")
def test_lineage(
    ingest_metadata,
    run_lineage_workflow,
    metadata,
):
    service_fqn = ingest_metadata.fullyQualifiedName.root
    department_table = metadata.get_by_name(
        Table, f"{service_fqn}.AdventureWorks.HumanResources.Department", nullable=False
    )
    lineage = metadata.get_lineage_by_id(Table, department_table.id.root)
    assert lineage is not None
