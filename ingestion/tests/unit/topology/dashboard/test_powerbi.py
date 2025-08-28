import uuid
from unittest import TestCase
from unittest.mock import patch

import pytest

from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.powerbi.metadata import PowerbiSource
from metadata.ingestion.source.dashboard.powerbi.models import (
    Dataflow,
    Dataset,
    PowerBIDashboard,
    PowerBiTable,
    PowerBITableSource,
    UpstreaDataflow,
)
from metadata.utils import fqn

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
        "sourceConfig": {
            "config": {
                "type": "DashboardMetadata",
                "includeOwners": True,
            }
        },
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

MOCK_DASHBOARD_WITH_OWNERS = {
    "id": "dashboard1",
    "displayName": "Test Dashboard",
    "webUrl": "https://test.com",
    "embedUrl": "https://test.com/embed",
    "tiles": [],
    "users": [
        {
            "displayName": "John Doe",
            "emailAddress": "john.doe@example.com",
            "dashboardUserAccessRight": "Owner",
            "userType": "Member",
        },
        {
            "displayName": "Jane Smith",
            "emailAddress": "jane.smith@example.com",
            "dashboardUserAccessRight": "Owner",
            "userType": "Member",
        },
    ],
}

MOCK_DATASET_WITH_OWNERS = {
    "id": "dataset1",
    "name": "Test Dataset",
    "tables": [],
    "description": "Test dataset description",
    "users": [
        {
            "displayName": "John Doe",
            "emailAddress": "john.doe@example.com",
            "datasetUserAccessRight": "Owner",
            "userType": "Member",
        }
    ],
}

MOCK_USER_1_ENITYTY_REF_LIST = EntityReferenceList(
    root=[EntityReference(id=uuid.uuid4(), name="John Doe", type="user")]
)
MOCK_USER_2_ENITYTY_REF_LIST = EntityReferenceList(
    root=[EntityReference(id=uuid.uuid4(), name="Jane Smith", type="user")]
)

