from unittest import TestCase
from unittest.mock import patch

import pytest

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.powerbi.metadata import PowerbiSource

MOCK_REDSHIFT_EXP = """
let
Source = AmazonRedshift.Database("redsshift-cluster.redshift.amazonaws.com:5439","dev"),
demo_dbt_jaffle = Source{[Name="demo_dbt_jaffle"]}[Data],
customers_clean1 = demo_dbt_jaffle{[Name="customers_clean"]}[Data]
in
customers_clean1
"""

MOCK_REDSHIFT_EXP_INVALID = """
let
Source = Database("redsshift-cluster.redshift.amazonaws.com:5439","dev"),
demo_dbt_jaffle = Source{[Name="demo_dbt_jaffle"]}[Data],
customers_clean1 = demo_dbt_jaffle{[Name="customers_clean"]}[Data]
in
customers_clean1
"""

MOCK_REDSHIFT_EXP_INVALID_V2 = """
let
Source = AmazonRedshift.Database("redsshift-cluster.redshift.amazonaws.com:5439","dev"),
customers_clean1 = demo_dbt_jaffle{[Name="customers_clean"]}[Data]
in
customers_clean1
"""

EXPECTED_REDSHIFT_RESULT = {
    "database": "dev",
    "schema": "demo_dbt_jaffle",
    "table": "customers_clean",
}


MOCK_SNOWFLAKE_EXP = """let
    Source = Snowflake.Databases("abcd-123.snowflakecomputing.com","COMPUTE_WH"),
    DEMO_STAGE_Database = Source{[Name="DEMO_STAGE",Kind="Database"]}[Data],
    PUBLIC_Schema = DEMO_STAGE_Database{[Name="PUBLIC",Kind="Schema"]}[Data],
    STG_CUSTOMERS_View = PUBLIC_Schema{[Name="STG_CUSTOMERS",Kind="View"]}[Data]
in
    STG_CUSTOMERS_View"""

MOCK_SNOWFLAKE_EXP_INVALID = """let
    Source = Snowflake("abcd-123.snowflakecomputing.com","COMPUTE_WH"),
    DEMO_STAGE_Database = Source{[Name="DEMO_STAGE",Kind="Database"]}[Data],
in
    STG_CUSTOMERS_View"""

EXPECTED_SNOWFLAKE_RESULT = {
    "database": "DEMO_STAGE",
    "schema": "PUBLIC",
    "table": "STG_CUSTOMERS",
}

mock_config = {
    "source": {
        "type": "powerbi",
        "serviceName": "mock_metabase",
        "serviceConnection": {
            "config": {
                "type": "PowerBI",
                "clientId": "client_id",
                "clientSecret": "secret",
                "tenantId": "tenant_id",
            },
        },
        "sourceConfig": {"config": {"type": "DashboardMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        },
    },
}


class PowerBIUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    powerbi Dashboard Unit Test
    """

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.dashboard.powerbi.connection.get_connection")
    def __init__(self, methodName, get_connection, test_connection) -> None:
        super().__init__(methodName)
        get_connection.return_value = False
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_config)
        self.powerbi: PowerbiSource = PowerbiSource.create(
            mock_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )

    @pytest.mark.order(1)
    def test_parse_database_source(self):
        # Test with valid redshift source
        result = self.powerbi._parse_redshift_source(MOCK_REDSHIFT_EXP)
        self.assertEqual(result, EXPECTED_REDSHIFT_RESULT)

        # Test with invalid redshift source
        result = self.powerbi._parse_redshift_source(MOCK_REDSHIFT_EXP_INVALID)
        self.assertEqual(result, None)

        # Test with invalid redshift source
        result = self.powerbi._parse_redshift_source(MOCK_REDSHIFT_EXP_INVALID_V2)
        self.assertEqual(result, None)

        # Test with valid snowflake source
        result = self.powerbi._parse_snowflake_source(MOCK_SNOWFLAKE_EXP)
        self.assertEqual(result, EXPECTED_SNOWFLAKE_RESULT)

        # Test with invalid snowflake source
        result = self.powerbi._parse_snowflake_source(MOCK_SNOWFLAKE_EXP_INVALID)
        self.assertEqual(result, None)
