"""
Test dbt
"""

import json
import uuid
from copy import deepcopy
from pathlib import Path
from unittest import TestCase
from unittest.mock import MagicMock, PropertyMock, patch

from collate_dbt_artifacts_parser.parser import (
    parse_catalog,
    parse_manifest,
    parse_run_results,
)
from pydantic import AnyUrl

from metadata.generated.schema.entity.data.apiEndpoint import APIEndpoint
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.table import Column, DataModel, Table
from metadata.generated.schema.entity.domains.domain import Domain
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type import entityReference
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.dbt.dbt_utils import (
    convert_java_to_python_format,
    find_domain_by_name,
    find_entity_by_type_and_fqn,
    format_domain_reference,
    format_entity_reference,
    format_validation_error_message,
    generate_entity_link,
    get_corrected_name,
    get_data_model_path,
    get_dbt_compiled_query,
    get_dbt_raw_query,
    validate_custom_property_value,
    validate_date_time_format,
    validate_email_format,
    validate_enum_value,
    validate_table_structure,
    validate_time_interval,
)
from metadata.ingestion.source.database.dbt.metadata import DbtSource
from metadata.ingestion.source.database.dbt.models import DbtFiles, DbtObjects
from metadata.utils.logger import ingestion_logger, set_loggers_level
from metadata.utils.tag_utils import get_tag_labels

logger = ingestion_logger()

