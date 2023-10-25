"""Test Hive database ingestion."""

import pytest
from playwright.sync_api import Page

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
)

from ...configs.connectors.database.hive import HiveConnector
from ...configs.connectors.model import (
    ConnectorIngestionTestConfig,
    ConnectorTestConfig,
    ConnectorValidationTestConfig,
    IngestionFilterConfig,
    IngestionTestConfig,
    ValidationTestConfig,
)
from ...entity.database.common_assertions import (
    assert_change_database_owner,
    assert_profile_data,
    assert_sample_data_ingestion,
)


@pytest.mark.parametrize(
    "setUpClass",
    [
        {
            "connector_obj": HiveConnector(
                ConnectorTestConfig(
                    ingestion=ConnectorIngestionTestConfig(
                        metadata=IngestionTestConfig(
                            database=IngestionFilterConfig(includes=["default"]),
                        ),  # type: ignore
                    ),
                    validation=ConnectorValidationTestConfig(
                        profiler=ValidationTestConfig(
                            database="default", schema_="default", table="t1"
                        )  # type: ignore
                    ),
                )
            )
        }
    ],
    indirect=True,
)
@pytest.mark.usefixtures("setUpClass")
class TestHiveConnector:
    """Hive connector test case"""

    def test_pipelines_statuses(self):
        """check ingestion pipelines ran successfully"""
        assert self.metadata_ingestion_status == PipelineState.success
        # if the connector does not support profiler ingestion return None as status
        assert self.profiler_ingestion_status in {PipelineState.success, None}

    def test_change_database_owner(self, admin_page_context: Page):
        """test change database owner"""
        assert_change_database_owner(admin_page_context, self.service_name)

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

    def test_sample_data_ingestion(self, admin_page_context: Page):
        """test sample dta is ingested as expected for the table"""
        assert_sample_data_ingestion(
            admin_page_context,
            self.service_name,
            self.connector_obj.validation_config.profiler.database,
            self.connector_obj.validation_config.profiler.schema_,
            self.connector_obj.validation_config.profiler.table,
        )