MOCK_SNOWFLAKE_EXP_V2 = 'let\n    Source = Snowflake.Databases(Snowflake_URL,Warehouse,[Role=Role]),\n    Database = Source{[Name=DB,Kind="Database"]}[Data],\n    DB_Schema = Database{[Name=Schema,Kind="Schema"]}[Data],\n    Table = DB_Schema{[Name="CUSTOMER_TABLE",Kind="Table"]}[Data],\n    #"Andere entfernte Spalten" = Table.SelectColumns(Table,{"ID_BERICHTSMONAT", "ID_AKQUISE_VERMITTLER", "ID_AKQUISE_OE", "ID_SPARTE", "ID_RISIKOTRAEGER", "ID_KUNDE", "STUECK", "BBE"})\nin\n    #"Andere entfernte Spalten"'
EXPECTED_SNOWFLAKE_RESULT_V2 = {
    "database": "MY_DB",
    "schema": "MY_SCHEMA",
    "table": "CUSTOMER_TABLE",
}
MOCK_DATASET_FROM_WORKSPACE = Dataset(
    id="testdataset",
    name="Test Dataset",
    tables=[],
    expressions=[
        {
            "name": "DB",
            "expression": '"MY_DB" meta [IsParameterQuery=true, List={"MY_DB_DEV", "MY_DB", "MY_DB_PROD"}, DefaultValue="MY_DB", Type="Text", IsParameterQueryRequired=true]',
        },
        {
            "name": "Schema",
            "expression": '"MY_SCHEMA" meta [IsParameterQuery=true, List={"MY_SCHEMA", "MY_SCHEMA_PROD"}, DefaultValue="MY_SCHEMA", Type="Text", IsParameterQueryRequired=true]',
        },
    ],
)
MOCK_DATASET_FROM_WORKSPACE_V2 = Dataset(
    id="testdataset",
    name="Test Dataset",
    tables=[],
    expressions=[
        {
            "name": "DB",
        },
        {
            "name": "Schema",
        },
    ],
)
MOCK_DASHBOARD_DATA_MODEL = DashboardDataModel(
    name="dummy_datamodel",
    id=uuid.uuid4(),
    columns=[],
    dataModelType=DataModelType.PowerBIDataModel.value,
)
MOCK_DATAMODEL_ENTITY = DashboardDataModel(
    name="dummy_dataflow_id_a",
    id=uuid.uuid4(),
    dataModelType=DataModelType.PowerBIDataFlow.value,
    columns=[],
)


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
    @patch.object(
        PowerbiSource,
        "_fetch_dataset_from_workspace",
        return_value=MOCK_DATASET_FROM_WORKSPACE,
    )
    def test_parse_database_source(self, *_):
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
        result = self.powerbi._parse_snowflake_source(
            MOCK_SNOWFLAKE_EXP, MOCK_DASHBOARD_DATA_MODEL
        )
        self.assertEqual(result, EXPECTED_SNOWFLAKE_RESULT)

        # Test with invalid snowflake source
        result = self.powerbi._parse_snowflake_source(
            MOCK_SNOWFLAKE_EXP_INVALID, MOCK_DASHBOARD_DATA_MODEL
        )
        self.assertEqual(result, None)

        result = self.powerbi._parse_snowflake_source(
            MOCK_SNOWFLAKE_EXP_V2, MOCK_DASHBOARD_DATA_MODEL
        )
        self.assertEqual(result, EXPECTED_SNOWFLAKE_RESULT_V2)

    @pytest.mark.order(2)
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.get_reference_by_email")
    def test_owner_ingestion(self, get_reference_by_email):
        # Mock responses for dashboard owners
        self.powerbi.metadata.get_reference_by_email.side_effect = [
            MOCK_USER_1_ENITYTY_REF_LIST,
            MOCK_USER_2_ENITYTY_REF_LIST,
        ]
        # Test dashboard owner ingestion
        dashboard = PowerBIDashboard.model_validate(MOCK_DASHBOARD_WITH_OWNERS)
        owner_ref = self.powerbi.get_owner_ref(dashboard)
        self.assertIsNotNone(owner_ref)
        self.assertEqual(len(owner_ref.root), 2)
        self.assertEqual(owner_ref.root[0].name, "John Doe")
        self.assertEqual(owner_ref.root[1].name, "Jane Smith")

        # Verify get_reference_by_email was called with correct emails
        self.powerbi.metadata.get_reference_by_email.assert_any_call(
            "john.doe@example.com"
        )
        self.powerbi.metadata.get_reference_by_email.assert_any_call(
            "jane.smith@example.com"
        )

        # Reset mock for dataset test
        self.powerbi.metadata.get_reference_by_email.reset_mock()
        self.powerbi.metadata.get_reference_by_email.side_effect = [
            MOCK_USER_1_ENITYTY_REF_LIST
        ]

        # Test dataset owner ingestion
        dataset = Dataset.model_validate(MOCK_DATASET_WITH_OWNERS)
        owner_ref = self.powerbi.get_owner_ref(dataset)
        self.assertIsNotNone(owner_ref.root)
        self.assertEqual(len(owner_ref.root), 1)
        self.assertEqual(owner_ref.root[0].name, "John Doe")

        # Verify get_reference_by_email was called with correct email
        self.powerbi.metadata.get_reference_by_email.assert_called_once_with(
            "john.doe@example.com"
        )

        # Reset mock for no owners test
        self.powerbi.metadata.get_reference_by_email.reset_mock()

        # Test with no owners
        dashboard_no_owners = PowerBIDashboard.model_validate(
            {
                "id": "dashboard2",
                "displayName": "Test Dashboard 2",
                "webUrl": "https://test.com",
                "embedUrl": "https://test.com/embed",
                "tiles": [],
                "users": [],
            }
        )
        owner_ref = self.powerbi.get_owner_ref(dashboard_no_owners)
        self.assertIsNone(owner_ref)

        # Verify get_reference_by_email was not called when there are no owners
        self.powerbi.metadata.get_reference_by_email.assert_not_called()

        # Reset mock for invalid owners test
        self.powerbi.metadata.get_reference_by_email.reset_mock()
        # Test with invalid owners
        dashboard_invalid_owners = PowerBIDashboard.model_validate(
            {
                "id": "dashboard3",
                "displayName": "Test Dashboard 3",
                "webUrl": "https://test.com",
                "embedUrl": "https://test.com/embed",
                "tiles": [],
                "users": [
                    {
                        "displayName": "Kane Williams",
                        "emailAddress": "kane.williams@example.com",
                        "dashboardUserAccessRight": "Read",
                        "userType": "Member",
                    },
                ],
            }
        )
        owner_ref = self.powerbi.get_owner_ref(dashboard_invalid_owners)
        self.assertIsNone(owner_ref)

        # Verify get_reference_by_email was not called when there are no owners
        self.powerbi.metadata.get_reference_by_email.assert_not_called()

    @pytest.mark.order(3)
    def test_parse_table_info_from_source_exp(self):
        table = PowerBiTable(
            name="test_table",
            source=[PowerBITableSource(expression=MOCK_REDSHIFT_EXP)],
        )
        result = self.powerbi._parse_table_info_from_source_exp(
            table, MOCK_DASHBOARD_DATA_MODEL
        )
        self.assertEqual(result, EXPECTED_REDSHIFT_RESULT)

        # no source expression
        table = PowerBiTable(
            name="test_table",
            source=[PowerBITableSource(expression=None)],
        )
        result = self.powerbi._parse_table_info_from_source_exp(
            table, MOCK_DASHBOARD_DATA_MODEL
        )
        self.assertEqual(result, {})

        # no source
        table = PowerBiTable(
            name="test_table",
            source=[],
        )
        result = self.powerbi._parse_table_info_from_source_exp(
            table, MOCK_DASHBOARD_DATA_MODEL
        )
        self.assertEqual(result, {})

    @pytest.mark.order(4)
    @patch.object(
        PowerbiSource,
        "_fetch_dataset_from_workspace",
        return_value=MOCK_DATASET_FROM_WORKSPACE_V2,
    )
    def test_parse_dataset_expressions(self, *_):
        # test with valid snowflake source but no
        # dataset expression value
        result = self.powerbi._parse_snowflake_source(
            MOCK_SNOWFLAKE_EXP_V2, MOCK_DASHBOARD_DATA_MODEL
        )
        self.assertIsNone(result["database"])
        self.assertIsNone(result["schema"])
        self.assertEqual(result["table"], "CUSTOMER_TABLE")

    @pytest.mark.order(5)
    @patch.object(OpenMetadata, "get_by_name", return_value=MOCK_DATAMODEL_ENTITY)
    @patch.object(fqn, "build", return_value=None)
    def test_upstream_dataflow_lineage(self, *_):
        MOCK_DATAMODEL_ENTITY_2 = DashboardDataModel(
            name="dummy_dataflow_id_b",
            id=uuid.uuid4(),
            dataModelType=DataModelType.PowerBIDataFlow.value,
            columns=[],
        )
        MOCK_DATAMODEL_2 = Dataflow(
            name="dataflow_b",
            objectId="dummy_dataflow_id_b",
            upstreamDataflows=[
                UpstreaDataflow(
                    targetDataflowId="dataflow_a",
                )
            ],
        )
        lineage_request = list(
            self.powerbi.create_dataflow_upstream_dataflow_lineage(
                MOCK_DATAMODEL_2, MOCK_DATAMODEL_ENTITY_2
            )
        )
        assert lineage_request[0].right is not None

    @pytest.mark.order(6)
    def test_include_owners_flag_enabled(self):
        """
        Test that when includeOwners is True, owner information is processed
        """
        # Mock the source config to have includeOwners = True
        self.powerbi.source_config.includeOwners = True

        # Test that owner information is processed when includeOwners is True
        self.assertTrue(self.powerbi.source_config.includeOwners)

        # Test with a dashboard that has owners
        dashboard_with_owners = PowerBIDashboard.model_validate(
            MOCK_DASHBOARD_WITH_OWNERS
        )

        # Mock the metadata.get_reference_by_email method to return different users for different emails
        with patch.object(
            self.powerbi.metadata, "get_reference_by_email"
        ) as mock_get_ref:

            def mock_get_ref_by_email(email):
                if email == "john.doe@example.com":
                    return EntityReferenceList(
                        root=[
                            EntityReference(
                                id=uuid.uuid4(), name="John Doe", type="user"
                            )
                        ]
                    )
                elif email == "jane.smith@example.com":
                    return EntityReferenceList(
                        root=[
                            EntityReference(
                                id=uuid.uuid4(), name="Jane Smith", type="user"
                            )
                        ]
                    )
                return EntityReferenceList(root=[])

            mock_get_ref.side_effect = mock_get_ref_by_email

            # Test get_owner_ref with includeOwners = True
            result = self.powerbi.get_owner_ref(dashboard_with_owners)

            # Should return owner reference when includeOwners is True
            self.assertIsNotNone(result)
            self.assertEqual(len(result.root), 2)
            # Check that both owners are present
            owner_names = [owner.name for owner in result.root]
            self.assertIn("John Doe", owner_names)
            self.assertIn("Jane Smith", owner_names)

    @pytest.mark.order(7)
    def test_include_owners_flag_disabled(self):
        """
        Test that when includeOwners is False, owner information is not processed
        """
        # Mock the source config to have includeOwners = False
        self.powerbi.source_config.includeOwners = False

        # Test that owner information is not processed when includeOwners is False
        self.assertFalse(self.powerbi.source_config.includeOwners)

        # Test with a dashboard that has owners
        dashboard_with_owners = PowerBIDashboard.model_validate(
            MOCK_DASHBOARD_WITH_OWNERS
        )

        # Test get_owner_ref with includeOwners = False
        result = self.powerbi.get_owner_ref(dashboard_with_owners)

        # Should return None when includeOwners is False
        self.assertIsNone(result)

    @pytest.mark.order(8)
    def test_include_owners_flag_in_config(self):
        """
        Test that the includeOwners flag is properly set in the configuration
        """
        # Check that the mock configuration includes the includeOwners flag
        config = mock_config["source"]["sourceConfig"]["config"]
        self.assertIn("includeOwners", config)
        self.assertTrue(config["includeOwners"])

    @pytest.mark.order(9)
    def test_include_owners_flag_with_no_owners(self):
        """
        Test that when includeOwners is True but dashboard has no owners, returns None
        """
        # Mock the source config to have includeOwners = True
        self.powerbi.source_config.includeOwners = True

        # Create a dashboard with no owners
        dashboard_no_owners = PowerBIDashboard.model_validate(
            {
                "id": "dashboard_no_owners",
                "displayName": "Test Dashboard No Owners",
                "webUrl": "https://test.com",
                "embedUrl": "https://test.com/embed",
                "tiles": [],
                "users": [],  # No users/owners
            }
        )

        # Test get_owner_ref with no owners
        result = self.powerbi.get_owner_ref(dashboard_no_owners)

        # Should return None when there are no owners
        self.assertIsNone(result)

    @pytest.mark.order(10)
    def test_include_owners_flag_with_exception(self):
        """
        Test that when includeOwners is True but an exception occurs, it's handled gracefully
        """
        # Mock the source config to have includeOwners = True
        self.powerbi.source_config.includeOwners = True

        # Test with a dashboard that has owners
        dashboard_with_owners = PowerBIDashboard.model_validate(
            MOCK_DASHBOARD_WITH_OWNERS
        )

        # Mock the metadata.get_reference_by_email method to raise an exception
        with patch.object(
            self.powerbi.metadata,
            "get_reference_by_email",
            side_effect=Exception("API Error"),
        ):
            # Test get_owner_ref with exception
            result = self.powerbi.get_owner_ref(dashboard_with_owners)

            # Should return None when exception occurs
            self.assertIsNone(result)