mock_dbt_config = {
    "source": {
        "type": "dbt",
        "serviceName": "dbt_test",
        "sourceConfig": {
            "config": {
                "type": "DBT",
                "dbtConfigSource": {
                    "dbtConfigType": "local",
                    "dbtCatalogFilePath": "sample/dbt_files/catalog.json",
                    "dbtManifestFilePath": "sample/dbt_files/manifest.json",
                    "dbtRunResultsFilePath": "sample/dbt_files/run_results.json",
                    "dbtSourcesFilePath": "sample/dbt_files/sources.json",
                },
                "dbtUpdateOwners": True,
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "enableVersionValidation": False,
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

MOCK_SAMPLE_MANIFEST_V4_V5_V6 = "resources/datasets/manifest_v4_v5_v6.json"

MOCK_SAMPLE_MANIFEST_V7 = "resources/datasets/manifest_v7.json"

MOCK_SAMPLE_MANIFEST_V8 = "resources/datasets/manifest_v8.json"

MOCK_SAMPLE_MANIFEST_VERSIONLESS = "resources/datasets/manifest_versionless.json"

MOCK_SAMPLE_MANIFEST_VERSIONLESS_BROKEN_EXPOSURES = (
    "resources/datasets/manifest_versionless_broken_exposures.json"
)


MOCK_SAMPLE_MANIFEST_NULL_DB = "resources/datasets/manifest_null_db.json"

MOCK_SAMPLE_MANIFEST_TEST_NODE = "resources/datasets/manifest_test_node.json"

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
        resourceType="model",
        sql="sample customers compile code",
        upstream=[],
        owners=EntityReferenceList(
            root=[
                EntityReference(
                    id="cb2a92f5-e935-4ad7-911c-654280046538",
                    type="user",
                    name=None,
                    fullyQualifiedName="aaron_johnson0",
                    description=None,
                    displayName=None,
                    deleted=None,
                    href=AnyUrl(
                        "http://localhost:8585/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
                    ),
                )
            ]
        ),
        tags=[
            TagLabel(
                tagFQN="dbtTags.model_tag_one",
                description=None,
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            ),
            TagLabel(
                tagFQN="dbtTags.model_tag_two",
                description=None,
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            ),
            TagLabel(
                tagFQN='dbtTags."22.8.5.1"',
                description=None,
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            ),
        ],
        columns=[
            Column(
                name="customer_id",
                dataType="UNKNOWN",
                dataLength=1,
                description="This is a unique identifier for a customer",
            ),
            Column(
                name="first_name",
                dataType="UNKNOWN",
                dataLength=1,
                description="Customer's first name. PII.",
            ),
            Column(
                name="last_name",
                dataType="UNKNOWN",
                dataLength=1,
                description="Customer's last name. PII.",
            ),
        ],
        generatedAt=None,
    )
]

EXPECTED_DATA_MODEL_NULL_DB = [
    DataModel(
        modelType="DBT",
        description=None,
        path="sample/customers_null_db/root/path/models/staging/customers_null_db.sql",
        rawSql="sample customers_null_db raw_code",
        resourceType="model",
        sql="sample customers_null_db compiled code",
        upstream=[],
        owners=EntityReferenceList(
            root=[
                EntityReference(
                    id="cb2a92f5-e935-4ad7-911c-654280046538",
                    type="user",
                    name=None,
                    fullyQualifiedName="aaron_johnson0",
                    description=None,
                    displayName=None,
                    deleted=None,
                    href=AnyUrl(
                        "http://localhost:8585/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
                    ),
                )
            ]
        ),
        tags=[],
        columns=[
            Column(
                name="customer_id",
                displayName=None,
                dataType="UNKNOWN",
                dataLength=1,
                description="This is a unique identifier for an customer",
            )
        ],
        generatedAt=None,
    ),
]

EXPECTED_DATA_MODEL_VERSIONLESS = [
    DataModel(
        modelType="DBT",
        resourceType="model",
        dbtSourceProject="jaffle_shop",
        description="This table has basic information about a customer, as well as some derived facts based on a customer's orders",
        path="models/customers.sql",
        rawSql="sample customers raw code",
        sql="sample customers compile code",
        upstream=[
            "dbt_test.dev.dbt_jaffle.customers",
            "dbt_test.dev.dbt_jaffle.customers",
            "dbt_test.dev.dbt_jaffle.customers",
        ],
        owners=EntityReferenceList(
            root=[
                EntityReference(
                    id="cb2a92f5-e935-4ad7-911c-654280046538",
                    type="user",
                    fullyQualifiedName="aaron_johnson0",
                    href=AnyUrl(
                        "http://localhost:8585/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538"
                    ),
                )
            ]
        ),
        tags=[
            TagLabel(
                tagFQN="dbtTags.model_tag_one",
                source="Classification",
                labelType="Automated",
                state="Suggested",
            ),
            TagLabel(
                tagFQN="dbtTags.model_tag_two",
                source="Classification",
                labelType="Automated",
                state="Suggested",
            ),
        ],
        columns=[
            Column(
                name="customer_id",
                dataType="UNKNOWN",
                dataLength=1,
                description="This is a unique identifier for a customer",
            ),
            Column(
                name="first_name",
                dataType="UNKNOWN",
                dataLength=1,
                description="Customer's first name. PII.",
            ),
            Column(
                name="last_name",
                dataType="UNKNOWN",
                dataLength=1,
                description="Customer's last name. PII.",
            ),
            Column(
                name="first_order",
                dataType="UNKNOWN",
                dataLength=1,
                description="Date (UTC) of a customer's first order",
            ),
            Column(
                name="most_recent_order",
                dataType="UNKNOWN",
                dataLength=1,
                description="Date (UTC) of a customer's most recent order",
            ),
            Column(
                name="number_of_orders",
                dataType="UNKNOWN",
                dataLength=1,
                description="Count of the number of orders a customer has placed",
            ),
            Column(
                name="total_order_amount",
                dataType="UNKNOWN",
                dataLength=1,
                description="Total value (AUD) of a customer's orders",
            ),
        ],
    )
]

EXPECTED_EXPOSURE_ENTITIES = [
    Dashboard(
        id=uuid.uuid4(),
        name="looker_dashboard",
        service=entityReference.EntityReference(id=uuid.uuid4(), type="dashboard"),
    ),
    MlModel(
        id=uuid.uuid4(),
        name="mlflow_model",
        algorithm="lr",
        service=entityReference.EntityReference(id=uuid.uuid4(), type="mlModel"),
    ),
    APIEndpoint(
        id=uuid.uuid4(),
        name="createTable",
        endpointURL="http://localhost:8000",
        service=entityReference.EntityReference(id=uuid.uuid4(), type="apiEndpoint"),
    ),
]

MOCK_OWNER = EntityReferenceList(
    root=[
        EntityReference(
            id="cb2a92f5-e935-4ad7-911c-654280046538",
            type="user",
            name=None,
            fullyQualifiedName="aaron_johnson0",
            description=None,
            displayName=None,
            deleted=None,
            href=AnyUrl(
                "http://localhost:8585/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
            ),
        )
    ]
)

MOCK_USER = EntityReference(
    id="70064aef-f085-4658-a11a-b5f46568e980",
    name="aaron_johnson0",
    type="user",
    href="http://localhost:8585/api/v1/users/d96eccb9-9a9b-40ad-9585-0a8a71665c51",
    fullyQualifiedName="aaron_johnson0",
)

MOCK_TABLE_ENTITIES = [
    Table(
        id=uuid.uuid4(),
        name="customers",
        databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
        fullyQualifiedName="dbt_test.dev.dbt_jaffle.customers",
        columns=[],
    )
]

MOCK_NULL_DB_TABLE = [
    Table(
        id=uuid.uuid4(),
        name="customers_null_db",
        databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
        fullyQualifiedName="dbt_test.dev.dbt_jaffle.customers_null_db",
        columns=[],
    ),
]

MOCK_TAG_LABELS = [
    TagLabel(
        tagFQN="dbtTags.tag1",
        labelType=LabelType.Automated,
        state=State.Suggested,
        source=TagSource.Classification,
    ),
    TagLabel(
        tagFQN='dbtTags."tag2.name"',
        labelType=LabelType.Automated,
        state=State.Suggested,
        source=TagSource.Classification,
    ),
    TagLabel(
        tagFQN="dbtTags.tag3",
        labelType=LabelType.Automated,
        state=State.Suggested,
        source=TagSource.Classification,
    ),
]

MOCK_GLOASSARY_LABELS = [
    TagLabel(
        tagFQN="Test_Glossary.term_one",
        labelType=LabelType.Automated,
        state=State.Suggested,
        source=TagSource.Glossary,
    ),
    TagLabel(
        tagFQN="Test_Glossary.term_two.nested_term.more_nested_term",
        labelType=LabelType.Automated,
        state=State.Suggested,
        source=TagSource.Glossary,
    ),
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
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_dbt_config)
        self.dbt_source_obj = DbtSource.create(
            mock_dbt_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        set_loggers_level("DEBUG")

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.get_dbt_owner")
    @patch("metadata.ingestion.ometa.mixins.es_mixin.ESMixin.es_search_from_fqn")
    def test_dbt_manifest_v4_v5_v6(self, es_search_from_fqn, get_dbt_owner):
        get_dbt_owner.return_value = MOCK_OWNER
        es_search_from_fqn.side_effect = MOCK_TABLE_ENTITIES
        self.execute_test(
            MOCK_SAMPLE_MANIFEST_V4_V5_V6,
            expected_records=2,
            expected_data_models=EXPECTED_DATA_MODELS,
        )

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.get_dbt_owner")
    @patch("metadata.ingestion.ometa.mixins.es_mixin.ESMixin.es_search_from_fqn")
    def test_dbt_manifest_v7(self, es_search_from_fqn, get_dbt_owner):
        get_dbt_owner.return_value = MOCK_OWNER
        es_search_from_fqn.side_effect = MOCK_TABLE_ENTITIES
        self.execute_test(
            MOCK_SAMPLE_MANIFEST_V7,
            expected_records=2,
            expected_data_models=EXPECTED_DATA_MODELS,
        )

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.get_dbt_owner")
    @patch("metadata.ingestion.ometa.mixins.es_mixin.ESMixin.es_search_from_fqn")
    @patch("metadata.utils.tag_utils.get_tag_label")
    def test_dbt_manifest_v8(self, get_tag_label, es_search_from_fqn, get_dbt_owner):
        get_dbt_owner.return_value = MOCK_OWNER
        es_search_from_fqn.return_value = MOCK_TABLE_ENTITIES
        get_tag_label.side_effect = [
            TagLabel(
                tagFQN="dbtTags.model_tag_one",
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Classification.value,
            ),
            TagLabel(
                tagFQN="dbtTags.model_tag_two",
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Classification.value,
            ),
            TagLabel(
                tagFQN='dbtTags."22.8.5.1"',
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Classification.value,
            ),
        ]
        self.execute_test(
            MOCK_SAMPLE_MANIFEST_V8,
            expected_records=2,
            expected_data_models=EXPECTED_DATA_MODELS,
        )

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.get_dbt_owner")
    @patch("metadata.ingestion.ometa.mixins.es_mixin.ESMixin.es_search_from_fqn")
    @patch("metadata.utils.tag_utils.get_tag_label")
    def test_dbt_manifest_versionless(
        self, get_tag_label, es_search_from_fqn, get_dbt_owner
    ):
        get_dbt_owner.return_value = MOCK_OWNER
        es_search_from_fqn.return_value = MOCK_TABLE_ENTITIES
        get_tag_label.side_effect = [
            TagLabel(
                tagFQN="dbtTags.model_tag_one",
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Classification.value,
            ),
            TagLabel(
                tagFQN="dbtTags.model_tag_two",
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Classification.value,
            ),
        ]
        self.execute_test(
            MOCK_SAMPLE_MANIFEST_VERSIONLESS,
            expected_records=12,
            expected_data_models=EXPECTED_DATA_MODEL_VERSIONLESS,
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

    def test_dbt_get_corrected_name(self):
        self.assertEqual("dbt_jaffle", get_corrected_name(name="dbt_jaffle"))
        self.assertIsNone(get_corrected_name(name="None"))
        self.assertIsNone(get_corrected_name(name="null"))
        self.assertIsNotNone(get_corrected_name(name="dev"))

    @patch("metadata.utils.tag_utils.get_tag_label")
    def test_dbt_get_dbt_tag_labels(self, get_tag_label):
        get_tag_label.side_effect = [
            TagLabel(
                tagFQN="dbtTags.tag1",
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Classification.value,
            ),
            TagLabel(
                tagFQN='dbtTags."tag2.name"',
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Classification.value,
            ),
            TagLabel(
                tagFQN="dbtTags.tag3",
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Classification.value,
            ),
        ]

        mocked_metadata = MagicMock()
        result = get_tag_labels(
            metadata=mocked_metadata,
            classification_name="dbtTags",
            tags=["tag1", "tag2.name", "tag3"],
            include_tags=True,
        )
        self.assertListEqual(result, MOCK_TAG_LABELS)

    def test_dbt_get_data_model_path(self):
        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_V8
        )
        manifest_node = dbt_objects.dbt_manifest.nodes.get(
            "model.jaffle_shop.customers"
        )
        result = get_data_model_path(manifest_node=manifest_node)
        self.assertEqual("sample/customers/root/path/models/customers.sql", result)

    def test_dbt_generate_entity_link(self):
        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_TEST_NODE
        )
        manifest_node = dbt_objects.dbt_manifest.nodes.get(
            "test.jaffle_shop.unique_orders_order_id.fed79b3a6e"
        )
        dbt_test = {
            "manifest_node": manifest_node,
            "upstream": ["local_redshift_dbt2.dev.dbt_jaffle.stg_customers"],
            "results": "",
        }
        result = generate_entity_link(dbt_test=dbt_test)
        self.assertListEqual(
            [
                "<#E::table::local_redshift_dbt2.dev.dbt_jaffle.stg_customers::columns::order_id>"
            ],
            result,
        )

    def test_dbt_generate_entity_link_with_column(self):
        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_TEST_NODE
        )
        manifest_node = dbt_objects.dbt_manifest.nodes.get(
            "test.jaffle_shop.unique_orders_order_id.fed79b3a6e"
        )
        dbt_test = {
            "manifest_node": manifest_node,
            "upstream": ["local_redshift_dbt2.dev.dbt_jaffle.stg_customers"],
            "results": "",
        }
        result = generate_entity_link(dbt_test=dbt_test)
        self.assertTrue(len(result) > 0)
        self.assertIn("::columns::order_id>", result[0])

    def test_dbt_generate_entity_link_without_column(self):
        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_TEST_NODE
        )
        manifest_node = dbt_objects.dbt_manifest.nodes.get(
            "test.jaffle_shop.unique_orders_order_id.fed79b3a6e"
        )
        if hasattr(manifest_node, "column_name"):
            delattr(manifest_node, "column_name")
        dbt_test = {
            "manifest_node": manifest_node,
            "upstream": ["local_redshift_dbt2.dev.dbt_jaffle.stg_customers"],
            "results": "",
        }
        result = generate_entity_link(dbt_test=dbt_test)
        self.assertTrue(len(result) > 0)
        self.assertNotIn("::columns::", result[0])
        self.assertIn(
            "<#E::table::local_redshift_dbt2.dev.dbt_jaffle.stg_customers>", result[0]
        )

    def test_dbt_compiled_query(self):
        expected_query = "sample customers compile code"

        # Test the compiled queries with v8 manifest
        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_V8
        )
        manifest_node = dbt_objects.dbt_manifest.nodes.get(
            "model.jaffle_shop.customers"
        )
        result = get_dbt_compiled_query(mnode=manifest_node)
        self.assertEqual(expected_query, result)

        # Test the compiled queries with v4 v5 v6 manifest
        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_V4_V5_V6
        )
        manifest_node = dbt_objects.dbt_manifest.nodes.get(
            "model.jaffle_shop.customers"
        )
        result = get_dbt_compiled_query(mnode=manifest_node)
        self.assertEqual(expected_query, result)

    def test_dbt_raw_query(self):
        expected_query = "sample customers raw code"

        # Test the raw queries with v8 manifest
        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_V8
        )
        manifest_node = dbt_objects.dbt_manifest.nodes.get(
            "model.jaffle_shop.customers"
        )
        result = get_dbt_raw_query(mnode=manifest_node)
        self.assertEqual(expected_query, result)

        # Test the raw queries with v4 v5 v6 manifest
        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_V4_V5_V6
        )
        manifest_node = dbt_objects.dbt_manifest.nodes.get(
            "model.jaffle_shop.customers"
        )
        result = get_dbt_raw_query(mnode=manifest_node)
        self.assertEqual(expected_query, result)

        # Test the raw queries with versionless manifest
        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_VERSIONLESS
        )
        manifest_node = dbt_objects.dbt_manifest.nodes.get(
            "model.jaffle_shop.customers"
        )
        result = get_dbt_raw_query(mnode=manifest_node)
        self.assertEqual(expected_query, result)

    @patch(
        "metadata.ingestion.ometa.mixins.user_mixin.OMetaUserMixin.get_reference_by_name"
    )
    def test_dbt_owner(self, get_reference_by_name):
        """
        This test requires having the sample data properly indexed
        """
        get_reference_by_name.return_value = MOCK_USER
        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_V8
        )
        manifest_node = dbt_objects.dbt_manifest.nodes.get(
            "model.jaffle_shop.customers"
        )
        result = self.dbt_source_obj.get_dbt_owner(
            manifest_node=manifest_node, catalog_node=None
        )
        self.assertEqual(
            "70064aef-f085-4658-a11a-b5f46568e980", result.id.root.__str__()
        )

    @patch(
        "metadata.ingestion.ometa.mixins.user_mixin.OMetaUserMixin.get_reference_by_name"
    )
    def test_get_dbt_owner_priority_1_openmetadata_owner(self, get_reference_by_name):
        """
        Test Priority 1: meta.openmetadata.owner (new format)
        """
        get_reference_by_name.return_value = MOCK_USER

        # Create a mock manifest node with openmetadata.owner
        mock_manifest_node = MagicMock()
        mock_manifest_node.meta = {"openmetadata": {"owner": "test_owner"}}

        result = self.dbt_source_obj.get_dbt_owner(
            manifest_node=mock_manifest_node, catalog_node=None
        )

        self.assertEqual(result, MOCK_USER)
        get_reference_by_name.assert_called_once_with(name="test_owner", is_owner=True)

    @patch(
        "metadata.ingestion.ometa.mixins.user_mixin.OMetaUserMixin.get_reference_by_name"
    )
    def test_get_dbt_owner_priority_2_old_format_owner(self, get_reference_by_name):
        """
        Test Priority 2: meta.owner (old format) when openmetadata.owner is not present
        """
        get_reference_by_name.return_value = MOCK_USER

        # Create a mock manifest node with old format owner
        mock_manifest_node = MagicMock()
        mock_manifest_node.meta = {"owner": "old_format_owner"}

        result = self.dbt_source_obj.get_dbt_owner(
            manifest_node=mock_manifest_node, catalog_node=None
        )

        self.assertEqual(result, MOCK_USER)
        get_reference_by_name.assert_called_once_with(
            name="old_format_owner", is_owner=True
        )

    @patch(
        "metadata.ingestion.ometa.mixins.user_mixin.OMetaUserMixin.get_reference_by_name"
    )
    def test_get_dbt_owner_priority_3_catalog_node_owner(self, get_reference_by_name):
        """
        Test Priority 3: catalog_node.metadata.owner when manifest node owners are not present
        """
        get_reference_by_name.return_value = MOCK_USER

        # Create mock manifest node without owner
        mock_manifest_node = MagicMock()
        mock_manifest_node.meta = {}

        # Create mock catalog node with owner
        mock_catalog_node = MagicMock()
        mock_catalog_node.metadata.owner = "catalog_owner"

        result = self.dbt_source_obj.get_dbt_owner(
            manifest_node=mock_manifest_node, catalog_node=mock_catalog_node
        )

        self.assertEqual(result, MOCK_USER)
        get_reference_by_name.assert_called_once_with(
            name="catalog_owner", is_owner=True
        )

    @patch(
        "metadata.ingestion.ometa.mixins.user_mixin.OMetaUserMixin.get_reference_by_name"
    )
    def test_get_dbt_owner_priority_order(self, get_reference_by_name):
        """
        Test that priorities are respected in order: openmetadata.owner > meta.owner > catalog.owner
        """
        get_reference_by_name.return_value = MOCK_USER

        # Create mock manifest node with both openmetadata.owner and meta.owner
        mock_manifest_node = MagicMock()
        mock_manifest_node.meta = {
            "openmetadata": {"owner": "priority_1_owner"},
            "owner": "priority_2_owner",
        }

        # Create mock catalog node with owner
        mock_catalog_node = MagicMock()
        mock_catalog_node.metadata.owner = "priority_3_owner"

        result = self.dbt_source_obj.get_dbt_owner(
            manifest_node=mock_manifest_node, catalog_node=mock_catalog_node
        )

        # Should use priority 1 (openmetadata.owner)
        self.assertEqual(result, MOCK_USER)
        get_reference_by_name.assert_called_once_with(
            name="priority_1_owner", is_owner=True
        )

    @patch(
        "metadata.ingestion.ometa.mixins.user_mixin.OMetaUserMixin.get_reference_by_name"
    )
    def test_get_dbt_owner_list_owners(self, get_reference_by_name):
        """
        Test handling of list of owners
        """
        get_reference_by_name.return_value = MOCK_USER

        # Create a mock manifest node with list of owners
        mock_manifest_node = MagicMock()
        mock_manifest_node.meta = {
            "openmetadata": {"owner": ["owner1", "owner2", "owner3"]}
        }

        result = self.dbt_source_obj.get_dbt_owner(
            manifest_node=mock_manifest_node, catalog_node=None
        )

        self.assertIsNone(result)
        self.assertEqual(get_reference_by_name.call_count, 1)

    @patch(
        "metadata.ingestion.ometa.mixins.user_mixin.OMetaUserMixin.get_reference_by_name"
    )
    def test_get_dbt_owner_list_owners_partial_failure(self, get_reference_by_name):
        """
        Test handling of list of owners where some owners are not found
        """
        # First two owners found, third one not found
        get_reference_by_name.side_effect = [MOCK_USER, MOCK_USER, None]

        # Create a mock manifest node with list of owners
        mock_manifest_node = MagicMock()
        mock_manifest_node.meta = {
            "openmetadata": {"owner": ["owner1", "owner2", "owner3"]}
        }

        result = self.dbt_source_obj.get_dbt_owner(
            manifest_node=mock_manifest_node, catalog_node=None
        )

        self.assertIsNone(result)
        self.assertEqual(get_reference_by_name.call_count, 1)

    @patch(
        "metadata.ingestion.ometa.mixins.user_mixin.OMetaUserMixin.get_reference_by_name"
    )
    def test_get_dbt_owner_catalog_node_exception(self, get_reference_by_name):
        """
        Test handling of catalog node access exception
        """
        get_reference_by_name.return_value = MOCK_USER

        # Create mock manifest node without owner
        mock_manifest_node = MagicMock()
        mock_manifest_node.meta = {}

        # Create mock catalog node that raises exception when accessing metadata.owner
        mock_catalog_node = MagicMock()
        mock_catalog_node.metadata.owner = PropertyMock(
            side_effect=AttributeError("No attribute")
        )

        result = self.dbt_source_obj.get_dbt_owner(
            manifest_node=mock_manifest_node, catalog_node=mock_catalog_node
        )

        # Should return None due to exception
        self.assertIsNone(result)

    @patch(
        "metadata.ingestion.ometa.mixins.user_mixin.OMetaUserMixin.get_reference_by_name"
    )
    def test_get_dbt_owner_no_owner_found(self, get_reference_by_name):
        """
        Test when no owner is found in any source
        """
        get_reference_by_name.return_value = None

        # Create mock manifest node without owner
        mock_manifest_node = MagicMock()
        mock_manifest_node.meta = {}

        result = self.dbt_source_obj.get_dbt_owner(
            manifest_node=mock_manifest_node, catalog_node=None
        )

        # Should return None
        self.assertIsNone(result)

    @patch(
        "metadata.ingestion.ometa.mixins.user_mixin.OMetaUserMixin.get_reference_by_name"
    )
    def test_get_dbt_owner_email_lookup(self, get_reference_by_name):
        """
        Test email lookup when name lookup fails
        """
        # First call (name lookup) returns None, second call (email lookup) returns user
        get_reference_by_name.side_effect = [None, MOCK_USER]

        # Mock get_reference_by_email method
        with patch.object(
            self.dbt_source_obj.metadata,
            "get_reference_by_email",
            return_value=MOCK_USER,
        ):
            mock_manifest_node = MagicMock()
            mock_manifest_node.meta = {"openmetadata": {"owner": "test@example.com"}}

            result = self.dbt_source_obj.get_dbt_owner(
                manifest_node=mock_manifest_node, catalog_node=None
            )

            self.assertEqual(result, MOCK_USER)

    @patch(
        "metadata.ingestion.ometa.mixins.user_mixin.OMetaUserMixin.get_reference_by_name"
    )
    def test_get_dbt_owner_general_exception(self, get_reference_by_name):
        """
        Test handling of general exceptions in get_dbt_owner
        """
        get_reference_by_name.side_effect = Exception("General error")

        mock_manifest_node = MagicMock()
        mock_manifest_node.meta = {"openmetadata": {"owner": "test_owner"}}

        result = self.dbt_source_obj.get_dbt_owner(
            manifest_node=mock_manifest_node, catalog_node=None
        )

        # Should return None due to exception
        self.assertIsNone(result)

    @patch(
        "metadata.ingestion.ometa.mixins.user_mixin.OMetaUserMixin.get_reference_by_name"
    )
    def test_get_dbt_owner_none_manifest_node(self, get_reference_by_name):
        """
        Test handling when manifest_node is None
        """
        result = self.dbt_source_obj.get_dbt_owner(
            manifest_node=None, catalog_node=None
        )

        # Should return None
        self.assertIsNone(result)
        # Should not call get_reference_by_name
        get_reference_by_name.assert_not_called()

    @patch(
        "metadata.ingestion.ometa.mixins.user_mixin.OMetaUserMixin.get_reference_by_name"
    )
    def test_get_dbt_owner_empty_meta(self, get_reference_by_name):
        """
        Test handling when manifest_node.meta is empty or None
        """
        get_reference_by_name.return_value = MOCK_USER

        # Test with empty meta
        mock_manifest_node = MagicMock()
        mock_manifest_node.meta = {}

        result = self.dbt_source_obj.get_dbt_owner(
            manifest_node=mock_manifest_node, catalog_node=None
        )

        # Should return None since no owner found
        self.assertIsNone(result)

        # Test with None meta
        mock_manifest_node.meta = None

        result = self.dbt_source_obj.get_dbt_owner(
            manifest_node=mock_manifest_node, catalog_node=None
        )

        # Should return None since no owner found
        self.assertIsNone(result)

    def execute_test(self, mock_manifest, expected_records, expected_data_models):
        dbt_files, dbt_objects = self.get_dbt_object_files(mock_manifest)
        self.check_dbt_validate(dbt_files=dbt_files, expected_records=expected_records)
        self.check_yield_datamodel(
            dbt_objects=dbt_objects, expected_data_models=expected_data_models
        )

    def get_dbt_object_files(self, mock_manifest):
        mock_file_path = Path(__file__).parent / mock_manifest
        with open(mock_file_path) as file:
            mock_data: dict = json.load(file)
        self.dbt_source_obj.remove_manifest_non_required_keys(manifest_dict=mock_data)
        dbt_files = DbtFiles(dbt_manifest=mock_data)
        dbt_objects = DbtObjects(
            dbt_catalog=parse_catalog(dbt_files.dbt_catalog)
            if dbt_files.dbt_catalog
            else None,
            dbt_manifest=parse_manifest(dbt_files.dbt_manifest),
            dbt_run_results=[parse_run_results(dbt_files.dbt_run_results)]
            if dbt_files.dbt_run_results
            else None,
        )
        return dbt_files, dbt_objects

    def check_dbt_validate(self, dbt_files, expected_records):
        with self.assertLogs(level="DEBUG", logger=logger) as captured:
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
            if isinstance(data_model_link, Either) and data_model_link.right:
                self.assertIn(
                    data_model_link.right.table_entity.fullyQualifiedName.root,
                    EXPECTED_DATA_MODEL_FQNS,
                )
                self.check_process_dbt_owners(data_model_link.right)
                data_model_list.append(data_model_link.right.datamodel)

        for _, (expected, original) in enumerate(
            zip(expected_data_models, data_model_list)
        ):
            self.assertEqual(expected, original)

    def check_process_dbt_owners(self, data_model_link):
        process_dbt_owners = self.dbt_source_obj.process_dbt_owners(data_model_link)
        for entity in process_dbt_owners:
            entity_owner = entity.right.new_entity.owners
            self.assertEqual(entity_owner, MOCK_OWNER)

    @patch("metadata.ingestion.ometa.mixins.es_mixin.ESMixin.es_search_from_fqn")
    def test_upstream_nodes_for_lineage(self, es_search_from_fqn):
        expected_upstream_nodes = [
            "model.jaffle_shop.stg_customers",
            "model.jaffle_shop.stg_orders",
            "model.jaffle_shop.stg_payments",
        ]
        es_search_from_fqn.return_value = MOCK_TABLE_ENTITIES

        # Test the raw queries with V4 V5 V6 manifest
        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_V4_V5_V6
        )
        upstream_nodes = dbt_objects.dbt_manifest.nodes.get(
            "model.jaffle_shop.customers"
        ).depends_on.nodes
        self.assertEqual(expected_upstream_nodes, upstream_nodes)

        # Test the raw queries with V7 manifest
        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_V7
        )
        upstream_nodes = dbt_objects.dbt_manifest.nodes.get(
            "model.jaffle_shop.customers"
        ).depends_on.nodes
        self.assertEqual(expected_upstream_nodes, upstream_nodes)

        # Test the raw queries with VERSIONLESS manifest
        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_VERSIONLESS
        )
        upstream_nodes = dbt_objects.dbt_manifest.nodes.get(
            "model.jaffle_shop.customers"
        ).depends_on.nodes

        self.assertEqual(expected_upstream_nodes, upstream_nodes)

    @patch("metadata.utils.tag_utils.get_tag_label")
    def test_dbt_glossary_tiers(self, get_tag_label):
        get_tag_label.side_effect = [
            TagLabel(
                tagFQN="Test_Glossary.term_one",
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Glossary.value,
            ),
            TagLabel(
                tagFQN="Test_Glossary.term_two.nested_term.more_nested_term",
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Glossary.value,
            ),
        ]

        _, dbt_objects = self.get_dbt_object_files(
            mock_manifest=MOCK_SAMPLE_MANIFEST_V8
        )
        manifest_node = dbt_objects.dbt_manifest.nodes.get(
            "model.jaffle_shop.customers"
        )
        dbt_meta_tags = self.dbt_source_obj.process_dbt_meta(
            manifest_meta=manifest_node.meta, table_fqn="test.schema.customers"
        )

        self.assertEqual(dbt_meta_tags, MOCK_GLOASSARY_LABELS)

    @patch("metadata.utils.tag_utils.get_tag_label")
    def test_dbt_classification_tags(self, get_tag_label):
        """Test processing classification tags from dbt meta.openmetadata.tags"""
        get_tag_label.side_effect = [
            TagLabel(
                tagFQN="PII.Sensitive",
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Classification.value,
            ),
            TagLabel(
                tagFQN="PersonalData.Email",
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Classification.value,
            ),
        ]

        # Create mock manifest meta with classification tags
        manifest_meta = {
            "openmetadata": {"tags": ["PII.Sensitive", "PersonalData.Email"]}
        }

        dbt_meta_tags = self.dbt_source_obj.process_dbt_meta(
            manifest_meta=manifest_meta,
            table_fqn="test_service.test_db.test_schema.test_table",
        )

        expected_tags = [
            TagLabel(
                tagFQN="PII.Sensitive",
                labelType=LabelType.Automated,
                state=State.Suggested,
                source=TagSource.Classification,
            ),
            TagLabel(
                tagFQN="PersonalData.Email",
                labelType=LabelType.Automated,
                state=State.Suggested,
                source=TagSource.Classification,
            ),
        ]

        self.assertEqual(dbt_meta_tags, expected_tags)

    @patch("metadata.utils.tag_utils.get_tag_label")
    def test_dbt_combined_meta_tags(self, get_tag_label):
        """Test processing combined glossary, tier, and classification tags"""
        get_tag_label.side_effect = [
            # Glossary term
            TagLabel(
                tagFQN="Test_Glossary.term_one",
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Glossary.value,
            ),
            # Tier tag
            TagLabel(
                tagFQN="Tier.Tier1",
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Classification.value,
            ),
            # Classification tags
            TagLabel(
                tagFQN="PII.Sensitive",
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Classification.value,
            ),
        ]

        # Create mock manifest meta with all types of tags
        manifest_meta = {
            "openmetadata": {
                "glossary": ["Test_Glossary.term_one"],
                "tier": "Tier.Tier1",
                "tags": ["PII.Sensitive"],
            }
        }

        dbt_meta_tags = self.dbt_source_obj.process_dbt_meta(
            manifest_meta=manifest_meta,
            table_fqn="test_service.test_db.test_schema.test_table",
        )

        # Should have 3 tags: 1 glossary + 1 tier + 1 classification
        self.assertEqual(len(dbt_meta_tags), 3)

    def test_dbt_classification_tags_edge_cases(self):
        """Test edge cases for classification tags processing"""

        # Test with empty tags list
        manifest_meta = {"openmetadata": {"tags": []}}
        dbt_meta_tags = self.dbt_source_obj.process_dbt_meta(
            manifest_meta=manifest_meta,
            table_fqn="test_service.test_db.test_schema.test_table",
        )
        self.assertEqual(dbt_meta_tags, [])

        # Test with invalid tag format (no dot separator)
        # These should be silently skipped
        manifest_meta = {
            "openmetadata": {"tags": ["InvalidTag"]}  # Missing classification part
        }
        dbt_meta_tags = self.dbt_source_obj.process_dbt_meta(
            manifest_meta=manifest_meta,
            table_fqn="test_service.test_db.test_schema.test_table",
        )
        # Should return empty list as invalid tags are skipped
        self.assertEqual(dbt_meta_tags, [])

        # Test with None tags
        manifest_meta = {"openmetadata": {"tags": None}}
        dbt_meta_tags = self.dbt_source_obj.process_dbt_meta(
            manifest_meta=manifest_meta,
            table_fqn="test_service.test_db.test_schema.test_table",
        )
        self.assertEqual(dbt_meta_tags, [])

    def test_parse_exposure_node_exposure_absent(self):
        _, dbt_objects = self.get_dbt_object_files(MOCK_SAMPLE_MANIFEST_V8)

        parsed_exposures = [
            self.dbt_source_obj.parse_exposure_node(node)
            for _, node in dbt_objects.dbt_manifest.exposures.items()
        ]

        assert len(list(filter(lambda x: x is not None, parsed_exposures))) == 0

    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.get_by_name")
    def test_parse_exposure_node_exposure_happy_path(self, get_by_name):
        get_by_name.side_effect = EXPECTED_EXPOSURE_ENTITIES
        _, dbt_objects = self.get_dbt_object_files(MOCK_SAMPLE_MANIFEST_VERSIONLESS)

        parsed_exposures = [
            self.dbt_source_obj.parse_exposure_node(node)
            for _, node in dbt_objects.dbt_manifest.exposures.items()
        ]

        assert len(list(filter(lambda x: x is not None, parsed_exposures))) == 3

    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.get_by_name")
    def test_parse_exposure_node_exposure_broken_exposures(self, get_by_name):
        """
        Test on data where there is one exposure with missing open_metadata_fqn and one with unsupported type.
        """
        get_by_name.side_effect = EXPECTED_EXPOSURE_ENTITIES
        _, dbt_objects = self.get_dbt_object_files(
            MOCK_SAMPLE_MANIFEST_VERSIONLESS_BROKEN_EXPOSURES
        )

        parsed_exposures = [
            self.dbt_source_obj.parse_exposure_node(node)
            for _, node in dbt_objects.dbt_manifest.exposures.items()
        ]

        assert len(list(filter(lambda x: x is not None, parsed_exposures))) == 0

    # Test Domain functionality

    @patch("metadata.ingestion.source.database.dbt.metadata.format_domain_reference")
    @patch("metadata.ingestion.source.database.dbt.metadata.find_domain_by_name")
    def test_get_dbt_domain_success(self, mock_find_domain, mock_format_domain):
        """
        Test successful domain extraction from meta.openmetadata.domain
        """
        test_uuid = str(uuid.uuid4())

        mock_domain = MagicMock()
        mock_find_domain.return_value = mock_domain

        mock_format_domain.return_value = {
            "id": test_uuid,
            "type": "domain",
            "name": "Finance",
            "fullyQualifiedName": "Finance",
        }

        manifest_node = MagicMock()
        manifest_node.meta = {"openmetadata": {"domain": "Finance"}}

        result = self.dbt_source_obj.get_dbt_domain(manifest_node=manifest_node)

        self.assertIsNotNone(result)
        self.assertEqual(str(result.id.root), test_uuid)
        self.assertEqual(result.type, "domain")
        self.assertEqual(result.name, "Finance")
        mock_find_domain.assert_called_once_with(
            self.dbt_source_obj.metadata, "Finance"
        )
        mock_format_domain.assert_called_once_with(mock_domain)

    @patch("metadata.ingestion.source.database.dbt.dbt_utils.find_domain_by_name")
    def test_get_dbt_domain_not_found(self, mock_find_domain):
        """
        Test when domain is specified but not found in OpenMetadata
        """
        mock_find_domain.return_value = None

        manifest_node = MagicMock()
        manifest_node.meta = {"openmetadata": {"domain": "NonExistentDomain"}}

        result = self.dbt_source_obj.get_dbt_domain(manifest_node=manifest_node)

        self.assertIsNone(result)

    def test_get_dbt_domain_no_meta(self):
        """
        Test when manifest node has no meta field
        """
        manifest_node = MagicMock()
        manifest_node.meta = None

        result = self.dbt_source_obj.get_dbt_domain(manifest_node=manifest_node)

        self.assertIsNone(result)

    def test_get_dbt_domain_no_openmetadata_section(self):
        """
        Test when meta exists but no openmetadata section
        """
        manifest_node = MagicMock()
        manifest_node.meta = {"some_field": "value"}

        result = self.dbt_source_obj.get_dbt_domain(manifest_node=manifest_node)

        self.assertIsNone(result)

    # Test custom_properties validation utilities

    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.get_by_name")
    def test_find_domain_by_name(self, mock_get_by_name):
        """
        Test domain lookup by name
        """
        mock_domain = MagicMock()
        mock_domain.id = "domain-456"
        mock_domain.name = "Marketing"
        mock_get_by_name.return_value = mock_domain

        result = find_domain_by_name(self.dbt_source_obj.metadata, "Marketing")

        self.assertIsNotNone(result)
        self.assertEqual(result.name, "Marketing")
        mock_get_by_name.assert_called_once_with(entity=Domain, fqn="Marketing")

    def test_format_domain_reference(self):
        """
        Test formatting of domain reference
        """
        mock_domain = MagicMock()
        mock_domain.id.root = "domain-789"
        mock_domain.name = "Sales"
        mock_domain.fullyQualifiedName.root = "Sales"

        result = format_domain_reference(mock_domain)

        self.assertIsNotNone(result)
        self.assertEqual(result["id"], "domain-789")
        self.assertEqual(result["type"], "domain")
        self.assertEqual(result["name"], "Sales")
        self.assertEqual(result["fullyQualifiedName"], "Sales")

    def test_format_domain_reference_with_exception(self):
        """
        Test domain reference formatting with malformed domain
        """

        # Test with None
        result = format_domain_reference(None)
        self.assertIsNone(result)

        # Test with an object that will cause AttributeError
        class BadDomain:
            def __getattr__(self, name):
                raise AttributeError(f"No attribute {name}")

        bad_domain = BadDomain()
        result = format_domain_reference(bad_domain)
        self.assertIsNone(result)

        # Test with empty object
        empty_obj = object()
        result = format_domain_reference(empty_obj)
        self.assertIsNone(result)

    # Test loading OMD custom properties definitions

    def test_load_omd_custom_properties_success(self):
        """
        Test loading of OMD custom properties definitions
        """
        mock_response = {
            "customProperties": [
                {
                    "name": "dataRetentionDays",
                    "propertyType": {"name": "integer"},
                    "description": "Data retention period",
                },
                {
                    "name": "businessOwner",
                    "propertyType": {"name": "entityReference"},
                    "description": "Business owner",
                },
            ]
        }

        original_get = self.dbt_source_obj.metadata.client.get
        self.dbt_source_obj.metadata.client.get = MagicMock(return_value=mock_response)
        self.dbt_source_obj.omd_custom_properties = {}

        self.dbt_source_obj._load_omd_custom_properties()

        self.assertEqual(len(self.dbt_source_obj.omd_custom_properties), 2)
        self.assertIn("dataRetentionDays", self.dbt_source_obj.omd_custom_properties)
        self.assertIn("businessOwner", self.dbt_source_obj.omd_custom_properties)

        self.dbt_source_obj.metadata.client.get = original_get

    def test_load_omd_custom_properties_error(self):
        """
        Test loading OMD custom properties with API error
        """
        original_get = self.dbt_source_obj.metadata.client.get
        self.dbt_source_obj.metadata.client.get = MagicMock(
            side_effect=Exception("API Error")
        )
        self.dbt_source_obj.omd_custom_properties = {}

        self.dbt_source_obj._load_omd_custom_properties()

        self.assertEqual(len(self.dbt_source_obj.omd_custom_properties), 0)

        self.dbt_source_obj.metadata.client.get = original_get

    # Test Domain processing functionality

    @patch("metadata.ingestion.source.database.dbt.metadata.find_domain_by_name")
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.patch_domain")
    def test_process_dbt_domain_success(self, mock_patch_domain, mock_find_domain):
        """
        Test successful processing of DBT domain with new implementation
        """
        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "service.db.schema.table1"

        data_model_link = MagicMock()
        data_model_link.table_entity = mock_table

        # Mock domain entity
        mock_domain_entity = MagicMock()
        mock_domain_entity.id.root = str(uuid.uuid4())
        mock_domain_entity.name.root = "Finance"
        mock_domain_entity.fullyQualifiedName.root = "Finance"

        mock_find_domain.return_value = mock_domain_entity
        mock_patch_domain.return_value = mock_table

        # Set up extracted domains
        self.dbt_source_obj.extracted_domains = {"service.db.schema.table1": "Finance"}

        self.dbt_source_obj.process_dbt_domain(data_model_link)

        mock_find_domain.assert_called_once()
        mock_patch_domain.assert_called_once()

    def test_process_dbt_domain_no_domain(self):
        """
        Test processing when no domain is set
        """
        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "service.db.schema.table1"

        data_model_link = MagicMock()
        data_model_link.table_entity = mock_table

        self.dbt_source_obj.extracted_domains = {}

        self.dbt_source_obj.process_dbt_domain(data_model_link)

    @patch("metadata.ingestion.source.database.dbt.metadata.find_domain_by_name")
    def test_process_dbt_domain_entity_not_found(self, mock_find_domain):
        """
        Test when domain entity is not found
        """
        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "service.db.schema.table1"

        data_model_link = MagicMock()
        data_model_link.table_entity = mock_table

        mock_find_domain.return_value = None

        self.dbt_source_obj.extracted_domains = {
            "service.db.schema.table1": "NonExistentDomain"
        }

        self.dbt_source_obj.process_dbt_domain(data_model_link)

    # Test Custom Properties processing functionality

    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.patch_custom_properties")
    def test_process_dbt_custom_properties_success(self, mock_patch_custom_properties):
        """
        Test successful processing of custom properties with new implementation
        """
        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "service.db.schema.table1"
        mock_table.id = str(uuid.uuid4())

        data_model_link = MagicMock()
        data_model_link.table_entity = mock_table

        # Set up OMD custom properties
        self.dbt_source_obj.omd_custom_properties = {
            "dataRetentionDays": {
                "name": "dataRetentionDays",
                "propertyType": {"name": "integer"},
            },
            "businessOwner": {
                "name": "businessOwner",
                "propertyType": {"name": "string"},
            },
        }

        custom_properties = {"dataRetentionDays": 90, "businessOwner": "john.doe"}

        self.dbt_source_obj.extracted_custom_properties = {
            "service.db.schema.table1": custom_properties
        }

        mock_patch_custom_properties.return_value = mock_table

        self.dbt_source_obj.process_dbt_custom_properties(data_model_link)

        mock_patch_custom_properties.assert_called_once()

    def test_process_dbt_custom_properties_no_properties(self):
        """
        Test processing when no custom properties are set
        """
        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "service.db.schema.table1"

        data_model_link = MagicMock()
        data_model_link.table_entity = mock_table

        self.dbt_source_obj.extracted_custom_properties = {}

        self.dbt_source_obj.process_dbt_custom_properties(data_model_link)

    def test_validate_custom_properties_success(self):
        """
        Test successful validation of custom properties
        """
        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "service.db.schema.table1"

        self.dbt_source_obj.omd_custom_properties = {
            "dataRetentionDays": {
                "name": "dataRetentionDays",
                "propertyType": {"name": "integer"},
            },
            "businessOwner": {
                "name": "businessOwner",
                "propertyType": {"name": "string"},
            },
        }

        custom_properties = {
            "dataRetentionDays": 90,
            "businessOwner": "john.doe",
        }

        result = self.dbt_source_obj._validate_custom_properties(
            mock_table, custom_properties
        )

        self.assertIsNotNone(result)
        self.assertEqual(len(result), 2)
        self.assertEqual(result["dataRetentionDays"], 90)
        self.assertEqual(result["businessOwner"], "john.doe")

    def test_validate_custom_properties_type_mismatch(self):
        """
        Test validation with type mismatches
        """
        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "service.db.schema.table1"

        self.dbt_source_obj.omd_custom_properties = {
            "dataRetentionDays": {
                "name": "dataRetentionDays",
                "propertyType": {"name": "integer"},
            }
        }

        custom_properties = {"dataRetentionDays": "ninety"}

        result = self.dbt_source_obj._validate_custom_properties(
            mock_table, custom_properties
        )

        self.assertIsNone(result)

    def test_validate_custom_properties_unknown_property(self):
        """
        Test validation with unknown custom property
        """
        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "service.db.schema.table1"

        self.dbt_source_obj.omd_custom_properties = {}

        custom_properties = {"unknownProperty": "value"}

        result = self.dbt_source_obj._validate_custom_properties(
            mock_table, custom_properties
        )

        self.assertIsNone(result)

    # New comprehensive tests for custom property validation

    def test_validate_email_format_valid(self):
        """Test valid email format"""
        self.assertTrue(validate_email_format("user@example.com"))
        self.assertTrue(validate_email_format("first.last+tag@domain.co.uk"))

    def test_validate_email_format_invalid(self):
        """Test invalid email format"""
        self.assertFalse(validate_email_format("notanemail"))
        self.assertFalse(validate_email_format("@example.com"))
        self.assertFalse(validate_email_format("user@"))

    def test_convert_java_to_python_format(self):
        """Test Java to Python date format conversion"""
        self.assertEqual(convert_java_to_python_format("yyyy-MM-dd"), "%Y-%m-%d")
        self.assertEqual(
            convert_java_to_python_format("yyyy-MM-dd HH:mm:ss"), "%Y-%m-%d %H:%M:%S"
        )
        self.assertEqual(convert_java_to_python_format("MMM dd, yyyy"), "%b %d, %Y")

    def test_validate_date_time_format_valid(self):
        """Test valid date/time format"""
        is_valid, error = validate_date_time_format(
            "2024-01-15", "yyyy-MM-dd", "date-cp"
        )
        self.assertTrue(is_valid)
        self.assertIsNone(error)

        is_valid, error = validate_date_time_format(
            "2024-01-15 14:30:00", "yyyy-MM-dd HH:mm:ss", "dateTime-cp"
        )
        self.assertTrue(is_valid)
        self.assertIsNone(error)

    def test_validate_date_time_format_invalid(self):
        """Test invalid date/time format"""
        is_valid, error = validate_date_time_format(
            "15-01-2024", "yyyy-MM-dd", "date-cp"
        )
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)

    def test_validate_enum_single_value_valid(self):
        """Test single enum value validation"""
        config = {"values": ["option1", "option2", "option3"], "multiSelect": False}
        is_valid, error, value = validate_enum_value("option1", config)
        self.assertTrue(is_valid)
        self.assertIsNone(error)
        self.assertEqual(value, "option1")

    def test_validate_enum_single_value_invalid(self):
        """Test invalid single enum value"""
        config = {"values": ["option1", "option2"], "multiSelect": False}
        is_valid, error, value = validate_enum_value("invalid", config)
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)

    def test_validate_enum_multi_select_all_valid(self):
        """Test multi-select enum with all valid values"""
        config = {"values": ["opt1", "opt2", "opt3"], "multiSelect": True}
        is_valid, error, value = validate_enum_value(["opt1", "opt2"], config)
        self.assertTrue(is_valid)
        self.assertIsNone(error)
        self.assertEqual(value, ["opt1", "opt2"])

    def test_validate_enum_multi_select_partial_valid(self):
        """Test multi-select enum with some invalid values (should filter)"""
        config = {"values": ["opt1", "opt2", "opt3"], "multiSelect": True}
        is_valid, error, value = validate_enum_value(
            ["opt1", "invalid", "opt2"], config
        )
        self.assertTrue(is_valid)
        self.assertIsNotNone(error)
        self.assertEqual(value, ["opt1", "opt2"])

    def test_validate_enum_multi_select_all_invalid(self):
        """Test multi-select enum with all invalid values"""
        config = {"values": ["opt1", "opt2"], "multiSelect": True}
        is_valid, error, value = validate_enum_value(["bad1", "bad2"], config)
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)

    def test_validate_table_structure_valid(self):
        """Test valid table structure"""
        config = {"columns": ["col1", "col2", "col3"]}
        value = {
            "columns": ["col1", "col2", "col3"],
            "rows": [
                {"col1": "val1", "col2": "val2", "col3": "val3"},
                {"col1": "val4", "col2": "val5", "col3": "val6"},
            ],
        }
        is_valid, error = validate_table_structure(value, config)
        self.assertTrue(is_valid)
        self.assertIsNone(error)

    def test_validate_table_structure_extra_columns(self):
        """Test table with extra columns"""
        config = {"columns": ["col1", "col2"]}
        value = {"columns": ["col1", "col2", "col3"]}
        is_valid, error = validate_table_structure(value, config)
        self.assertFalse(is_valid)
        self.assertIn("Extra columns", error)

    def test_validate_table_structure_missing_columns(self):
        """Test table with missing columns"""
        config = {"columns": ["col1", "col2", "col3"]}
        value = {"columns": ["col1", "col2"]}
        is_valid, error = validate_table_structure(value, config)
        self.assertFalse(is_valid)
        self.assertIn("Missing columns", error)

    def test_validate_time_interval_valid(self):
        """Test valid time interval"""
        value = {"start": 1000000000, "end": 2000000000}
        is_valid, error, result = validate_time_interval(value)
        self.assertTrue(is_valid)
        self.assertIsNone(error)
        self.assertEqual(result, value)

    def test_validate_time_interval_invalid_start_after_end(self):
        """Test time interval with start after end"""
        value = {"start": 2000000000, "end": 1000000000}
        is_valid, error, result = validate_time_interval(value)
        self.assertFalse(is_valid)
        self.assertIn("Start time", error)

    def test_validate_time_interval_missing_fields(self):
        """Test time interval with missing fields"""
        value = {"start": 1000000000}
        is_valid, error, result = validate_time_interval(value)
        self.assertFalse(is_valid)
        self.assertIn("Missing required", error)

    def test_validate_custom_property_value_string_type(self):
        """Test string type validation and conversion"""
        is_valid, error, value = validate_custom_property_value(
            "testProp", "string", None, "test value"
        )
        self.assertTrue(is_valid)
        self.assertIsNone(error)
        self.assertEqual(value, "test value")

    def test_validate_custom_property_value_integer_type(self):
        """Test integer type validation"""
        is_valid, error, value = validate_custom_property_value(
            "testProp", "integer", None, 42
        )
        self.assertTrue(is_valid)
        self.assertEqual(value, 42)

        is_valid, error, value = validate_custom_property_value(
            "testProp", "integer", None, "not an int"
        )
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)

    def test_validate_custom_property_value_number_type(self):
        """Test number type validation"""
        is_valid, error, value = validate_custom_property_value(
            "testProp", "number", None, 3.14
        )
        self.assertTrue(is_valid)
        self.assertEqual(value, 3.14)

        is_valid, error, value = validate_custom_property_value(
            "testProp", "number", None, 42
        )
        self.assertTrue(is_valid)
        self.assertEqual(value, 42.0)

    def test_validate_custom_property_value_email_type(self):
        """Test email type validation"""
        is_valid, error, value = validate_custom_property_value(
            "testProp", "email", None, "user@example.com"
        )
        self.assertTrue(is_valid)
        self.assertEqual(value, "user@example.com")

        is_valid, error, value = validate_custom_property_value(
            "testProp", "email", None, "invalid-email"
        )
        self.assertFalse(is_valid)

    def test_validate_custom_property_value_date_cp_type(self):
        """Test date-cp type validation"""
        is_valid, error, value = validate_custom_property_value(
            "testProp", "date-cp", "yyyy-MM-dd", "2024-01-15"
        )
        self.assertTrue(is_valid)
        self.assertEqual(value, "2024-01-15")

    def test_validate_custom_property_value_timestamp_type(self):
        """Test timestamp type validation"""
        is_valid, error, value = validate_custom_property_value(
            "testProp", "timestamp", None, 1640995200000
        )
        self.assertTrue(is_valid)
        self.assertEqual(value, 1640995200000)

        is_valid, error, value = validate_custom_property_value(
            "testProp", "timestamp", None, "not a timestamp"
        )
        self.assertFalse(is_valid)

    def test_validate_custom_property_value_duration_type(self):
        """Test duration type validation"""
        is_valid, error, value = validate_custom_property_value(
            "testProp", "duration", None, "P23DT23H"
        )
        self.assertTrue(is_valid)
        self.assertEqual(value, "P23DT23H")

        is_valid, error, value = validate_custom_property_value(
            "testProp", "duration", None, "23DT23H"
        )
        self.assertFalse(is_valid)

    def test_validate_custom_property_value_enum_type(self):
        """Test enum type validation with filtering"""
        config = {"values": ["opt1", "opt2", "opt3"], "multiSelect": True}
        is_valid, error, value = validate_custom_property_value(
            "testProp", "enum", config, ["opt1", "invalid", "opt2"]
        )
        self.assertTrue(is_valid)
        self.assertEqual(value, ["opt1", "opt2"])

    def test_validate_custom_property_value_none_value(self):
        """Test None value handling"""
        is_valid, error, value = validate_custom_property_value(
            "testProp", "string", None, None
        )
        self.assertFalse(is_valid)
        self.assertIn("cannot be None", error)

    def test_format_validation_error_message(self):
        """Test error message formatting"""
        msg = format_validation_error_message(
            "testField", "string", "invalid_value", "Some error detail"
        )
        self.assertIn("testField", msg)
        self.assertIn("string", msg)
        self.assertIn("Some error detail", msg)
        self.assertIn("invalid_value", msg)

    @patch(
        "metadata.ingestion.source.database.dbt.dbt_utils.find_entity_by_type_and_fqn"
    )
    def test_find_entity_by_type_and_fqn_success(self, mock_find):
        """Test entity lookup by type and FQN"""
        mock_entity = MagicMock()
        mock_entity.id.root = "entity-123"
        mock_entity.name.root = "test_table"

        # Test directly with OpenMetadata client
        with patch.object(
            self.dbt_source_obj.metadata, "get_by_name", return_value=mock_entity
        ):
            result = find_entity_by_type_and_fqn(
                self.dbt_source_obj.metadata, "table", "service.db.schema.test_table"
            )
            self.assertIsNotNone(result)

    def test_format_entity_reference(self):
        """Test entity reference formatting"""
        mock_entity = MagicMock()
        mock_entity.id.root = "entity-456"
        mock_entity.name.root = "test_user"
        mock_entity.fullyQualifiedName.root = "test_user"
        mock_entity.displayName.root = "Test User"
        mock_entity.description.root = "A test user"

        result = format_entity_reference(mock_entity, "user")

        self.assertEqual(result["id"], "entity-456")
        self.assertEqual(result["type"], "user")
        self.assertEqual(result["name"], "test_user")
        self.assertEqual(result["fullyQualifiedName"], "test_user")
        self.assertEqual(result["displayName"], "Test User")
        self.assertEqual(result["description"], "A test user")

    def test_dbt_source_project_name(self):
        """
        Test that the DBT source project name is correctly set in the data model
        """
        _, dbt_objects = self.get_dbt_object_files(MOCK_SAMPLE_MANIFEST_VERSIONLESS)

        # Get expected data models
        yield_data_models = self.dbt_source_obj.yield_data_models(
            dbt_objects=dbt_objects
        )

        for data_model_link in yield_data_models:
            if isinstance(data_model_link, Either) and data_model_link.right:
                data_model = data_model_link.right.datamodel

                # Check that the dbtSourceProject field is correctly set
                self.assertEqual(
                    data_model.dbtSourceProject,
                    "jaffle_shop",
                    "DBT source project should be set to 'jaffle_shop'",
                )

                # Verify the field exists and is not None
                self.assertIsNotNone(
                    data_model.dbtSourceProject,
                    "dbtSourceProject field should not be None",
                )

    def test_constants_required_constraint_keys(self):
        """Test REQUIRED_CONSTRAINT_KEYS constant"""
        from metadata.ingestion.source.database.dbt.constants import (
            REQUIRED_CONSTRAINT_KEYS,
        )

        expected_keys = [
            "type",
            "name",
            "expression",
            "warn_unenforced",
            "warn_unsupported",
        ]
        self.assertEqual(REQUIRED_CONSTRAINT_KEYS, expected_keys)

    def test_constants_required_results_keys(self):
        """Test REQUIRED_RESULTS_KEYS constant"""
        from metadata.ingestion.source.database.dbt.constants import (
            REQUIRED_RESULTS_KEYS,
        )

        expected_keys = {
            "status",
            "timing",
            "thread_id",
            "execution_time",
            "message",
            "adapter_response",
            "unique_id",
        }
        self.assertEqual(REQUIRED_RESULTS_KEYS, expected_keys)

    def test_constants_required_node_keys(self):
        """Test REQUIRED_NODE_KEYS constant"""
        from metadata.ingestion.source.database.dbt.constants import REQUIRED_NODE_KEYS

        expected_keys = {
            "schema_",
            "schema",
            "freshness",
            "name",
            "resource_type",
            "path",
            "unique_id",
            "source_name",
            "source_description",
            "source_meta",
            "loader",
            "identifier",
            "relation_name",
            "fqn",
            "alias",
            "checksum",
            "config",
            "column_name",
            "test_metadata",
            "original_file_path",
            "root_path",
            "database",
            "tags",
            "description",
            "columns",
            "meta",
            "owner",
            "created_at",
            "group",
            "sources",
            "compiled",
            "docs",
            "version",
            "latest_version",
            "package_name",
            "depends_on",
            "compiled_code",
            "compiled_sql",
            "raw_code",
            "raw_sql",
            "language",
        }
        self.assertEqual(REQUIRED_NODE_KEYS, expected_keys)

    def test_constants_none_keywords_list(self):
        """Test NONE_KEYWORDS_LIST constant"""
        from metadata.ingestion.source.database.dbt.constants import NONE_KEYWORDS_LIST

        expected_keywords = ["none", "null"]
        self.assertEqual(NONE_KEYWORDS_LIST, expected_keywords)

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.test_connection")
    def test_override_lineage_config_captured(self, test_connection):
        """Test that overrideLineage config is properly captured"""
        test_connection.return_value = False

        # Test with overrideLineage set to True
        config_with_override = deepcopy(mock_dbt_config)
        config_with_override["source"]["sourceConfig"]["config"][
            "overrideLineage"
        ] = True

        config = OpenMetadataWorkflowConfig.model_validate(config_with_override)
        dbt_source = DbtSource.create(
            config_with_override["source"],
            OpenMetadata(config.workflowConfig.openMetadataServerConfig),
        )

        self.assertTrue(dbt_source.source_config.overrideLineage)

        # Test default (when not set) is False
        self.assertFalse(self.dbt_source_obj.source_config.overrideLineage)

    def test_constants_exposure_type_map(self):
        """Test ExposureTypeMap constant"""
        from metadata.ingestion.source.database.dbt.constants import ExposureTypeMap

        self.assertIn("dashboard", ExposureTypeMap)
        self.assertIn("ml", ExposureTypeMap)
        self.assertIn("application", ExposureTypeMap)

        dashboard_mapping = ExposureTypeMap["dashboard"]
        self.assertEqual(dashboard_mapping["entity_type"], Dashboard)
        self.assertEqual(dashboard_mapping["entity_type_name"], "dashboard")

        ml_mapping = ExposureTypeMap["ml"]
        self.assertEqual(ml_mapping["entity_type"], MlModel)
        self.assertEqual(ml_mapping["entity_type_name"], "mlmodel")

        app_mapping = ExposureTypeMap["application"]
        self.assertEqual(app_mapping["entity_type"], APIEndpoint)
        self.assertEqual(app_mapping["entity_type_name"], "apiEndpoint")

    def test_parse_upstream_nodes_source_schema_handling(self):
        """Test that source nodes get schema name '*' in upstream parsing"""
        from metadata.ingestion.source.database.dbt.constants import DbtCommonEnum

        mock_source_node = MagicMock()
        mock_source_node.resource_type = DbtCommonEnum.SOURCE.value
        mock_source_node.database = "test_db"
        mock_source_node.schema_ = "test_schema"
        mock_source_node.name = "test_source"

        mock_model_node = MagicMock()
        mock_model_node.depends_on.nodes = ["source.test.test_source"]

        manifest_entities = {"source.test.test_source": mock_source_node}

        with patch.object(
            self.dbt_source_obj,
            "_get_table_entity",
            return_value=MOCK_TABLE_ENTITIES[0],
        ):
            with patch.object(
                self.dbt_source_obj,
                "is_filtered",
                return_value=MagicMock(is_filtered=False),
            ):
                with patch(
                    "metadata.ingestion.source.database.dbt.dbt_utils.get_dbt_model_name",
                    return_value="test_source",
                ):
                    with patch(
                        "metadata.ingestion.source.database.dbt.dbt_utils.get_corrected_name",
                        side_effect=lambda x: x,
                    ):
                        with patch("metadata.utils.fqn.build") as mock_fqn_build:
                            mock_fqn_build.return_value = (
                                "test.*.test_schema.test_source"
                            )

                            self.dbt_source_obj.parse_upstream_nodes(
                                manifest_entities, mock_model_node
                            )

                            # Verify that schema_name="*" was used for source node
                            calls = mock_fqn_build.call_args_list
                            schema_name_used = None
                            for call in calls:
                                if "schema_name" in call[1]:
                                    schema_name_used = call[1]["schema_name"]
                                    break
                            self.assertEqual(schema_name_used, "test_schema")

    def test_yield_data_models_processes_sources_key(self):
        """Test that yield_data_models processes both nodes and sources keys from manifest"""
        mock_manifest = MagicMock()
        mock_manifest.sources = {"source.test.table1": MagicMock()}
        mock_manifest.nodes = {"model.test.table2": MagicMock()}
        mock_manifest.exposures = {"exposure.test.dashboard1": MagicMock()}

        mock_dbt_objects = MagicMock()
        mock_dbt_objects.dbt_manifest = mock_manifest
        mock_dbt_objects.dbt_catalog = None
        mock_dbt_objects.dbt_run_results = None
        mock_dbt_objects.dbt_sources = None

        # Verify that manifest_entities includes both sources and nodes
        for data_model in self.dbt_source_obj.yield_data_models(mock_dbt_objects):
            pass

        # The method should process entities from sources, nodes, and exposures
        # We expect the context to be populated with the combined entities
        self.assertTrue(hasattr(self.dbt_source_obj.context.get(), "data_model_links"))
        self.assertTrue(hasattr(self.dbt_source_obj.context.get(), "exposures"))
        self.assertTrue(hasattr(self.dbt_source_obj.context.get(), "dbt_tests"))

    def test_yield_data_models_source_node_schema_handling(self):
        """Test that source nodes has correct schema name in yield_data_models"""
        from metadata.ingestion.source.database.dbt.constants import DbtCommonEnum

        # Create a mock source node
        mock_source_node = MagicMock()
        mock_source_node.resource_type = DbtCommonEnum.SOURCE.value
        mock_source_node.database = "test_db"
        mock_source_node.schema_ = "actual_schema"
        mock_source_node.name = "test_source"
        mock_source_node.description = "Test source description"
        mock_source_node.tags = []
        mock_source_node.meta = {}

        manifest_entities = {"source.test.test_source": mock_source_node}

        mock_dbt_objects = MagicMock()
        mock_dbt_objects.dbt_manifest.sources = manifest_entities
        mock_dbt_objects.dbt_manifest.nodes = {}
        mock_dbt_objects.dbt_manifest.exposures = {}
        mock_dbt_objects.dbt_catalog = None
        mock_dbt_objects.dbt_run_results = None
        mock_dbt_objects.dbt_sources = None

        with patch.object(
            self.dbt_source_obj,
            "is_filtered",
            return_value=MagicMock(is_filtered=False),
        ):
            with patch.object(
                self.dbt_source_obj,
                "_get_table_entity",
                return_value=MOCK_TABLE_ENTITIES[0],
            ):
                with patch(
                    "metadata.ingestion.source.database.dbt.dbt_utils.get_dbt_model_name",
                    return_value="test_source",
                ):
                    with patch(
                        "metadata.ingestion.source.database.dbt.dbt_utils.get_corrected_name",
                        side_effect=lambda x: x,
                    ):
                        with patch("metadata.utils.fqn.build") as mock_fqn_build:
                            mock_fqn_build.return_value = (
                                "test_service.test_db.*.test_source"
                            )

                            # Process the source node
                            list(
                                self.dbt_source_obj.yield_data_models(mock_dbt_objects)
                            )

                            # Verify that schema_name="*" was used for source node
                            calls = mock_fqn_build.call_args_list
                            schema_name_used = None
                            for call in calls:
                                if "schema_name" in call[1]:
                                    schema_name_used = call[1]["schema_name"]
                                    break
                            self.assertEqual(schema_name_used, "actual_schema")

    @patch("metadata.utils.tag_utils.get_ometa_tag_and_classification")
    @patch("metadata.utils.fqn.build")
    def test_yield_dbt_tags_deduplication(
        self, mock_fqn_build, mock_get_ometa_tag_and_classification
    ):
        """Test that duplicate tags are deduplicated before FQN building"""
        mock_fqn_build.side_effect = lambda _, __, classification_name, tag_name: (
            f"{classification_name}.{tag_name}"
        )
        mock_get_ometa_tag_and_classification.return_value = []

        mock_node_1 = MagicMock()
        mock_node_1.resource_type = "model"
        mock_node_1.tags = ["tag1", "tag2", "tag3"]
        mock_node_1.columns = {}

        mock_node_2 = MagicMock()
        mock_node_2.resource_type = "model"
        mock_node_2.tags = ["tag2", "tag3", "tag4"]
        mock_node_2.columns = {}

        mock_dbt_objects = MagicMock()
        mock_dbt_objects.dbt_manifest.nodes = {
            "model.test.table1": mock_node_1,
            "model.test.table2": mock_node_2,
        }
        mock_dbt_objects.dbt_manifest.sources = {}

        list(self.dbt_source_obj.yield_dbt_tags(mock_dbt_objects))

        call_args = mock_fqn_build.call_args_list
        tag_names_used = [call[1]["tag_name"] for call in call_args]

        self.assertEqual(len(tag_names_used), 4)
        self.assertEqual(set(tag_names_used), {"tag1", "tag2", "tag3", "tag4"})

    @patch("metadata.utils.tag_utils.get_ometa_tag_and_classification")
    @patch("metadata.utils.fqn.build")
    def test_yield_dbt_tags_column_deduplication(
        self, mock_fqn_build, mock_get_ometa_tag_and_classification
    ):
        """Test that duplicate tags from columns are deduplicated"""
        mock_fqn_build.side_effect = lambda _, __, classification_name, tag_name: (
            f"{classification_name}.{tag_name}"
        )
        mock_get_ometa_tag_and_classification.return_value = []

        mock_column_1 = MagicMock()
        mock_column_1.tags = ["col_tag1", "col_tag2"]

        mock_column_2 = MagicMock()
        mock_column_2.tags = ["col_tag2", "col_tag3"]

        mock_node = MagicMock()
        mock_node.resource_type = "model"
        mock_node.tags = ["model_tag", "col_tag1"]
        mock_node.columns = {"column1": mock_column_1, "column2": mock_column_2}

        mock_dbt_objects = MagicMock()
        mock_dbt_objects.dbt_manifest.nodes = {"model.test.table1": mock_node}
        mock_dbt_objects.dbt_manifest.sources = {}

        list(self.dbt_source_obj.yield_dbt_tags(mock_dbt_objects))

        call_args = mock_fqn_build.call_args_list
        tag_names_used = [call[1]["tag_name"] for call in call_args]

        self.assertEqual(len(tag_names_used), 4)
        self.assertEqual(
            set(tag_names_used), {"model_tag", "col_tag1", "col_tag2", "col_tag3"}
        )

    @patch("metadata.utils.tag_utils.get_ometa_tag_and_classification")
    @patch("metadata.utils.fqn.build")
    def test_yield_dbt_tags_empty_list(
        self, mock_fqn_build, mock_get_ometa_tag_and_classification
    ):
        """Test that empty tag list is handled correctly"""
        mock_get_ometa_tag_and_classification.return_value = []

        mock_node = MagicMock()
        mock_node.resource_type = "model"
        mock_node.tags = []
        mock_node.columns = {}

        mock_dbt_objects = MagicMock()
        mock_dbt_objects.dbt_manifest.nodes = {"model.test.table1": mock_node}
        mock_dbt_objects.dbt_manifest.sources = {}

        list(self.dbt_source_obj.yield_dbt_tags(mock_dbt_objects))

        mock_fqn_build.assert_not_called()

    @patch("metadata.utils.tag_utils.get_ometa_tag_and_classification")
    @patch("metadata.utils.fqn.build")
    def test_yield_dbt_tags_skip_resource_types(
        self, mock_fqn_build, mock_get_ometa_tag_and_classification
    ):
        """Test that skipped resource types are not processed"""
        from metadata.ingestion.source.database.dbt.constants import (
            SkipResourceTypeEnum,
        )

        mock_fqn_build.side_effect = lambda _, __, classification_name, tag_name: (
            f"{classification_name}.{tag_name}"
        )
        mock_get_ometa_tag_and_classification.return_value = []

        mock_node_skip = MagicMock()
        mock_node_skip.resource_type = SkipResourceTypeEnum.TEST.value
        mock_node_skip.tags = ["skip_tag"]
        mock_node_skip.columns = {}

        mock_node_process = MagicMock()
        mock_node_process.resource_type = "model"
        mock_node_process.tags = ["process_tag"]
        mock_node_process.columns = {}

        mock_dbt_objects = MagicMock()
        mock_dbt_objects.dbt_manifest.nodes = {
            "test.test.skip": mock_node_skip,
            "model.test.process": mock_node_process,
        }
        mock_dbt_objects.dbt_manifest.sources = {}

        list(self.dbt_source_obj.yield_dbt_tags(mock_dbt_objects))

        call_args = mock_fqn_build.call_args_list
        tag_names_used = [call[1]["tag_name"] for call in call_args]

        self.assertEqual(len(tag_names_used), 1)
        self.assertEqual(tag_names_used[0], "process_tag")


