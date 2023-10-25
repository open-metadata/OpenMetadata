"""Test Db2 database ingestion."""

import pytest

from ingestion.tests.e2e.configs.connectors.database.db2 import Db2Connector
from ingestion.tests.e2e.configs.connectors.model import (
    ConnectorIngestionTestConfig,
    ConnectorTestConfig,
    ConnectorValidationTestConfig,
    IngestionFilterConfig,
    IngestionTestConfig,
    ValidationTestConfig,
)


@pytest.mark.parametrize(
    "setUpClass",
    [
        {
            "connector_obj": Db2Connector(
                ConnectorTestConfig(
                    ingestion=ConnectorIngestionTestConfig(
                        metadata=IngestionTestConfig(
                            database=IngestionFilterConfig(includes=["testdb"]),
                        ),  # type: ignore
                    ),
                    validation=ConnectorValidationTestConfig(
                        profiler=ValidationTestConfig(
                            database="testdb", schema_="sampledata", table="customer"
                        )  # type: ignore
                    ),
                )
            )
        }
    ],
    indirect=True,
)
@pytest.mark.usefixtures("setUpClass")
class TestDb2Connector:
    """We need to validate dependency can be installed in the test env."""
