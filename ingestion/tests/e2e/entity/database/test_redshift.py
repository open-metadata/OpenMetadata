"""Test default database ingestion (Redshift)."""


import pytest
from playwright.sync_api import Page

from ingestion.tests.e2e.configs.connectors.model import (
    ConnectorIngestionTestConfig,
    ConnectorTestConfig,
    ConnectorValidationTestConfig,
    IngestionFilterConfig,
    IngestionTestConfig,
    ValidationTestConfig,
)
from ingestion.tests.e2e.configs.connectors.redshift import RedshiftConnector
from ingestion.tests.e2e.entity.database.common_assertions import (
    assert_change_database_owner,
    assert_pii_column_auto_tagging,
    assert_profile_data,
    assert_sample_data_ingestion,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
)


@pytest.mark.parametrize(
    "setUpClass",
    [
        {
            "connector_obj": RedshiftConnector(
                ConnectorTestConfig(
                    ingestion=ConnectorIngestionTestConfig(
                        metadata=IngestionTestConfig(
                            schema_=IngestionFilterConfig(includes=["dbt_jaffle"]),
                        ),  # type: ignore
                        profiler=IngestionTestConfig(
                            table=IngestionFilterConfig(includes=["customers"]),
                        ),  # type: ignore
                    ),
                    validation=ConnectorValidationTestConfig(
                        profiler=ValidationTestConfig(
                            database="dev", schema_="dbt_jaffle", table="customers"
                        )  # type: ignore
                    ),
                )
            )
        }
    ],
    indirect=True,
)
@pytest.mark.usefixtures("setUpClass")
class TestRedshiftConnector:
    """Redshift connector test case"""

    def test_pipelines_statuses(self):
        """check ingestion pipelines ran successfully"""
        assert self.metadata_ingestion_status == PipelineState.success
        # if the connector does not support profiler ingestion return None as status
        assert self.profiler_ingestion_status in {PipelineState.success, None}

    @pytest.mark.dependency(depends=["test_pipelines_statuses"])
    def test_change_database_owner(self, admin_page_context: Page):
        """test change database owner"""
        assert_change_database_owner(admin_page_context, self.service_name)

    @pytest.mark.dependency(depends=["test_pipelines_statuses"])
    def test_check_profile_data(self, admin_page_context: Page):
        """check profile data are visible"""
        assert_profile_data(
            admin_page_context,
            self.service_name,
            self.connector_obj.validation_config.profiler.database,
            self.connector_obj.validation_config.profiler.schema_,
            self.connector_obj.validation_config.profiler.table,
            self.connector_obj,
        )

    @pytest.mark.dependency(depends=["test_pipelines_statuses"])
    def test_sample_data_ingestion(self, admin_page_context: Page):
        """test sample dta is ingested as expected for the table"""
        assert_sample_data_ingestion(
            admin_page_context,
            self.service_name,
            self.connector_obj.validation_config.profiler.database,
            self.connector_obj.validation_config.profiler.schema_,
            self.connector_obj.validation_config.profiler.table,
        )

    @pytest.mark.dependency(depends=["test_pipelines_statuses"])
    def test_pii_colum_auto_tagging(self, admin_page_context: Page):
        """check pii column auto tagging tagged as expected"""
        assert_pii_column_auto_tagging(
            admin_page_context,
            self.service_name,
            self.connector_obj.validation_config.profiler.database,
            self.connector_obj.validation_config.profiler.schema_,
            self.connector_obj.validation_config.profiler.table,
            "first_name",
        )
