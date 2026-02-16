import pytest

from ingestion.tests.integration.lineage.e2e.helpers import assert_lineage
from metadata.generated.schema.entity.data.table import Table


@pytest.mark.flaky(reruns=3)
@pytest.mark.xfail(
    strict=False,
    reason="This test is flaky due to the non-deterministic order of lineage edges, which can lead to assertion failures. A fix is needed to ensure consistent edge ordering in lineage results.",
)
def test_join_result_table_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `join_result_table`.
    """
    table_fqn = f"{oracle_lineage_service_name}.default.test.JOIN_RESULT_TABLE"
    lineage = metadata.get_lineage_by_name(Table, table_fqn)

    assert_lineage(
        lineage,
        {"BASE_TABLE", "SOURCE_TABLE_1", "SOURCE_TABLE_2", "TARGET_TABLE_1"},
        set(),
        None,
    )


@pytest.mark.flaky(reruns=3)
@pytest.mark.xfail(
    strict=False,
    reason="This test is flaky due to the non-deterministic order of lineage edges, which can lead to assertion failures. A fix is needed to ensure consistent edge ordering in lineage results.",
)
def test_union_result_table_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `union_result_table`.
    """
    table_fqn = f"{oracle_lineage_service_name}.default.test.UNION_RESULT_TABLE"
    lineage = metadata.get_lineage_by_name(Table, table_fqn)

    assert_lineage(
        lineage,
        {"SOURCE_TABLE_1", "SOURCE_TABLE_2", "TARGET_TABLE_1"},
        set(),
        None,
    )


@pytest.mark.flaky(reruns=3)
@pytest.mark.xfail(
    strict=False,
    reason="This test is flaky due to the non-deterministic order of lineage edges, which can lead to assertion failures. A fix is needed to ensure consistent edge ordering in lineage results.",
)
def test_agg_join_result_table_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `agg_join_result_table`.
    """
    table_fqn = f"{oracle_lineage_service_name}.default.test.AGG_JOIN_RESULT_TABLE"
    lineage = metadata.get_lineage_by_name(Table, table_fqn)

    assert_lineage(
        lineage,
        {"view_1", "view_2", "view_3", "BASE_TABLE"},
        set(),
        None,
    )


@pytest.mark.flaky(reruns=3)
@pytest.mark.xfail(
    strict=False,
    reason="This test is flaky due to the non-deterministic order of lineage edges, which can lead to assertion failures. A fix is needed to ensure consistent edge ordering in lineage results.",
)
def test_merge_target_table_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `merge_target_table`.
    """
    table_fqn = f"{oracle_lineage_service_name}.default.test.MERGE_TARGET_TABLE"
    lineage = metadata.get_lineage_by_name(Table, table_fqn)

    assert_lineage(
        lineage,
        {"SOURCE_TABLE_4", "SOURCE_TABLE_5"},
        set(),
        None,
    )


@pytest.mark.flaky(reruns=3)
@pytest.mark.xfail(
    strict=False,
    reason="This test is flaky due to the non-deterministic order of lineage edges, which can lead to assertion failures. A fix is needed to ensure consistent edge ordering in lineage results.",
)
def test_update_target_table_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `update_target_table`.
    """
    table_fqn = f"{oracle_lineage_service_name}.default.test.UPDATE_TARGET_TABLE"
    lineage = metadata.get_lineage_by_name(Table, table_fqn)

    assert_lineage(
        lineage,
        {
            "view_3",
            "BASE_TABLE",
            # TODO: validate if "SOURCE_TABLE_6" should be included in lineage or not
            # as it is referenced in where condition only
            # However, it doesn't contribute to data at target table
            # "SOURCE_TABLE_6",
        },
        set(),
        None,
    )


@pytest.mark.flaky(reruns=3)
@pytest.mark.xfail(
    strict=False,
    reason="This test is flaky due to the non-deterministic order of lineage edges, which can lead to assertion failures. A fix is needed to ensure consistent edge ordering in lineage results.",
)
def test_complex_join_table_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `complex_join_table`.
    """
    table_fqn = f"{oracle_lineage_service_name}.default.test.COMPLEX_JOIN_TABLE"
    lineage = metadata.get_lineage_by_name(Table, table_fqn)

    assert_lineage(
        lineage,
        {"BASE_TABLE", "SOURCE_TABLE_1", "SOURCE_TABLE_2", "SOURCE_TABLE_6", "view_4"},
        set(),
        None,
    )


@pytest.mark.flaky(reruns=3)
@pytest.mark.xfail(
    strict=False,
    reason="This test is flaky due to the non-deterministic order of lineage edges, which can lead to assertion failures. A fix is needed to ensure consistent edge ordering in lineage results.",
)
def test_interim_target_table_temp_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check temp table lineage: interim_target_table_1 should have lineage from source_table_1
    even though interim_table_1 (intermediate) was deleted.
    This test validates enableTempTableLineage functionality.
    """
    table_fqn = f"{oracle_lineage_service_name}.default.test.INTERIM_TARGET_TABLE_1"
    lineage = metadata.get_lineage_by_name(Table, table_fqn)

    assert_lineage(
        lineage,
        {"SOURCE_TABLE_1"},  # Should show source even though interim_table_1 is deleted
        set(),
        None,
    )


def test_interim_target_view_temp_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    interim_target_view_1 is expected to not have lineage from interim_table_1 as it is deleted.
    also since enableTempTableLineage doesn't affect views, it will also not have lineage from
    source_table_1 (source of interim_table_1).
    """
    table_fqn = f"{oracle_lineage_service_name}.default.test.interim_target_view_1"
    lineage = metadata.get_lineage_by_name(Table, table_fqn)

    assert_lineage(
        lineage,
        set(),
        set(),
        None,
    )
