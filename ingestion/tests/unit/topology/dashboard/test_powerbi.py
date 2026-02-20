import uuid
from unittest import TestCase
from unittest.mock import patch

import pytest

from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.powerbi.metadata import PowerbiSource
from metadata.ingestion.source.dashboard.powerbi.models import (
    Dataflow,
    DataflowEntity,
    DataflowEntityAttribute,
    DataflowExportResponse,
    Dataset,
    Datasource,
    DatasourceConnectionDetails,
    PowerBIDashboard,
    PowerBIReport,
    PowerBiTable,
    PowerBITableSource,
    ReportPage,
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

EXPECTED_REDSHIFT_RESULT = [
    {
        "database": "dev",
        "schema": "demo_dbt_jaffle",
        "table": "customers_clean",
    }
]


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

EXPECTED_SNOWFLAKE_RESULT = [
    {
        "database": "DEMO_STAGE",
        "schema": "PUBLIC",
        "table": "STG_CUSTOMERS",
    }
]

MOCK_DATABRICKS_EXP = """let
    Source = Databricks.Catalogs(Databricks_Server, Databricks_HTTP_Path, [Catalog = "", Database = ""]),
    test_database = Source{[Name="DEMO_STAGE",Kind="Database"]}[Data],
    test_schema = test_database{[Name="PUBLIC",Kind="Schema"]}[Data],
    test_table = test_schema{[Name="STG_CUSTOMERS",Kind="Table"]}[Data]
in 
    Source"""

MOCK_DATABRICKS_NATIVE_EXP = """let
    Source = Value.NativeQuery(Databricks.Catalogs(Databricks_Server, Databricks_HTTP_Path, [Catalog="DEMO_CATALOG", Database=null, EnableAutomaticProxyDiscovery=null]){[Name="DEMO_STAGE",Kind="Database"]}[Data], "PUBLIC.STG_CUSTOMERS", null, [EnableFolding=true])
in
    Source"""

MOCK_DATABRICKS_NATIVE_QUERY_EXP = """let 
    Source = Value.NativeQuery(Databricks.Catalogs(Databricks_Server, Databricks_HTTP_Path,  
        [Catalog="DEMO_CATALOG", Database=null, EnableAutomaticProxyDiscovery=null]) 
        {[Name="DEMO_STAGE",Kind="Database"]}[Data],  
            "select * from PUBLIC.STG_CUSTOMERS", null, [EnableFolding=true]) 
in 
    "Source" """

EXPECTED_DATABRICKS_RESULT = [
    {"database": "DEMO_STAGE", "schema": "PUBLIC", "table": "STG_CUSTOMERS"}
]

MOCK_DATABRICKS_NATIVE_QUERY_EXP_WITH_EXPRESSION = """let
    Source = Value.NativeQuery(Databricks.Catalogs(Databricks_Server, Databricks_HTTP_Path, [   Catalog=   "DEMO_CATALOG", Database=null, EnableAutomaticProxyDiscovery=null]){[Name=DB, Kind=   "Database"]}[Data], "SELECT * FROM PUBLIC.STG_CUSTOMERS", null, [EnableFolding=true])
in
    Source"""
EXPECTED_DATABRICKS_RESULT_WITH_EXPRESSION = [
    {"database": "MY_DB", "schema": "PUBLIC", "table": "STG_CUSTOMERS"}
]


MOCK_DATABRICKS_NATIVE_INVALID_QUERY_EXP = """let
    Source = Value.NativeQuery(Databricks.Catalogs(Databricks_Server, Databricks_HTTP_Path, [Catalog="DEMO_CATALOG", Database=null, EnableAutomaticProxyDiscovery=null]){[Name="DEMO_STAGE",Kind = "Database"]}[Data], "WITH test as (select) Select test", null, [EnableFolding=true])
in
    Source"""

MOCK_DATABRICKS_NATIVE_INVALID_EXP = """let
    Source = Value.NativeQuery(Databricks.Catalogs(Databricks_Server, Databricks_HTTP_Path, [Catalog="DEMO_CATALOG", Database=null, EnableAutomaticProxyDiscovery=null]){[Name="DEMO_STAGE",Kind=  "Database"]}[Data], null, [EnableFolding=true])
in
    Source"""

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
            "enableVersionValidation": "false",
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
MOCK_SNOWFLAKE_EXP_V3 = 'let\n    Source = Snowflake.Databases(Snowflake_URL,Warehouse,[Role=Role]),\n    Database = Source{[Name=P_Database_name,Kind="Database"]}[Data],\n    DB_Schema = Database{[Name=P_Schema_name,Kind="Schema"]}[Data],\n    Table = DB_Schema{[Name="CUSTOMER_TABLE",Kind="Table"]}[Data],\n    #"Andere entfernte Spalten" = Table.SelectColumns(Table,{"ID_BERICHTSMONAT", "ID_AKQUISE_VERMITTLER", "ID_AKQUISE_OE", "ID_SPARTE", "ID_RISIKOTRAEGER", "ID_KUNDE", "STUECK", "BBE"})\nin\n    #"Andere entfernte Spalten"'
EXPECTED_SNOWFLAKE_RESULT_V2 = [
    {
        "database": "MY_DB",
        "schema": "MY_SCHEMA",
        "table": "CUSTOMER_TABLE",
    }
]
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
MOCK_DATASET_FROM_WORKSPACE_V3 = Dataset(
    id="testdataset",
    name="Test Dataset",
    tables=[],
    expressions=[
        {
            "name": "P_Database_name",
            "description": "The parameter contains the name of the database",
            "expression": '"MANUFACTURING_BUSINESS_DATA_PRODUCTS" meta [IsParameterQuery=true, List={"DEVELOPMENT_BUSINESS_DATA_PRODUCTS", "MANUFACTURING_BUSINESS_DATA_PRODUCTS"}, DefaultValue="DEVELOPMENT_BUSINESS_DATA_PRODUCTS", Type="Text", IsParameterQueryRequired=true]',
        },
        {
            "name": "P_Schema_name",
            "description": "The parameter contains the schema name",
            "expression": '"INVENTORY_BY_PURPOSE" meta [IsParameterQuery=true, List={"MVANGENE_INVENTORY_BY_PURPOSE", "INVENTORY_BY_PURPOSE", "ANORRBRI_INVENTORY_BY_PURPOSE"}, DefaultValue="MVANGENE_INVENTORY_BY_PURPOSE", Type="Text", IsParameterQueryRequired=true]',
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

        test_snowflaek_query_expression = 'let\n    Source = Value.NativeQuery(Snowflake.Databases("dummy_host",(Warehouse)){[Name=(Database)]}[Data], "select * from "& Database &".""STG"".""STATIC_AOPANDLE""", null, [EnableFolding=true]),\n    #"Renamed Columns" = Table.RenameColumns(Source,{{"AOP_IMPRESSIONS", "AOP Impressions"}, {"AOP_ORDERS", "AOP Orders"}, {"AOP_SPEND", "AOP Spend"}, {"AOP_TOTAL_REV", "AOP Total Revenue"}, {"AOP_UNITS", "AOP Units"}, {"AOP_VISITS", "AOP Visits"}, {"LE_IMPRESSIONS", "LE Impressions"}, {"LE_ORDERS", "LE Orders"}, {"LE_SPEND", "LE Spend"}, {"LE_TOTAL_REV", "LE Total Revenue"}, {"LE_UNITS", "LE Units"}, {"LE_VISITS", "LE Visits"}, {"SITEID", "SiteID"}, {"COUNTRY", "Country"}, {"REGION", "Region"}, {"CHANNEL", "Channel"}, {"DATE", "Date"}, {"AOP_CONV", "AOP_Conv"}, {"LE_CONV", "LE_Conv"}}),\n    #"Changed Type" = Table.TransformColumnTypes(#"Renamed Columns",{{"SiteID", type text}, {"AOP Impressions", type number}, {"AOP Visits", type number}, {"AOP Orders", type number}, {"AOP Units", type number}, {"AOP Total Revenue", type number}, {"AOP Spend", type number}, {"AOP_Conv", type number}, {"AOP_UPT", type number}, {"AOP_ASP", type number}, {"AOP_AOV", type number}, {"AOP_CTR", type number}, {"LE Impressions", type number}, {"LE Visits", type number}, {"LE Orders", type number}, {"LE Units", type number}, {"LE Total Revenue", type number}, {"LE Spend", type number}, {"LE_Conv", type number}, {"LE_UPT", type number}, {"LE_ASP", type number}, {"LE_AOV", type number}, {"LE_CTR", type number}}),\n    #"Duplicated Column" = Table.DuplicateColumn(#"Changed Type", "Date", "Date - Copy"),\n    #"Split Column by Delimiter" = Table.SplitColumn(#"Duplicated Column", "Date - Copy", Splitter.SplitTextByDelimiter("-", QuoteStyle.None), {"Date - Copy.1", "Date - Copy.2", "Date - Copy.3"}),\n    #"Changed Type1" = Table.TransformColumnTypes(#"Split Column by Delimiter",{{"Date - Copy.1", type text}, {"Date - Copy.2", type text}, {"Date - Copy.3", type text}}),\n    #"Inserted Merged Column" = Table.AddColumn(#"Changed Type1", "Merged", each Text.Combine({[#"Date - Copy.1"], [#"Date - Copy.2"], [#"Date - Copy.3"]}, ""), type text),\n    #"Renamed Columns1" = Table.RenameColumns(#"Inserted Merged Column",{{"Merged", "DateKey"}}),\n    #"Removed Columns" = Table.RemoveColumns(#"Renamed Columns1",{"Date - Copy.1", "Date - Copy.2", "Date - Copy.3"}),\n    #"Added Custom" = Table.AddColumn(#"Removed Columns", "Brand", each "CROCS"),\n    #"Changed Type2" = Table.TransformColumnTypes(#"Added Custom",{{"Brand", type text}})\nin\n    #"Changed Type2"'
        result = self.powerbi._parse_snowflake_source(
            test_snowflaek_query_expression, MOCK_DASHBOARD_DATA_MODEL
        )
        # Test should parse the Snowflake query and extract table info
        self.assertIsNotNone(result)
        self.assertEqual(len(result), 1)
        result_table = result[0]
        self.assertEqual(result_table.get("schema"), "STG")
        self.assertEqual(result_table.get("table"), "STATIC_AOPANDLE")

        # Test with valid databricks native source
        result = self.powerbi._parse_databricks_source(
            MOCK_DATABRICKS_NATIVE_QUERY_EXP_WITH_EXPRESSION, MOCK_DASHBOARD_DATA_MODEL
        )
        self.assertEqual(result, EXPECTED_DATABRICKS_RESULT_WITH_EXPRESSION)

        result = self.powerbi._parse_databricks_source(
            MOCK_DATABRICKS_NATIVE_EXP, MOCK_DASHBOARD_DATA_MODEL
        )
        self.assertEqual(result, EXPECTED_DATABRICKS_RESULT)

        result = self.powerbi._parse_databricks_source(
            MOCK_DATABRICKS_NATIVE_QUERY_EXP, MOCK_DASHBOARD_DATA_MODEL
        )
        self.assertEqual(result, EXPECTED_DATABRICKS_RESULT)

        result = self.powerbi._parse_databricks_source(
            MOCK_DATABRICKS_EXP, MOCK_DASHBOARD_DATA_MODEL
        )
        self.assertEqual(result, EXPECTED_DATABRICKS_RESULT)

        result = self.powerbi._parse_databricks_source(
            MOCK_DATABRICKS_NATIVE_INVALID_QUERY_EXP, MOCK_DASHBOARD_DATA_MODEL
        )
        # sqlglot parses this sql and returns empty source list vs sqlfluff raising the error, hence adjusting test
        self.assertEqual(result, [])

        result = self.powerbi._parse_databricks_source(
            MOCK_DATABRICKS_NATIVE_INVALID_EXP, MOCK_DASHBOARD_DATA_MODEL
        )
        self.assertIsNone(result)

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
        self.assertEqual(result, None)

        # no source
        table = PowerBiTable(
            name="test_table",
            source=[],
        )
        result = self.powerbi._parse_table_info_from_source_exp(
            table, MOCK_DASHBOARD_DATA_MODEL
        )
        self.assertEqual(result, None)

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
        result = result[0]
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

    @pytest.mark.order(11)
    @patch.object(
        PowerbiSource,
        "_fetch_dataset_from_workspace",
        return_value=MOCK_DATASET_FROM_WORKSPACE_V3,
    )
    def test_parse_dataset_expressions_v2(self, *_):
        # test with valid snowflake source but no
        # dataset expression value
        result = self.powerbi._parse_snowflake_source(
            MOCK_SNOWFLAKE_EXP_V3, MOCK_DASHBOARD_DATA_MODEL
        )
        result = result[0]
        self.assertEqual(result["database"], "MANUFACTURING_BUSINESS_DATA_PRODUCTS")
        self.assertEqual(result["schema"], "INVENTORY_BY_PURPOSE")
        self.assertEqual(result["table"], "CUSTOMER_TABLE")

    @pytest.mark.order(12)
    def test_create_dataset_upstream_dataset_column_lineage(self):
        """
        Test column lineage creation between dataset and upstream dataset
        """
        upstream_entity = DashboardDataModel(
            name="upstream_dataset",
            id=uuid.uuid4(),
            dataModelType=DataModelType.PowerBIDataModel.value,
            columns=[
                Column(
                    name="orders",
                    dataType=DataType.STRUCT,
                    children=[
                        Column(
                            name="order_id",
                            dataType=DataType.INT,
                            fullyQualifiedName="service.upstream_dataset.orders.order_id",
                        ),
                        Column(
                            name="amount",
                            dataType=DataType.FLOAT,
                            fullyQualifiedName="service.upstream_dataset.orders.amount",
                        ),
                    ],
                ),
            ],
        )

        downstream_entity = DashboardDataModel(
            name="downstream_dataset",
            id=uuid.uuid4(),
            dataModelType=DataModelType.PowerBIDataModel.value,
            columns=[
                Column(
                    name="orders",
                    dataType=DataType.STRUCT,
                    children=[
                        Column(
                            name="order_id",
                            dataType=DataType.INT,
                            fullyQualifiedName="service.downstream_dataset.orders.order_id",
                        ),
                        Column(
                            name="amount",
                            dataType=DataType.FLOAT,
                            fullyQualifiedName="service.downstream_dataset.orders.amount",
                        ),
                    ],
                ),
            ],
        )

        result = self.powerbi._create_dataset_upstream_dataset_column_lineage(
            datamodel_entity=downstream_entity,
            upstream_dataset_entity=upstream_entity,
        )

        self.assertIsNotNone(result)
        self.assertEqual(len(result), 2)
        self.assertIsInstance(result[0], ColumnLineage)
        self.assertEqual(
            result[0].fromColumns[0].root, "service.upstream_dataset.orders.order_id"
        )
        self.assertEqual(
            result[0].toColumn.root, "service.downstream_dataset.orders.order_id"
        )

    @pytest.mark.order(13)
    def test_get_report_url(self):
        """
        Test report URL generation with different page scenarios
        """
        from unittest.mock import MagicMock

        workspace_id = "test-workspace-123"
        dashboard_id = "test-dashboard-456"

        # Create a mock client with api_client
        mock_api_client = MagicMock()
        self.powerbi.client = MagicMock()
        self.powerbi.client.api_client = mock_api_client

        # Create a PowerBIReport object as required by the method signature
        dashboard_details = PowerBIReport(id=dashboard_id, name="Test Report")

        # Test with multiple pages - should use first page name
        with patch(
            "metadata.ingestion.source.dashboard.powerbi.metadata.clean_uri"
        ) as mock_clean_uri:
            mock_clean_uri.return_value = "https://app.powerbi.com"
            mock_api_client.fetch_report_pages.return_value = [
                ReportPage(name="page1", displayName="Page 1"),
                ReportPage(name="page2", displayName="Page 2"),
                ReportPage(name="page3", displayName="Page 3"),
            ]

            result = self.powerbi._get_report_url(workspace_id, dashboard_details)

            mock_api_client.fetch_report_pages.assert_called_once_with(
                workspace_id, dashboard_id
            )
            self.assertEqual(
                result,
                f"https://app.powerbi.com/groups/{workspace_id}/reports/{dashboard_id}/page1?experience=power-bi",
            )

        # Test with single page - should use that page name
        with patch(
            "metadata.ingestion.source.dashboard.powerbi.metadata.clean_uri"
        ) as mock_clean_uri:
            mock_clean_uri.return_value = "https://app.powerbi.com"
            mock_api_client.fetch_report_pages.reset_mock()
            mock_api_client.fetch_report_pages.return_value = [
                ReportPage(name="single-page", displayName="Single Page")
            ]

            result = self.powerbi._get_report_url(workspace_id, dashboard_details)

            self.assertEqual(
                result,
                f"https://app.powerbi.com/groups/{workspace_id}/reports/{dashboard_id}/single-page?experience=power-bi",
            )

        # Test with no pages - should not add page_id
        with patch(
            "metadata.ingestion.source.dashboard.powerbi.metadata.clean_uri"
        ) as mock_clean_uri:
            mock_clean_uri.return_value = "https://app.powerbi.com"
            mock_api_client.fetch_report_pages.reset_mock()
            mock_api_client.fetch_report_pages.return_value = []

            result = self.powerbi._get_report_url(workspace_id, dashboard_details)

            self.assertEqual(
                result,
                f"https://app.powerbi.com/groups/{workspace_id}/reports/{dashboard_id}?experience=power-bi",
            )

        # Test with exception during fetch_report_pages - should handle gracefully
        with patch(
            "metadata.ingestion.source.dashboard.powerbi.metadata.clean_uri"
        ) as mock_clean_uri:
            mock_clean_uri.return_value = "https://app.powerbi.com"
            mock_api_client.fetch_report_pages.reset_mock()
            mock_api_client.fetch_report_pages.side_effect = Exception("API Error")

            result = self.powerbi._get_report_url(workspace_id, dashboard_details)

            # Should build URL without page_id when exception occurs
            self.assertEqual(
                result,
                f"https://app.powerbi.com/groups/{workspace_id}/reports/{dashboard_id}?experience=power-bi",
            )

    @pytest.mark.order(14)
    def test_powerbi_report_description_parsing(self):
        """
        Test that PowerBIReport model correctly parses the description field
        from API responses, which is used in yield_dashboard for reports
        """
        report_id = "test-report-456"

        # Test with description present
        mock_response_with_description = {
            "id": report_id,
            "name": "Test Report",
            "datasetId": "dataset-789",
            "description": "Test report description",
        }

        result = PowerBIReport(**mock_response_with_description)

        assert result is not None
        assert result.id == report_id
        assert result.name == "Test Report"
        assert result.datasetId == "dataset-789"
        assert result.description == "Test report description"

        # Test with None description
        mock_response_no_description = {
            "id": report_id,
            "name": "Test Report Without Description",
            "datasetId": "dataset-789",
        }

        result = PowerBIReport(**mock_response_no_description)

        assert result is not None
        assert result.id == report_id
        assert result.name == "Test Report Without Description"
        assert result.description is None

        # Test with empty string description
        mock_response_empty_description = {
            "id": report_id,
            "name": "Test Report Empty Description",
            "datasetId": "dataset-789",
            "description": "",
        }

        result = PowerBIReport(**mock_response_empty_description)

        assert result is not None
        assert result.description == ""

    @pytest.mark.order(15)
    def test_paginate_project_filter_pattern_none(self):
        """
        Test _paginate_project_filter_pattern when filter_pattern is None
        Should return default filter pattern that includes all workspaces
        """
        result = self.powerbi._paginate_project_filter_pattern(None)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].includes, [".*"])
        self.assertIsNone(result[0].excludes)

    @pytest.mark.order(16)
    def test_paginate_project_filter_pattern_only_excludes(self):
        """
        Test _paginate_project_filter_pattern with only exclude filters
        Should return the original filter pattern without pagination
        """
        filter_pattern = FilterPattern(excludes=["workspace1", "workspace2"])

        result = self.powerbi._paginate_project_filter_pattern(filter_pattern)

        self.assertEqual(len(result), 1)
        self.assertIsNone(result[0].includes)
        self.assertEqual(result[0].excludes, ["workspace1", "workspace2"])

    @pytest.mark.order(17)
    def test_paginate_project_filter_pattern_includes_under_limit(self):
        """
        Test _paginate_project_filter_pattern with include filters under the limit (20)
        Should return a single batch with all include filters
        """
        includes = [f"workspace{i}" for i in range(15)]
        filter_pattern = FilterPattern(includes=includes)

        result = self.powerbi._paginate_project_filter_pattern(filter_pattern)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].includes, includes)

    @pytest.mark.order(18)
    def test_paginate_project_filter_pattern_includes_at_limit(self):
        """
        Test _paginate_project_filter_pattern with exactly 20 include filters
        Should return a single batch
        """
        includes = [f"workspace{i}" for i in range(20)]
        filter_pattern = FilterPattern(includes=includes)

        result = self.powerbi._paginate_project_filter_pattern(filter_pattern)

        self.assertEqual(len(result), 1)
        self.assertEqual(len(result[0].includes), 20)

    @pytest.mark.order(19)
    def test_paginate_project_filter_pattern_includes_over_limit(self):
        """
        Test _paginate_project_filter_pattern with include filters over the limit (20)
        Should paginate into multiple batches
        """
        includes = [f"workspace{i}" for i in range(45)]
        filter_pattern = FilterPattern(includes=includes)

        result = self.powerbi._paginate_project_filter_pattern(filter_pattern)

        self.assertEqual(len(result), 3)
        self.assertEqual(len(result[0].includes), 20)
        self.assertEqual(len(result[1].includes), 20)
        self.assertEqual(len(result[2].includes), 5)
        self.assertEqual(result[0].includes, includes[:20])
        self.assertEqual(result[1].includes, includes[20:40])
        self.assertEqual(result[2].includes, includes[40:45])

    @pytest.mark.order(20)
    def test_paginate_project_filter_pattern_with_includes_and_excludes(self):
        """
        Test _paginate_project_filter_pattern with both includes and excludes
        Excludes should be preserved across all paginated batches
        """
        includes = [f"workspace{i}" for i in range(25)]
        excludes = ["excluded1", "excluded2"]
        filter_pattern = FilterPattern(includes=includes, excludes=excludes)

        result = self.powerbi._paginate_project_filter_pattern(filter_pattern)

        self.assertEqual(len(result), 2)
        self.assertEqual(len(result[0].includes), 20)
        self.assertEqual(len(result[1].includes), 5)
        self.assertEqual(result[0].excludes, excludes)
        self.assertEqual(result[1].excludes, excludes)

    @pytest.mark.order(21)
    def test_paginate_project_filter_pattern_empty_includes(self):
        """
        Test _paginate_project_filter_pattern with empty includes list
        Should return the original filter pattern
        """
        filter_pattern = FilterPattern(includes=[], excludes=["excluded1"])

        result = self.powerbi._paginate_project_filter_pattern(filter_pattern)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].includes, [])
        self.assertEqual(result[0].excludes, ["excluded1"])

    @pytest.mark.order(22)
    def test_paginate_project_filter_pattern_large_batch(self):
        """
        Test _paginate_project_filter_pattern with a large number of includes
        Should correctly paginate into multiple batches
        """
        includes = [f"workspace{i}" for i in range(100)]
        filter_pattern = FilterPattern(includes=includes)

        result = self.powerbi._paginate_project_filter_pattern(filter_pattern)

        self.assertEqual(len(result), 5)
        for i in range(4):
            self.assertEqual(len(result[i].includes), 20)
        total_includes = sum(len(batch.includes) for batch in result)
        self.assertEqual(total_includes, 100)

    @pytest.mark.order(23)
    def test_table_name_fallback_when_source_expression_parsing_fails(self):
        """
        Test that when _parse_table_info_from_source_exp returns None,
        the _get_table_and_datamodel_lineage method falls back to using
        the PowerBI table name for lineage.
        """
        from unittest.mock import MagicMock

        table = PowerBiTable(
            name="my_powerbi_table",
            source=[],
            columns=[],
        )

        mock_table_entity = MagicMock()
        mock_table_entity.id = uuid.uuid4()
        mock_table_entity.fullyQualifiedName = (
            "service.database.schema.my_powerbi_table"
        )

        with patch.object(
            self.powerbi, "_parse_table_info_from_source_exp", return_value=None
        ), patch.object(
            self.powerbi.metadata,
            "search_in_any_service",
            return_value=mock_table_entity,
        ) as mock_search, patch.object(
            self.powerbi, "_get_column_lineage", return_value=[]
        ), patch.object(
            self.powerbi, "_get_add_lineage_request"
        ) as mock_lineage_request:
            mock_lineage_request.return_value = MagicMock()

            list(
                self.powerbi._get_table_and_datamodel_lineage(
                    db_service_prefix=None,
                    table=table,
                    datamodel_entity=MOCK_DASHBOARD_DATA_MODEL,
                )
            )

            mock_search.assert_called_once()
            call_args = mock_search.call_args
            fqn_search_string = call_args.kwargs.get("fqn_search_string") or call_args[
                1
            ].get("fqn_search_string")
            self.assertIn("my_powerbi_table", fqn_search_string)

    @pytest.mark.order(24)
    def test_table_name_fallback_with_valid_source_expression(self):
        """
        Test that when _parse_table_info_from_source_exp returns valid table info,
        the parsed table name is used instead of the PowerBI table name.
        """
        from unittest.mock import MagicMock

        table = PowerBiTable(
            name="powerbi_table_name",
            source=[PowerBITableSource(expression=MOCK_REDSHIFT_EXP)],
            columns=[],
        )

        mock_table_entity = MagicMock()
        mock_table_entity.id = uuid.uuid4()
        mock_table_entity.fullyQualifiedName = (
            "service.dev.demo_dbt_jaffle.customers_clean"
        )

        with patch.object(
            self.powerbi.metadata,
            "search_in_any_service",
            return_value=mock_table_entity,
        ) as mock_search, patch.object(
            self.powerbi, "_get_column_lineage", return_value=[]
        ), patch.object(
            self.powerbi, "_get_add_lineage_request"
        ) as mock_lineage_request:
            mock_lineage_request.return_value = MagicMock()

            list(
                self.powerbi._get_table_and_datamodel_lineage(
                    db_service_prefix=None,
                    table=table,
                    datamodel_entity=MOCK_DASHBOARD_DATA_MODEL,
                )
            )

            mock_search.assert_called_once()
            call_args = mock_search.call_args
            fqn_search_string = call_args.kwargs.get("fqn_search_string") or call_args[
                1
            ].get("fqn_search_string")
            self.assertIn("customers_clean", fqn_search_string)
            self.assertNotIn("powerbi_table_name", fqn_search_string)

    @pytest.mark.order(25)
    def test_get_dataflow_column_info(self):
        """
        Test that _get_dataflow_column_info correctly extracts tables and columns
        from the dataflow export API response
        """
        dataflow_export = DataflowExportResponse(
            name="test_dataflow",
            description="Test dataflow description",
            version="1.0",
            entities=[
                DataflowEntity(
                    name="queryinsights exec_requests_history",
                    description="Query insights table",
                    attributes=[
                        DataflowEntityAttribute(
                            name="distributed_statement_id",
                            dataType="string",
                            description="Statement ID",
                        ),
                        DataflowEntityAttribute(
                            name="submit_time",
                            dataType="dateTime",
                        ),
                        DataflowEntityAttribute(
                            name="total_elapsed_time_ms",
                            dataType="int64",
                        ),
                    ],
                ),
                DataflowEntity(
                    name="Query",
                    description="",
                    attributes=[
                        DataflowEntityAttribute(
                            name="Column1",
                            dataType="string",
                        ),
                        DataflowEntityAttribute(
                            name="Column2",
                            dataType="string",
                        ),
                    ],
                ),
            ],
        )

        result = self.powerbi._get_dataflow_column_info(dataflow_export)

        self.assertIsNotNone(result)
        self.assertEqual(len(result), 2)

        first_table = result[0]
        self.assertEqual(first_table.name.root, "queryinsights exec_requests_history")
        self.assertEqual(first_table.dataType, DataType.TABLE)
        self.assertEqual(first_table.description.root, "Query insights table")
        self.assertEqual(len(first_table.children), 3)

        first_column = first_table.children[0]
        self.assertEqual(first_column.name.root, "distributed_statement_id")
        self.assertEqual(first_column.description.root, "Statement ID")

        second_table = result[1]
        self.assertEqual(second_table.name.root, "Query")
        self.assertEqual(len(second_table.children), 2)

    @pytest.mark.order(26)
    def test_get_dataflow_column_info_empty_entities(self):
        """
        Test that _get_dataflow_column_info handles empty entities list
        """
        dataflow_export = DataflowExportResponse(
            name="empty_dataflow",
            entities=[],
        )

        result = self.powerbi._get_dataflow_column_info(dataflow_export)

        self.assertIsNotNone(result)
        self.assertEqual(len(result), 0)

    @pytest.mark.order(27)
    def test_get_dataflow_column_info_entity_without_attributes(self):
        """
        Test that _get_dataflow_column_info handles entities without attributes
        """
        dataflow_export = DataflowExportResponse(
            name="dataflow_no_attrs",
            entities=[
                DataflowEntity(
                    name="EmptyTable",
                    description="Table with no columns",
                    attributes=[],
                ),
            ],
        )

        result = self.powerbi._get_dataflow_column_info(dataflow_export)

        self.assertIsNotNone(result)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].name.root, "EmptyTable")
        self.assertEqual(len(result[0].children), 0)

    @pytest.mark.order(28)
    def test_get_dataset_ids_from_report_datasources(self):
        """
        Test that _get_dataset_ids_from_report_datasources extracts dataset IDs
        from the report datasources API response by parsing the
        connectionDetails.database field with pattern sobe_wowvirtualserver-{DATASET_ID}
        """
        from unittest.mock import MagicMock, PropertyMock

        mock_api_client = MagicMock()
        self.powerbi.client = MagicMock()
        self.powerbi.client.api_client = mock_api_client

        mock_context = MagicMock()
        mock_context.workspace.id = "test-workspace-id"

        with patch.object(
            type(self.powerbi), "context", new_callable=PropertyMock
        ) as mock_ctx:
            mock_ctx.return_value.get.return_value = mock_context

            mock_api_client.fetch_report_datasources.return_value = [
                Datasource(
                    name="TestDatasource",
                    datasourceType="AnalysisServices",
                    connectionDetails=DatasourceConnectionDetails(
                        server="pbiazure://api.powerbi.com/",
                        database="sobe_wowvirtualserver-45812303-926b-49b3-9eb2-8c8209acfaa2",
                    ),
                    datasourceId="3bb310b9-daee-4442-aa3a-f344038e17d8",
                    gatewayId="1ce5fe9c-93eb-410e-8cb8-05ec0b7f3ac6",
                ),
            ]

            result = self.powerbi._get_dataset_ids_from_report_datasources(
                report_id="test-report-id"
            )

            self.assertEqual(len(result), 1)
            self.assertEqual(result[0], "45812303-926b-49b3-9eb2-8c8209acfaa2")
            mock_api_client.fetch_report_datasources.assert_called_once_with(
                group_id="test-workspace-id", report_id="test-report-id"
            )

            mock_api_client.fetch_report_datasources.return_value = [
                Datasource(
                    name="NoDB",
                    datasourceType="Web",
                    connectionDetails=DatasourceConnectionDetails(
                        server="https://example.com",
                        database=None,
                    ),
                ),
            ]

            result = self.powerbi._get_dataset_ids_from_report_datasources(
                report_id="test-report-id"
            )
            self.assertEqual(result, [])

            mock_api_client.fetch_report_datasources.return_value = None
            result = self.powerbi._get_dataset_ids_from_report_datasources(
                report_id="test-report-id"
            )
            self.assertEqual(result, [])
