"""Module fixture for data quality e2e tests"""


import pytest

from ingestion.tests.e2e.configs.connectors.redshift import RedshiftConnector

BASE_URL = "http://localhost:8585"


@pytest.fixture(scope="session")
def redshift_connector():
    """Create a redshift connector"""
    redshift = RedshiftConnector(["dbt_jaffle"], ["customers"])
    yield redshift
