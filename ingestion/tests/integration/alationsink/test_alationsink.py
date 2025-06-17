#  Copyright 2024 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Test Alation Sink using the integration testing
"""
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.metadata.alationsink.metadata import AlationsinkSource
from metadata.ingestion.source.metadata.alationsink.models import (
    ColumnIndex,
    CreateColumnRequest,
    CreateDatasourceRequest,
    CreateSchemaRequest,
    CreateTableRequest,
)

mock_alation_sink_config = {
    "source": {
        "type": "AlationSink",
        "serviceName": "local_alation_sink",
        "serviceConnection": {
            "config": {
                "authType": {"accessToken": "access_token"},
                "hostPort": "https://alation.example.com",
                "projectName": "Test",
                "paginationLimit": 50,
                "datasourceLinks": {
                    "112": "sample_data.ecommerce_db",
                },
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
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
        }
    },
}

MOCK_ALATION_DATASOURCE_ID = 34


def mock_write_entities(self, ds_id, create_request):  # pylint: disable=unused-argument
    return {"job_id": "10378"}


def mock_write_entity(self, create_request):  # pylint: disable=unused-argument
    return {"ds_id": "13"}


def mock_list_connectors():
    return {
        "Oracle OCF connector": 112,
        "Starburst Trino OCF Connector": 113,
        "AWS Glue OCF Connector": 114,
        "BigQuery OCF Connector": 115,
        "MySQL OCF Connector": 116,
    }


EXPECTED_DATASOURCE_REQUEST = CreateDatasourceRequest(
    uri="None",
    connector_id=115,
    db_username="Test",
    db_password=None,
    title="ecommerce_db",
    description="This **mock** database contains schemas related to shopify sales and orders with related dimension tables.",
)

EXPECTED_SCHEMA_REQUEST = CreateSchemaRequest(
    key="34.shopify",
    title="shopify",
    description="This **mock** database contains schema related to shopify sales and orders with related dimension tables.",
)


BASE_DESC = "This dimension table contains the billing and shipping addresses of customers. You can join this table with the sales table to generate lists of the billing and shipping addresses. Customers can enter their addresses more than once, so the same address can appear in more than one row in this table. This table contains one row per customer address."

EXPECTED_TABLES = [
    CreateTableRequest(
        key="34.shopify.dim_::>address",
        title="dim_::>address",
        description=BASE_DESC,
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.dim_address",
        title="dim_address",
        description=BASE_DESC,
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.dim_address_clean",
        title="dim_address_clean",
        description="Created from dim_address after a small cleanup.",
        table_type="VIEW",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.dim_customer",
        title="dim_customer",
        description="The dimension table contains data about your customers. The customers table contains one row per customer. It includes historical metrics (such as the total amount that each customer has spent in your store) as well as forward-looking metrics (such as the predicted number of days between future orders and the expected order value in the next 30 days). This table also includes columns that segment customers into various categories (such as new, returning, promising, at risk, dormant, and loyal), which you can use to target marketing activities.",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.dim_location",
        title="dim_location",
        description="The dimension table contains metrics about your Shopify POS. This table contains one row per Shopify POS location. You can use this table to generate a list of the Shopify POS locations or you can join the table with the sales table to measure sales performance.",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.dim_staff",
        title="dim_staff",
        description="This dimension table contains information about the staff accounts in the store. It contains one row per staff account. Use this table to generate a list of your staff accounts, or join it with the sales, API clients and locations tables to analyze staff performance at Shopify POS locations.",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key='34.shopify."dim.api/client"',
        title="dim.api/client",
        description="This dimension table contains a row for each channel or app that your customers use to create orders. Some examples of these include Facebook and Online Store. You can join this table with the sales table to measure channel performance.",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key='34.shopify."dim.product"',
        title="dim.product",
        description="This dimension table contains information about each of the products in your store. This table contains one row per product. This table reflects the current state of products in your Shopify admin.",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key='34.shopify."dim.product.variant"',
        title="dim.product.variant",
        description="This dimension table contains current information about each of the product variants in your store. This table contains one row per product variant.",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key='34.shopify."dim.shop"',
        title="dim.shop",
        description="This dimension table contains online shop information. This table contains one shop per row.",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.dim(shop)",
        title="dim(shop)",
        description="This dimension table contains online shop information with weird characters.",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.fact_line_item_Lorem_ipsum_dolor_sit_amet_consectetur_adipiscing_elit_sed_do_eiusmod_tempor_incididunt_ut_labore_et_dolore_magna_aliqua_Ut_enim_ad_minim_veniam_quis_nostrud_exercitation_ullamco_laboris_nisi_ut_aliquip_ex_ea_commodo_consequat_Duis_aute_iru",
        title="fact_line_item_Lorem_ipsum_dolor_sit_amet_consectetur_adipiscing_elit_sed_do_eiusmod_tempor_incididunt_ut_labore_et_dolore_magna_aliqua_Ut_enim_ad_minim_veniam_quis_nostrud_exercitation_ullamco_laboris_nisi_ut_aliquip_ex_ea_commodo_consequat_Duis_aute_iru",
        description="The fact table contains information about the line items in orders. Each row in the table is a line item in an order. It contains product and product variant details as they were at the time of the order. This table does not include information about returns. Join this table with the TODO fact_sales table to get the details of the product on the day it was sold. This data will match what appears on the order in your Shopify admin as well as the in the Sales reports.",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.fact_order",
        title="fact_order",
        description="The orders table contains information about each order in your store. Although this table is good for generating order lists and joining with the dim_customer, use the sales table instead for computing financial or other metrics.",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.fact_sale",
        title="fact_sale",
        description="The fact table captures the value of products sold or returned, as well as the values of other charges such as taxes and shipping costs. The sales table contains one row per order line item, one row per returned line item, and one row per shipping charge. Use this table when you need financial metrics.",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.fact_session",
        title="fact_session",
        description="This fact table contains information about the visitors to your online store. This table has one row per session, where one session can contain many page views. If you use Urchin Traffic Module (UTM) parameters in marketing campaigns, then you can use this table to track how many customers they direct to your store.",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.marketing",
        title="marketing",
        description="Marketing data",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.raw_customer",
        title="raw_customer",
        description="This is a raw customers table as represented in our online DB. This contains personal, shipping and billing addresses and details of the customer store and customer profile. This table is used to build our dimensional and fact tables",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.raw_order",
        title="raw_order",
        description="This is a raw orders table as represented in our online DB. This table contains all the orders by the customers and can be used to buid our dim and fact tables",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.raw_product_catalog",
        title="raw_product_catalog",
        description="This is a raw product catalog table contains the product listing, price, seller etc.. represented in our online DB. ",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.sales",
        title="sales",
        description="Sales data",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.магазин",
        title="магазин",
        description="This dimension table contains online shop information with weird characters.",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.icemarketdata_global",
        title="icemarketdata_global",
        description=BASE_DESC,
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.global_market",
        title="global_market",
        description=BASE_DESC,
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.global",
        title="global",
        description=BASE_DESC,
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.ice_global",
        title="ice_global",
        description=BASE_DESC,
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.mortgage",
        title="mortgage",
        description=BASE_DESC,
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.funds_closingprocessdocumentsrelationship",
        title="funds_closingprocessdocumentsrelationship",
        description=BASE_DESC,
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.big_data_table_with_nested_columns",
        title="big_data_table_with_nested_columns",
        description="A large table with thousands of columns including nested "
        "structures for testing pagination and search performance",
        table_type="TABLE",
        sql=None,
    ),
    CreateTableRequest(
        key="34.shopify.performance_test_table",
        title="performance_test_table",
        description="A table with thousands of columns designed for testing the "
        "performance of paginated column APIs. This table contains 2000 columns "
        "with various data types to simulate real-world scenarios where tables "
        "have large numbers of columns.",
        table_type="TABLE",
        sql=None,
    ),
]

EXPECTED_COLUMNS = [
    CreateColumnRequest(
        key="34.shopify.dim_address.address_id",
        column_type="numeric",
        title="address_id",
        description="Unique identifier for the address.",
        nullable=None,
        position="1",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
    CreateColumnRequest(
        key="34.shopify.dim_address.shop_id",
        column_type="numeric",
        title="shop_id",
        description="The ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.",
        nullable=None,
        position="2",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
    CreateColumnRequest(
        key="34.shopify.dim_address.first_name",
        column_type="varchar",
        title="first_name",
        description="First name of the customer.",
        nullable=None,
        position="3",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
    CreateColumnRequest(
        key="34.shopify.dim_address.last_name",
        column_type="varchar",
        title="last_name",
        description="Last name of the customer.",
        nullable=None,
        position="4",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
    CreateColumnRequest(
        key="34.shopify.dim_address.address1",
        column_type="varchar",
        title="address1",
        description="The first address line. For example, 150 Elgin St.",
        nullable=None,
        position="5",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
    CreateColumnRequest(
        key="34.shopify.dim_address.address2",
        column_type="varchar",
        title="address2",
        description="The second address line. For example, Suite 800.",
        nullable=None,
        position="6",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
    CreateColumnRequest(
        key="34.shopify.dim_address.company",
        column_type="varchar",
        title="company",
        description="The name of the customer's business, if one exists.",
        nullable=None,
        position="7",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
    CreateColumnRequest(
        key="34.shopify.dim_address.city",
        column_type="varchar",
        title="city",
        description="The name of the city. For example, Palo Alto.",
        nullable=None,
        position="8",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
    CreateColumnRequest(
        key="34.shopify.dim_address.region",
        column_type="varchar",
        title="region",
        description="The name of the region, such as a province or state, where the customer is located. For example, Ontario or New York. This column is the same as CustomerAddress.province in the Admin API.",
        nullable=None,
        position="9",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
    CreateColumnRequest(
        key="34.shopify.dim_address.zip",
        column_type="varchar",
        title="zip",
        description="The ZIP or postal code. For example, 90210.",
        nullable=None,
        position="10",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
    CreateColumnRequest(
        key="34.shopify.dim_address.country",
        column_type="varchar",
        title="country",
        description="The full name of the country. For example, Canada.",
        nullable=None,
        position="11",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
    CreateColumnRequest(
        key="34.shopify.dim_address.phone",
        column_type="varchar",
        title="phone",
        description="The phone number of the customer.",
        nullable=None,
        position="12",
        index=ColumnIndex(
            isPrimaryKey=None,
            isForeignKey=None,
            referencedColumnId=None,
            isOtherIndex=None,
        ),
    ),
]


class AlationSinkTest(TestCase):
    """
    Implements the necessary methods to extract
    Alation Sink Metadata Unit Test
    """

    @patch(
        "metadata.ingestion.source.metadata.alationsink.metadata.AlationsinkSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(
            mock_alation_sink_config
        )
        self.alation_sink_source = AlationsinkSource.create(
            mock_alation_sink_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.alation_sink_source.connectors = mock_list_connectors()
        self.metadata = OpenMetadata(
            OpenMetadataConnection.model_validate(
                mock_alation_sink_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )

    def test_datasources(self):
        """
        Testing datasource API request creation model
        """
        om_database = self.metadata.get_by_name(
            entity=Database, fqn="sample_data.ecommerce_db"
        )
        returned_datasource_request = (
            self.alation_sink_source.create_datasource_request(om_database)
        )
        self.assertEqual(returned_datasource_request, EXPECTED_DATASOURCE_REQUEST)

    def test_schemas(self):
        """
        Testing schema API request creation
        """
        om_schema = self.metadata.get_by_name(
            entity=DatabaseSchema, fqn="sample_data.ecommerce_db.shopify"
        )
        returned_schema_request = self.alation_sink_source.create_schema_request(
            alation_datasource_id=MOCK_ALATION_DATASOURCE_ID, om_schema=om_schema
        )
        self.assertEqual(returned_schema_request, EXPECTED_SCHEMA_REQUEST)

    def test_tables(self):
        """
        Testing table API request creation
        """
        om_tables = self.metadata.list_all_entities(
            entity=Table,
            skip_on_failure=True,
            params={"database": "sample_data.ecommerce_db.shopify"},
        )
        returned_tables = []
        for om_table in om_tables:
            returned_tables.append(
                self.alation_sink_source.create_table_request(
                    alation_datasource_id=MOCK_ALATION_DATASOURCE_ID,
                    schema_name="shopify",
                    om_table=om_table,
                )
            )
        self.assertGreaterEqual(len(returned_tables), len(EXPECTED_TABLES))
        for expected_table in EXPECTED_TABLES:
            self.assertIn(expected_table, returned_tables)

    def test_columns(self):
        """
        Testing column API request creation
        """
        om_table = self.metadata.get_by_name(
            entity=Table, fqn="sample_data.ecommerce_db.shopify.dim_address"
        )
        returned_columns = []
        for om_column in om_table.columns:
            returned_columns.append(
                self.alation_sink_source.create_column_request(
                    alation_datasource_id=MOCK_ALATION_DATASOURCE_ID,
                    schema_name="shopify",
                    table_name=model_str(om_table.name),
                    om_column=om_column,
                    table_constraints=om_table.tableConstraints,
                )
            )
        for _, (expected, original) in enumerate(
            zip(EXPECTED_COLUMNS, returned_columns)
        ):
            self.assertEqual(expected, original)