class TestDownloadDbtFiles(TestCase):
    """
    Test cases for download_dbt_files function to verify manifest enforcement
    """

    def test_download_dbt_files_manifest_found(self):
        """Test that download_dbt_files yields DbtFiles when manifest is found"""
        from metadata.ingestion.source.database.dbt.constants import (
            DBT_MANIFEST_FILE_NAME,
        )
        from metadata.ingestion.source.database.dbt.dbt_config import download_dbt_files

        mock_reader = MagicMock()
        mock_reader.read.return_value = '{"nodes": {}, "sources": {}}'

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.get_reader",
            return_value=mock_reader,
        ):
            blob_grouped = {"/path/to/dbt": [f"/path/to/dbt/{DBT_MANIFEST_FILE_NAME}"]}

            result = list(
                download_dbt_files(
                    blob_grouped_by_directory=blob_grouped,
                    config=MagicMock(),
                    client=None,
                    bucket_name=None,
                )
            )

            self.assertEqual(len(result), 1)
            self.assertIsNotNone(result[0].dbt_manifest)

    def test_download_dbt_files_no_manifest_raises_exception(self):
        """Test that download_dbt_files raises DBTConfigException when no manifest found"""
        from metadata.ingestion.source.database.dbt.constants import (
            DBT_CATALOG_FILE_NAME,
        )
        from metadata.ingestion.source.database.dbt.dbt_config import (
            DBTConfigException,
            download_dbt_files,
        )

        mock_reader = MagicMock()
        mock_reader.read.return_value = '{"nodes": {}}'

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.get_reader",
            return_value=mock_reader,
        ):
            # Only catalog file, no manifest
            blob_grouped = {"/path/to/dbt": [f"/path/to/dbt/{DBT_CATALOG_FILE_NAME}"]}

            with self.assertRaises(DBTConfigException) as context:
                list(
                    download_dbt_files(
                        blob_grouped_by_directory=blob_grouped,
                        config=MagicMock(),
                        client=None,
                        bucket_name=None,
                    )
                )

            self.assertIn("No valid dbt manifest.json found", str(context.exception))

    def test_download_dbt_files_empty_directory_raises_exception(self):
        """Test that download_dbt_files raises DBTConfigException for empty blob directory"""
        from metadata.ingestion.source.database.dbt.dbt_config import (
            DBTConfigException,
            download_dbt_files,
        )

        # Empty blob grouped dictionary
        blob_grouped = {}

        with self.assertRaises(DBTConfigException) as context:
            list(
                download_dbt_files(
                    blob_grouped_by_directory=blob_grouped,
                    config=MagicMock(),
                    client=None,
                    bucket_name=None,
                )
            )

        self.assertIn("No valid dbt manifest.json found", str(context.exception))
        self.assertIn("No dbt artifacts found", str(context.exception))

    def test_download_dbt_files_multiple_dirs_one_manifest_succeeds(self):
        """Test that download_dbt_files succeeds when at least one directory has manifest"""
        from metadata.ingestion.source.database.dbt.constants import (
            DBT_CATALOG_FILE_NAME,
            DBT_MANIFEST_FILE_NAME,
        )
        from metadata.ingestion.source.database.dbt.dbt_config import download_dbt_files

        mock_reader = MagicMock()
        mock_reader.read.return_value = '{"nodes": {}, "sources": {}}'

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.get_reader",
            return_value=mock_reader,
        ):
            blob_grouped = {
                # First directory has only catalog (will fail)
                "/path/to/dbt1": [f"/path/to/dbt1/{DBT_CATALOG_FILE_NAME}"],
                # Second directory has manifest (will succeed)
                "/path/to/dbt2": [f"/path/to/dbt2/{DBT_MANIFEST_FILE_NAME}"],
            }

            result = list(
                download_dbt_files(
                    blob_grouped_by_directory=blob_grouped,
                    config=MagicMock(),
                    client=None,
                    bucket_name=None,
                )
            )

            # Should have one successful result from the directory with manifest
            self.assertEqual(len(result), 1)
            self.assertIsNotNone(result[0].dbt_manifest)

    def test_download_dbt_files_multiple_dirs_no_manifest_raises(self):
        """Test that download_dbt_files raises when no directory has manifest"""
        from metadata.ingestion.source.database.dbt.constants import (
            DBT_CATALOG_FILE_NAME,
        )
        from metadata.ingestion.source.database.dbt.dbt_config import (
            DBTConfigException,
            download_dbt_files,
        )

        mock_reader = MagicMock()
        mock_reader.read.return_value = '{"nodes": {}}'

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.get_reader",
            return_value=mock_reader,
        ):
            # Neither directory has manifest
            blob_grouped = {
                "/path/to/dbt1": [f"/path/to/dbt1/{DBT_CATALOG_FILE_NAME}"],
                "/path/to/dbt2": [f"/path/to/dbt2/{DBT_CATALOG_FILE_NAME}"],
            }

            with self.assertRaises(DBTConfigException) as context:
                list(
                    download_dbt_files(
                        blob_grouped_by_directory=blob_grouped,
                        config=MagicMock(),
                        client=None,
                        bucket_name=None,
                    )
                )

            self.assertIn("No valid dbt manifest.json found", str(context.exception))

    def test_download_dbt_files_collects_errors(self):
        """Test that download_dbt_files collects and reports errors from failed directories"""
        from metadata.ingestion.source.database.dbt.constants import (
            DBT_CATALOG_FILE_NAME,
        )
        from metadata.ingestion.source.database.dbt.dbt_config import (
            DBTConfigException,
            download_dbt_files,
        )

        mock_reader = MagicMock()
        mock_reader.read.return_value = '{"nodes": {}}'

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.get_reader",
            return_value=mock_reader,
        ):
            blob_grouped = {
                "/path/to/dbt1": [f"/path/to/dbt1/{DBT_CATALOG_FILE_NAME}"],
                "/path/to/dbt2": [f"/path/to/dbt2/{DBT_CATALOG_FILE_NAME}"],
            }

            with self.assertRaises(DBTConfigException) as context:
                list(
                    download_dbt_files(
                        blob_grouped_by_directory=blob_grouped,
                        config=MagicMock(),
                        client=None,
                        bucket_name=None,
                    )
                )

            error_message = str(context.exception)
            # Should contain error details from both directories
            self.assertIn("Manifest file not found at:", error_message)

    def test_download_dbt_files_with_all_artifacts(self):
        """Test download_dbt_files with all dbt artifacts present"""
        from metadata.ingestion.source.database.dbt.constants import (
            DBT_CATALOG_FILE_NAME,
            DBT_MANIFEST_FILE_NAME,
            DBT_RUN_RESULTS_FILE_NAME,
            DBT_SOURCES_FILE_NAME,
        )
        from metadata.ingestion.source.database.dbt.dbt_config import download_dbt_files

        mock_reader = MagicMock()
        mock_reader.read.return_value = '{"nodes": {}, "sources": {}}'

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.get_reader",
            return_value=mock_reader,
        ):
            blob_grouped = {
                "/path/to/dbt": [
                    f"/path/to/dbt/{DBT_MANIFEST_FILE_NAME}",
                    f"/path/to/dbt/{DBT_CATALOG_FILE_NAME}",
                    f"/path/to/dbt/{DBT_RUN_RESULTS_FILE_NAME}.json",
                    f"/path/to/dbt/{DBT_SOURCES_FILE_NAME}",
                ]
            }

            result = list(
                download_dbt_files(
                    blob_grouped_by_directory=blob_grouped,
                    config=MagicMock(),
                    client=None,
                    bucket_name=None,
                )
            )

            self.assertEqual(len(result), 1)
            self.assertIsNotNone(result[0].dbt_manifest)
            self.assertIsNotNone(result[0].dbt_catalog)
            self.assertIsNotNone(result[0].dbt_run_results)
            self.assertIsNotNone(result[0].dbt_sources)


