"""Test Hive database ingestion."""

import pytest
from playwright.sync_api import Page

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import PipelineState
from ingestion.tests.e2e.configs.connectors.model import ConnectorTestConfig, ConnectorValidationTestConfig, IngestionTestConfig, ConnectorIngestionTestConfig, IngestionFilterConfig, ValidationTestConfig
from ingestion.tests.e2e.configs.connectors.db2 import Db2Connector
from ingestion.tests.e2e.entity.database.common_assertions import assert_change_database_owner, assert_profile_data, assert_sample_data_ingestion


@pytest.mark.parametrize(
    "setUpClass",
    [{"connector_obj":Db2Connector(
        ConnectorTestConfig(
            ingestion=ConnectorIngestionTestConfig(
                metadata=IngestionTestConfig(
                    database=IngestionFilterConfig(
                        includes=["testdb"]
                    ),
                ), # type: ignore
            ),
            validation=ConnectorValidationTestConfig(
                profiler=ValidationTestConfig(
                    database="testdb",
                    schema_="sampledata",
                    table="customer"
                ) # type: ignore
            )
        )
    )}],
    indirect=True
)
@pytest.mark.usefixtures("setUpClass")
class TestHiveConnector:
    """We need to validate dependency can be installed in the test env."""