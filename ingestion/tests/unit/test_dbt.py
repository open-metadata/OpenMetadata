"""
Test dbt
"""

import json
import uuid
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from dbt_artifacts_parser.parser import parse_catalog, parse_manifest, parse_run_results
from pydantic import AnyUrl

from metadata.generated.schema.entity.data.table import Column, DataModel, Table
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.ingestion.source.database.dbt.metadata import DbtSource
from metadata.utils.dbt_config import DbtFiles, DbtObjects

mock_dbt_config = {
    "source": {
        "type": "dbt",
        "serviceName": "dbt_test",
        "sourceConfig": {
            "config": {
                "type": "DBT",
                "dbtConfigSource": {
                    "dbtCatalogFilePath": "sample/dbt_files/catalog.json",
                    "dbtManifestFilePath": "sample/dbt_files/manifest.json",
                    "dbtRunResultsFilePath": "sample/dbt_files/run_results.json",
                },
            }
        },
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

MOCK_SAMPLE_MANIFEST_V4_V5_V6 = "resources/datasets/manifest_v4_v5_v6.json"

MOCK_SAMPLE_MANIFEST_V7 = "resources/datasets/manifest_v7.json"

MOCK_SAMPLE_MANIFEST_V8 = "resources/datasets/manifest_v8.json"

MOCK_SAMPLE_MANIFEST_NULL_DB = "resources/datasets/manifest_null_db.json"


EXPECTED_DATA_MODEL_FQNS = [
    "dbt_test.dev.dbt_jaffle.customers",
    "dbt_test.dev.dbt_jaffle.orders",
    "dbt_test.dev.dbt_jaffle.stg_customers",
    "dbt_test.dev.dbt_jaffle.customers_null_db",
]

EXPECTED_DATA_MODELS = [
    DataModel(
        modelType="DBT",
        description="This table has basic information about a customer, as well as some derived facts based on a customer's orders",
        path="sample/customers/root/path/models/customers.sql",
        rawSql="sample customers raw code",
        sql="sample customers compile code",
        upstream=["dbt_test.dev.dbt_jaffle.stg_customers"],
        owner=EntityReference(
            id="cb2a92f5-e935-4ad7-911c-654280046538",
            type="user",
            name=None,
            fullyQualifiedName="aaron_johnson0",
            description=None,
            displayName=None,
            deleted=None,
            href=AnyUrl(
                "http://localhost:8585/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
            ),
        ),
        tags=[
            TagLabel(
                tagFQN="dbtTags.model_tag_one",
                description=None,
                source="Tag",
                labelType="Automated",
                state="Confirmed",
                href=None,
            ),
            TagLabel(
                tagFQN="dbtTags.model_tag_two",
                description=None,
                source="Tag",
                labelType="Automated",
                state="Confirmed",
                href=None,
            ),
        ],
        columns=[
            Column(
                name="customer_id",
                dataType="VARCHAR",
                dataLength=1,
                description="This is a unique identifier for a customer",
            ),
            Column(
                name="first_name",
                dataType="VARCHAR",
                dataLength=1,
                description="Customer's first name. PII.",
            ),
            Column(
                name="last_name",
                dataType="VARCHAR",
                dataLength=1,
                description="Customer's last name. PII.",
            ),
        ],
        generatedAt=None,
    ),
    DataModel(
        modelType="DBT",
        description="This table has basic information about orders, as well as some derived facts based on payments",
        path="sample/orders/root/path/models/orders.sql",
        rawSql="sample raw orders code",
        sql="sample compiled code",
        upstream=[],
        owner=EntityReference(
            id="cb2a92f5-e935-4ad7-911c-654280046538",
            type="user",
            name=None,
            fullyQualifiedName="aaron_johnson0",
            description=None,
            displayName=None,
            deleted=None,
            href=AnyUrl(
                "http://localhost:8585/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
            ),
        ),
        tags=[
            TagLabel(
                tagFQN="dbtTags.single_tag",
                description=None,
                source="Tag",
                labelType="Automated",
                state="Confirmed",
                href=None,
            )
        ],
        columns=[
            Column(
                name="order_id",
                displayName=None,
                dataType="VARCHAR",
                dataLength=1,
                description="This is a unique identifier for an order",
            ),
            Column(
                name="customer_id",
                displayName=None,
                dataType="VARCHAR",
                dataLength=1,
                description="Foreign key to the customers table",
            ),
        ],
        generatedAt=None,
    ),
    DataModel(
        modelType="DBT",
        description=None,
        path="sample/stg_customers/root/path/models/staging/stg_customers.sql",
        rawSql="sample stg_customers raw_code",
        sql="sample stg_customers compiled code",
        upstream=[],
        owner=EntityReference(
            id="cb2a92f5-e935-4ad7-911c-654280046538",
            type="user",
            name=None,
            fullyQualifiedName="aaron_johnson0",
            description=None,
            displayName=None,
            deleted=None,
            href=AnyUrl(
                "http://localhost:8585/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
            ),
        ),
        tags=None,
        columns=[
            Column(
                name="customer_id",
                displayName=None,
                dataType="VARCHAR",
                dataLength=1,
                description="This is a unique identifier for an customer",
            )
        ],
        generatedAt=None,
    ),
]

EXPECTED_DATA_MODEL_NULL_DB = [
    DataModel(
        modelType="DBT",
        description=None,
        path="sample/customers_null_db/root/path/models/staging/customers_null_db.sql",
        rawSql="sample customers_null_db raw_code",
        sql="sample customers_null_db compiled code",
        upstream=[],
        owner=EntityReference(
            id="cb2a92f5-e935-4ad7-911c-654280046538",
            type="user",
            name=None,
            fullyQualifiedName="aaron_johnson0",
            description=None,
            displayName=None,
            deleted=None,
            href=AnyUrl(
                "http://localhost:8585/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
            ),
        ),
        tags=None,
        columns=[
            Column(
                name="customer_id",
                displayName=None,
                dataType="VARCHAR",
                dataLength=1,
                description="This is a unique identifier for an customer",
            )
        ],
        generatedAt=None,
    ),
]

MOCK_OWNER = EntityReference(
    id="cb2a92f5-e935-4ad7-911c-654280046538",
    type="user",
    name=None,
    fullyQualifiedName="aaron_johnson0",
    description=None,
    displayName=None,
    deleted=None,
    href=AnyUrl(
        "http://localhost:8585/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
        scheme="http",
        host="localhost",
        host_type="int_domain",
        port="8585",
        path="/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
    ),
)

MOCK_NULL_DB_TABLE = [
    Table(
        id=uuid.uuid4(),
        name="test",
        databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
        fullyQualifiedName="dbt_test.dev.dbt_jaffle.customers_null_db",
        columns=[],
    )
]


class DbtUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    dbt Unit Test
    """

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.test_connection")
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_dbt_config)
        self.dbt_source_obj = DbtSource.create(
            mock_dbt_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.get_dbt_owner")
    def test_dbt_manifest_v4_v5_v6(self, get_dbt_owner):
        get_dbt_owner.return_value = MOCK_OWNER
        self.execute_test(
            MOCK_SAMPLE_MANIFEST_V4_V5_V6,
            expected_records=4,
            expected_data_models=EXPECTED_DATA_MODELS,
        )

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.get_dbt_owner")
    def test_dbt_manifest_v7(self, get_dbt_owner):
        get_dbt_owner.return_value = MOCK_OWNER
        self.execute_test(
            MOCK_SAMPLE_MANIFEST_V7,
            expected_records=4,
            expected_data_models=EXPECTED_DATA_MODELS,
        )

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.get_dbt_owner")
    def test_dbt_manifest_v8(self, get_dbt_owner):
        get_dbt_owner.return_value = MOCK_OWNER
        self.execute_test(
            MOCK_SAMPLE_MANIFEST_V8,
            expected_records=4,
            expected_data_models=EXPECTED_DATA_MODELS,
        )

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.get_dbt_owner")
    @patch("metadata.ingestion.ometa.mixins.es_mixin.ESMixin.es_search_from_fqn")
    def test_dbt_manifest_null_db(self, es_search_from_fqn, get_dbt_owner):
        get_dbt_owner.return_value = MOCK_OWNER
        es_search_from_fqn.return_value = MOCK_NULL_DB_TABLE
        self.execute_test(
            MOCK_SAMPLE_MANIFEST_NULL_DB,
            expected_records=2,
            expected_data_models=EXPECTED_DATA_MODEL_NULL_DB,
        )

    def execute_test(self, mock_manifest, expected_records, expected_data_models):
        mock_file_path = Path(__file__).parent / mock_manifest
        with open(mock_file_path) as file:
            mock_data: dict = json.load(file)
        dbt_files = DbtFiles(dbt_manifest=mock_data)
        dbt_objects = DbtObjects(
            dbt_catalog=parse_catalog(dbt_files.dbt_catalog)
            if dbt_files.dbt_catalog
            else None,
            dbt_manifest=parse_manifest(dbt_files.dbt_manifest),
            dbt_run_results=parse_run_results(dbt_files.dbt_run_results)
            if dbt_files.dbt_run_results
            else None,
        )
        self.check_dbt_validate(dbt_files=dbt_files, expected_records=expected_records)
        self.check_yield_datamodel(
            dbt_objects=dbt_objects, expected_data_models=expected_data_models
        )

    def check_dbt_validate(self, dbt_files, expected_records):
        with self.assertLogs() as captured:
            self.dbt_source_obj.validate_dbt_files(dbt_files=dbt_files)
        self.assertEqual(len(captured.records), expected_records)
        for record in captured.records:
            self.assertNotIn("Error", record.getMessage())
            self.assertNotIn("Unable", record.getMessage())

    def check_yield_datamodel(self, dbt_objects, expected_data_models):
        data_model_list = []
        yield_data_models = self.dbt_source_obj.yield_data_models(
            dbt_objects=dbt_objects
        )
        for data_model_link in yield_data_models:
            if isinstance(data_model_link, DataModelLink):
                self.assertIn(data_model_link.fqn.__root__, EXPECTED_DATA_MODEL_FQNS)
                data_model_list.append(data_model_link.datamodel)

        for _, (exptected, original) in enumerate(
            zip(expected_data_models, data_model_list)
        ):
            self.assertEqual(exptected, original)
