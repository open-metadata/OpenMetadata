from metadata.generated.schema.entity.data.table import Table

from ingestion.tests.unit.lineage.e2e.helpers import assert_lineage


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
