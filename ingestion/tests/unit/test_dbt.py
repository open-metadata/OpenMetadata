"""
Test dbt
"""

import json
import uuid
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
    convert_entity_reference,
    convert_entity_reference_list,
    extract_meta_fields_from_node,
    find_domain_by_name,
    format_domain_reference,
    generate_entity_link,
    get_corrected_name,
    get_data_model_path,
    get_dbt_compiled_query,
    get_dbt_raw_query,
    get_expected_type_for_value,
    validate_custom_property_match,
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
            manifest_meta=manifest_node.meta
        )

        self.assertEqual(dbt_meta_tags, MOCK_GLOASSARY_LABELS)

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

    # Test CustomProperties extraction

    def test_extract_meta_fields_with_custom_properties(self):
        """
        Test extraction of customProperties from manifest node
        """
        node = MagicMock()
        node.meta = {
            "openmetadata": {
                "customProperties": {
                    "dataRetentionDays": 90,
                    "dataClassification": "Confidential",
                    "businessOwner": "john.doe@company.com",
                }
            }
        }

        result = extract_meta_fields_from_node(node)

        self.assertEqual(len(result), 3)
        self.assertEqual(result["dataRetentionDays"], 90)
        self.assertEqual(result["dataClassification"], "Confidential")
        self.assertEqual(result["businessOwner"], "john.doe@company.com")

    def test_extract_meta_fields_no_custom_properties(self):
        """
        Test when no customProperties exist
        """
        node = MagicMock()
        node.meta = {"openmetadata": {"owner": "some_owner"}}

        result = extract_meta_fields_from_node(node)

        self.assertEqual(result, {})

    def test_extract_meta_fields_empty_meta(self):
        """
        Test extraction with empty or missing meta
        """
        node_no_meta = MagicMock(spec=[])
        result = extract_meta_fields_from_node(node_no_meta)
        self.assertEqual(result, {})

        node_none_meta = MagicMock()
        node_none_meta.meta = None
        result = extract_meta_fields_from_node(node_none_meta)
        self.assertEqual(result, {})

    # Test CustomProperties validation

    def test_validate_custom_property_string_types(self):
        """
        Test validation of string-based custom property types
        """
        self.assertTrue(validate_custom_property_match("string", "test value"))
        self.assertTrue(validate_custom_property_match("markdown", "# Header"))
        self.assertTrue(validate_custom_property_match("email", "test@example.com"))
        self.assertTrue(validate_custom_property_match("sql", "SELECT * FROM table"))

        self.assertFalse(validate_custom_property_match("string", 123))
        self.assertFalse(validate_custom_property_match("string", True))
        self.assertFalse(validate_custom_property_match("string", ["list"]))

    def test_validate_custom_property_numeric_types(self):
        """
        Test validation of numeric custom property types
        """
        self.assertTrue(validate_custom_property_match("integer", 42))
        self.assertTrue(validate_custom_property_match("number", 3.14))
        self.assertTrue(validate_custom_property_match("number", 42))

        self.assertFalse(validate_custom_property_match("integer", "42"))
        self.assertFalse(validate_custom_property_match("integer", 3.14))
        self.assertFalse(validate_custom_property_match("number", "3.14"))

    def test_validate_custom_property_boolean_type(self):
        """
        Test validation of boolean custom property type
        """
        self.assertTrue(validate_custom_property_match("boolean", True))
        self.assertTrue(validate_custom_property_match("boolean", False))

        self.assertFalse(validate_custom_property_match("boolean", "true"))
        self.assertFalse(validate_custom_property_match("boolean", 1))

    def test_validate_custom_property_complex_types(self):
        """
        Test validation of array and object types
        """
        self.assertTrue(validate_custom_property_match("array", [1, 2, 3]))
        self.assertTrue(validate_custom_property_match("array", ["a", "b"]))
        self.assertTrue(validate_custom_property_match("object", {"key": "value"}))

        self.assertFalse(validate_custom_property_match("array", "not_array"))
        self.assertFalse(validate_custom_property_match("object", "not_object"))

    def test_validate_custom_property_entity_references(self):
        """
        Test validation of entityReference types
        """
        self.assertTrue(
            validate_custom_property_match("entityReference", "user@example.com")
        )
        self.assertTrue(validate_custom_property_match("entityReference", "TeamName"))

        self.assertFalse(validate_custom_property_match("entityReference", 123))
        self.assertFalse(validate_custom_property_match("entityReference", ["list"]))

        self.assertTrue(
            validate_custom_property_match("entityReferenceList", ["user1", "user2"])
        )
        self.assertFalse(
            validate_custom_property_match("entityReferenceList", "single_value")
        )
        self.assertFalse(
            validate_custom_property_match("entityReferenceList", [1, 2, 3])
        )

    # Test entity reference conversion

    @patch("metadata.ingestion.source.database.dbt.dbt_utils.find_entity_by_name")
    def test_convert_entity_reference_user(self, mock_find_entity):
        """
        Test conversion of user entity reference
        """
        mock_user = MagicMock()
        mock_user.id.root = "user-123"
        mock_user.type = "user"
        mock_user.name = "john.doe"
        mock_user.fullyQualifiedName.root = "john.doe"
        mock_user.description = "Test user"
        mock_user.displayName = "John Doe"
        mock_find_entity.return_value = mock_user

        result = convert_entity_reference(self.dbt_source_obj.metadata, "john.doe")

        self.assertIsNotNone(result)
        self.assertEqual(result["id"], "user-123")
        self.assertEqual(result["type"], "user")
        self.assertEqual(result["name"], "john.doe")
        self.assertEqual(result["fullyQualifiedName"], "john.doe")

    @patch("metadata.ingestion.source.database.dbt.dbt_utils.find_entity_by_name")
    def test_convert_entity_reference_not_found(self, mock_find_entity):
        """
        Test when entity reference cannot be found
        """
        mock_find_entity.return_value = None

        result = convert_entity_reference(self.dbt_source_obj.metadata, "unknown.user")

        self.assertIsNone(result)

    def test_convert_entity_reference_invalid_input(self):
        """
        Test entity reference with invalid input
        """
        result = convert_entity_reference(self.dbt_source_obj.metadata, 123)
        self.assertIsNone(result)

        result = convert_entity_reference(self.dbt_source_obj.metadata, None)
        self.assertIsNone(result)

    @patch("metadata.ingestion.source.database.dbt.dbt_utils.convert_entity_reference")
    def test_convert_entity_reference_list(self, mock_convert):
        """
        Test conversion of entity reference list
        """
        mock_convert.side_effect = [
            {"id": "user1", "type": "user", "name": "user1"},
            {"id": "user2", "type": "user", "name": "user2"},
            None,
        ]

        result = convert_entity_reference_list(
            self.dbt_source_obj.metadata, ["user1", "user2", "unknown_user"]
        )

        self.assertIsNotNone(result)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "user1")
        self.assertEqual(result[1]["name"], "user2")

    def test_convert_entity_reference_list_invalid(self):
        """
        Test entity reference list with invalid input
        """
        result = convert_entity_reference_list(
            self.dbt_source_obj.metadata, "not_a_list"
        )
        self.assertIsNone(result)

        result = convert_entity_reference_list(self.dbt_source_obj.metadata, [])
        self.assertIsNone(result)

    # Test type detection

    def test_get_expected_type_for_value(self):
        """
        Test type detection for different values
        """
        self.assertEqual(get_expected_type_for_value(True), "boolean")
        self.assertEqual(get_expected_type_for_value(42), "integer")
        self.assertEqual(get_expected_type_for_value(3.14), "number")
        self.assertEqual(get_expected_type_for_value("text"), "string")
        self.assertEqual(get_expected_type_for_value([1, 2, 3]), "array")
        self.assertEqual(get_expected_type_for_value({"key": "value"}), "object")

    # Test domain utilities

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

    # Test loading custom properties definitions

    def test_load_custom_properties_definitions(self):
        """
        Test loading of custom properties definitions
        """
        self.dbt_source_obj.metadata.client.get = MagicMock(
            return_value={
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
        )

        self.dbt_source_obj.custom_properties_cache = {}
        self.dbt_source_obj._load_custom_properties_definitions()

        self.assertEqual(len(self.dbt_source_obj.custom_properties_cache), 2)
        self.assertIn("dataRetentionDays", self.dbt_source_obj.custom_properties_cache)
        self.assertIn("businessOwner", self.dbt_source_obj.custom_properties_cache)

    def test_load_custom_properties_definitions_error(self):
        """
        Test loading custom properties with API error
        """
        self.dbt_source_obj.metadata.client.get = MagicMock(
            side_effect=Exception("API Error")
        )

        self.dbt_source_obj.custom_properties_cache = {}
        self.dbt_source_obj._load_custom_properties_definitions()

        self.assertEqual(len(self.dbt_source_obj.custom_properties_cache), 0)

    # Test processing model meta fields

    @patch(
        "metadata.ingestion.source.database.dbt.metadata.extract_meta_fields_from_node"
    )
    def test_process_model_meta_fields(self, mock_extract):
        """
        Test processing of model meta fields for custom properties
        """
        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "service.database.schema.table"

        data_model_link = MagicMock()
        data_model_link.table_entity = mock_table

        manifest_node = MagicMock()
        manifest_node.meta = {
            "openmetadata": {"customProperties": {"dataRetentionDays": 90}}
        }

        mock_extract.return_value = {"dataRetentionDays": 90}

        with patch.object(
            self.dbt_source_obj, "_update_table_custom_properties"
        ) as mock_update:
            self.dbt_source_obj._process_model_meta_fields(
                data_model_link, manifest_node
            )

            mock_extract.assert_called_once_with(manifest_node)
            mock_update.assert_called_once_with(mock_table, {"dataRetentionDays": 90})

    def test_process_model_meta_fields_no_table(self):
        """
        Test processing when table entity is None
        """
        data_model_link = MagicMock()
        data_model_link.table_entity = None

        manifest_node = MagicMock()

        self.dbt_source_obj._process_model_meta_fields(data_model_link, manifest_node)

    # Test updating table custom properties

    def test_update_table_custom_properties_valid(self):
        """
        Test updating table with valid custom properties
        """
        self.dbt_source_obj.custom_properties_cache = {
            "dataRetentionDays": {
                "name": "dataRetentionDays",
                "propertyType": {"name": "integer"},
            }
        }

        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "test.table"

        custom_properties = {"dataRetentionDays": 90}

        with patch.object(
            self.dbt_source_obj, "_apply_custom_properties_to_table"
        ) as mock_apply:
            self.dbt_source_obj._update_table_custom_properties(
                mock_table, custom_properties
            )

            mock_apply.assert_called_once_with(mock_table, {"dataRetentionDays": 90})

    def test_update_table_custom_properties_unknown_field(self):
        """
        Test updating table with unknown custom property
        """
        self.dbt_source_obj.custom_properties_cache = {}

        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "test.table"

        custom_properties = {"unknownField": "value"}

        with patch.object(
            self.dbt_source_obj, "_apply_custom_properties_to_table"
        ) as mock_apply:
            self.dbt_source_obj._update_table_custom_properties(
                mock_table, custom_properties
            )

            mock_apply.assert_not_called()

    def test_update_table_custom_properties_type_mismatch(self):
        """
        Test updating table with type mismatch
        """
        self.dbt_source_obj.custom_properties_cache = {
            "dataRetentionDays": {
                "name": "dataRetentionDays",
                "propertyType": {"name": "integer"},
            }
        }

        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "test.table"

        custom_properties = {"dataRetentionDays": "not_a_number"}

        with patch.object(
            self.dbt_source_obj, "_apply_custom_properties_to_table"
        ) as mock_apply:
            self.dbt_source_obj._update_table_custom_properties(
                mock_table, custom_properties
            )

            mock_apply.assert_not_called()

    # Test applying custom properties to table

    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.patch")
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.get_by_name")
    def test_apply_custom_properties_to_table(self, mock_get, mock_patch):
        """
        Test applying custom properties to table entity
        """
        existing_table = MagicMock()
        existing_table.fullyQualifiedName.root = "test.table"
        existing_table.extension = None
        mock_get.return_value = existing_table

        mock_patch.return_value = True

        custom_properties = {"newProp": "newValue"}

        self.dbt_source_obj._apply_custom_properties_to_table(
            existing_table, custom_properties
        )

        mock_patch.assert_called_once()
        call_args = mock_patch.call_args
        self.assertEqual(call_args[1]["entity"], Table)
        patched_table = call_args[1]["destination"]
        self.assertEqual(patched_table.extension.root, {"newProp": "newValue"})

    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.patch")
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.get_by_name")
    def test_apply_custom_properties_merge_existing(self, mock_get, mock_patch):
        """
        Test merging new custom properties with existing ones
        """
        existing_table = MagicMock()
        existing_table.fullyQualifiedName.root = "test.table"
        existing_table.extension = MagicMock()
        existing_table.extension.root = {"existingProp": "existingValue"}
        mock_get.return_value = existing_table

        mock_patch.return_value = True

        custom_properties = {"newProp": "newValue"}

        self.dbt_source_obj._apply_custom_properties_to_table(
            existing_table, custom_properties
        )

        mock_patch.assert_called_once()
        call_args = mock_patch.call_args
        patched_table = call_args[1]["destination"]
        self.assertEqual(
            patched_table.extension.root,
            {"existingProp": "existingValue", "newProp": "newValue"},
        )

    # Test process_dbt_domain

    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.patch")
    def test_process_dbt_domain(self, mock_patch):
        """
        Test processing DBT domain
        """
        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "service.db.schema.table1"

        data_model_link = MagicMock()
        data_model_link.table_entity = mock_table

        domain_ref = EntityReference(
            id=str(uuid.uuid4()),
            type="domain",
            name="Finance",
            fullyQualifiedName="Finance",
        )

        self.dbt_source_obj.context.get().table_domains = {
            "service.db.schema.table1": domain_ref
        }

        self.dbt_source_obj.process_dbt_domain(data_model_link)

        mock_patch.assert_called_once()
        call_args = mock_patch.call_args
        self.assertEqual(call_args[1]["entity"], Table)
        self.assertEqual(call_args[1]["destination"].domain, domain_ref)

    def test_process_dbt_domain_no_domain(self):
        """
        Test processing when no domain is set
        """
        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "service.db.schema.table1"

        data_model_link = MagicMock()
        data_model_link.table_entity = mock_table

        self.dbt_source_obj.context.get().table_domains = {}

        with patch(
            "metadata.ingestion.ometa.ometa_api.OpenMetadata.patch"
        ) as mock_patch:
            self.dbt_source_obj.process_dbt_domain(data_model_link)
            mock_patch.assert_not_called()

    # Integration test

    @patch("metadata.ingestion.source.database.dbt.metadata.format_domain_reference")
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.patch")
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.get_by_name")
    @patch("metadata.ingestion.source.database.dbt.metadata.find_domain_by_name")
    def test_integration_domain_and_custom_properties(
        self, mock_find_domain, mock_get_by_name, mock_patch, mock_format_domain
    ):
        """
        Integration test for processing DBT model with domain and customProperties
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

        mock_table = MagicMock()
        mock_table.fullyQualifiedName.root = "service.db.schema.test_table"
        mock_table.extension = None
        mock_get_by_name.return_value = mock_table

        self.dbt_source_obj.custom_properties_cache = {
            "dataRetentionDays": {
                "name": "dataRetentionDays",
                "propertyType": {"name": "integer"},
            }
        }

        manifest_node = MagicMock()
        manifest_node.meta = {
            "openmetadata": {
                "domain": "Finance",
                "customProperties": {"dataRetentionDays": 90},
            }
        }

        domain_ref = self.dbt_source_obj.get_dbt_domain(manifest_node)
        self.assertIsNotNone(domain_ref)
        self.assertEqual(domain_ref.name, "Finance")

        data_model_link = MagicMock()
        data_model_link.table_entity = mock_table

        self.dbt_source_obj._process_model_meta_fields(data_model_link, manifest_node)

        self.assertTrue(mock_patch.called)
        mock_find_domain.assert_called_once_with(
            self.dbt_source_obj.metadata, "Finance"
        )
        mock_format_domain.assert_called_once_with(mock_domain)
