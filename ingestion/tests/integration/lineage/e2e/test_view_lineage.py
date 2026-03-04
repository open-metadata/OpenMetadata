import pytest

from ingestion.tests.integration.lineage.e2e.helpers import assert_lineage
from metadata.generated.schema.entity.data.table import Table


@pytest.mark.flaky(reruns=3)
def test_view_1_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `view_1`.
    """
    table_fqn = f"{oracle_lineage_service_name}.default.test.view_1"
    lineage = metadata.get_lineage_by_name(Table, table_fqn)

    assert_lineage(lineage, {"BASE_TABLE"}, None, None)


@pytest.mark.flaky(reruns=3)
def test_view_2_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `view_2`.
    """
    table_fqn = f"{oracle_lineage_service_name}.default.test.view_2"
    lineage = metadata.get_lineage_by_name(Table, table_fqn)

    assert_lineage(lineage, {"view_1"}, None, None)


@pytest.mark.flaky(reruns=3)
def test_view_3_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `view_3`.
    """
    table_fqn = f"{oracle_lineage_service_name}.default.test.view_3"
    lineage = metadata.get_lineage_by_name(Table, table_fqn)

    assert_lineage(lineage, {"SOURCE_TABLE_1", "SOURCE_TABLE_2"}, None, None)


@pytest.mark.flaky(reruns=3)
def test_view_4_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `view_4`.
    """
    table_fqn = f"{oracle_lineage_service_name}.default.test.view_4"
    lineage = metadata.get_lineage_by_name(Table, table_fqn)

    assert_lineage(lineage, {"view_3"}, None, None)