class TestGetLatestResult(TestCase):
    """
    Test _get_latest_result picks the most recent result by execute
    completed_at when the same unique_id appears in multiple run_results files.
    """

    @staticmethod
    def _make_result(unique_id, completed_at, status="pass"):
        timing = MagicMock()
        timing.name = "execute"
        timing.completed_at = completed_at
        result = MagicMock()
        result.unique_id = unique_id
        result.timing = [timing]
        result.status = MagicMock(value=status)
        return result

    @staticmethod
    def _make_dbt_objects(run_results_list):
        run_results = []
        for results in run_results_list:
            rr = MagicMock()
            rr.results = results
            run_results.append(rr)
        dbt_objects = MagicMock()
        dbt_objects.dbt_run_results = run_results
        return dbt_objects

    def test_single_match_returned(self):
        from metadata.ingestion.source.database.dbt.metadata import DbtSource

        result_a = self._make_result("test.pkg.my_test", "2026-02-12T10:00:00.000000Z")
        dbt_objects = self._make_dbt_objects([[result_a]])

        got = DbtSource._get_latest_result(dbt_objects, "test.pkg.my_test")
        self.assertIs(got, result_a)

    def test_no_match_returns_none(self):
        from metadata.ingestion.source.database.dbt.metadata import DbtSource

        result_a = self._make_result("test.pkg.other", "2026-02-12T10:00:00.000000Z")
        dbt_objects = self._make_dbt_objects([[result_a]])

        got = DbtSource._get_latest_result(dbt_objects, "test.pkg.missing")
        self.assertIsNone(got)

    def test_picks_latest_across_files(self):
        from metadata.ingestion.source.database.dbt.metadata import DbtSource

        old_result = self._make_result(
            "test.pkg.my_test", "2026-02-12T10:00:00.000000Z", "pass"
        )
        new_result = self._make_result(
            "test.pkg.my_test", "2026-02-12T14:00:00.000000Z", "fail"
        )
        dbt_objects = self._make_dbt_objects([[old_result], [new_result]])

        got = DbtSource._get_latest_result(dbt_objects, "test.pkg.my_test")
        self.assertIs(got, new_result)

    def test_picks_latest_regardless_of_order(self):
        from metadata.ingestion.source.database.dbt.metadata import DbtSource

        new_result = self._make_result(
            "test.pkg.my_test", "2026-02-12T14:00:00.000000Z", "fail"
        )
        old_result = self._make_result(
            "test.pkg.my_test", "2026-02-12T10:00:00.000000Z", "pass"
        )
        dbt_objects = self._make_dbt_objects([[new_result], [old_result]])

        got = DbtSource._get_latest_result(dbt_objects, "test.pkg.my_test")
        self.assertIs(got, new_result)

    def test_falls_back_to_first_when_no_timestamps(self):
        from metadata.ingestion.source.database.dbt.metadata import DbtSource

        result_a = self._make_result("test.pkg.my_test", None, "pass")
        result_b = self._make_result("test.pkg.my_test", None, "fail")
        dbt_objects = self._make_dbt_objects([[result_a], [result_b]])

        got = DbtSource._get_latest_result(dbt_objects, "test.pkg.my_test")
        self.assertIs(got, result_a)

    def test_datetime_objects_handled(self):
        from datetime import datetime

        from metadata.ingestion.source.database.dbt.metadata import DbtSource

        old_result = self._make_result(
            "test.pkg.my_test", datetime(2026, 2, 12, 10, 0, 0), "pass"
        )
        new_result = self._make_result(
            "test.pkg.my_test", datetime(2026, 2, 12, 14, 0, 0), "fail"
        )
        dbt_objects = self._make_dbt_objects([[old_result], [new_result]])

        got = DbtSource._get_latest_result(dbt_objects, "test.pkg.my_test")
        self.assertIs(got, new_result)
