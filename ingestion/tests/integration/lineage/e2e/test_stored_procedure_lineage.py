from ingestion.tests.integration.lineage.e2e.helpers import assert_lineage
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure

# Note: Query history has very uncertain behavior on query execution time
# making it very hard to test stored procedure lineage reliably.
# Hence, these tests are currently disabled and can be enabled once we have
# a more reliable way to test stored procedure lineage from Oracle.


def x_test_stored_proc_1_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `stored_proc_1`.
    """
    stored_proc_fqn = f"{oracle_lineage_service_name}.default.test.STORED_PROC_1"
    lineage = metadata.get_lineage_by_name(StoredProcedure, stored_proc_fqn)

    assert_lineage(lineage, {"SOURCE_TABLE_1"}, {"TARGET_TABLE_1"}, None)


def x_test_stored_proc_2_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `stored_proc_2`.
    """
    stored_proc_fqn = f"{oracle_lineage_service_name}.default.test.STORED_PROC_2"
    lineage = metadata.get_lineage_by_name(StoredProcedure, stored_proc_fqn)

    assert_lineage(lineage, {"SOURCE_TABLE_2"}, {"TARGET_TABLE_2"}, None)


def x_test_stored_proc_3_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `stored_proc_3`.
    """
    stored_proc_fqn = f"{oracle_lineage_service_name}.default.test.STORED_PROC_3"
    lineage = metadata.get_lineage_by_name(StoredProcedure, stored_proc_fqn)

    assert_lineage(lineage, {"SOURCE_TABLE_3"}, {"TARGET_TABLE_3"}, None)


def x_test_stored_proc_4_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `stored_proc_4`.
    """
    stored_proc_fqn = f"{oracle_lineage_service_name}.default.test.STORED_PROC_4"
    lineage = metadata.get_lineage_by_name(StoredProcedure, stored_proc_fqn)

    assert_lineage(lineage, {"SOURCE_TABLE_4"}, {"TARGET_TABLE_4"}, None)


def x_test_stored_proc_5_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `stored_proc_5`.
    """
    stored_proc_fqn = f"{oracle_lineage_service_name}.default.test.STORED_PROC_5"
    lineage = metadata.get_lineage_by_name(StoredProcedure, stored_proc_fqn)

    assert_lineage(lineage, {"SOURCE_TABLE_5"}, {"TARGET_TABLE_5"}, None)


def x_test_stored_proc_6_lineage(
    oracle_lineage_container,
    oracle_lineage_ingestion,
    metadata,
    oracle_lineage_service_name,
):
    """
    Check lineages of `stored_proc_6`.
    """
    stored_proc_fqn = f"{oracle_lineage_service_name}.default.test.STORED_PROC_6"
    lineage = metadata.get_lineage_by_name(StoredProcedure, stored_proc_fqn)

    assert_lineage(lineage, {"SOURCE_TABLE_6"}, {"TARGET_TABLE_6"}, None)
