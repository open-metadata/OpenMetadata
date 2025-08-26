#  Copyright 2025 Collate
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
snowflake unit tests
"""
# pylint: disable=line-too-long
from unittest import TestCase
from unittest.mock import Mock, PropertyMock, patch

import sqlalchemy.types as sqltypes

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineStatus,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.source.database.snowflake.metadata import MAP, SnowflakeSource
from metadata.ingestion.source.database.snowflake.models import SnowflakeStoredProcedure

SNOWFLAKE_CONFIGURATION = {
    "source": {
        "type": "snowflake",
        "serviceName": "local_snowflake",
        "serviceConnection": {
            "config": {
                "type": "Snowflake",
                "username": "username",
                "password": "password",
                "database": "database",
                "warehouse": "warehouse",
                "account": "account.region_name.cloud_service",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "snowflake"},
        }
    },
    "ingestionPipelineFQN": "snowflake.mock_pipeline",
}

SNOWFLAKE_INCREMENTAL_CONFIGURATION = {
    **SNOWFLAKE_CONFIGURATION,
    **{
        "source": {
            **SNOWFLAKE_CONFIGURATION["source"],
            "sourceConfig": {
                "config": {"type": "DatabaseMetadata", "incremental": {"enabled": True}}
            },
        }
    },
}

SNOWFLAKE_CONFIGURATIONS = {
    "incremental": SNOWFLAKE_INCREMENTAL_CONFIGURATION,
    "not_incremental": SNOWFLAKE_CONFIGURATION,
}

MOCK_PIPELINE_STATUSES = [
    PipelineStatus(
        runId="1",
        pipelineState="success",
        timestamp=10,
        startDate=10,
        endDate=20,
    ),
    PipelineStatus(
        runId="2",
        pipelineState="success",
        timestamp=30,
        startDate=30,
        endDate=50,
    ),
    PipelineStatus(
        runId="3",
        pipelineState="failed",
        timestamp=70,
        startDate=70,
        endDate=80,
    ),
]

RAW_CLUSTER_KEY_EXPRS = [
    "LINEAR(c1, c2)",
    "LINEAR(to_date(c1), substring(c2, 0, 10))",
    "LINEAR(v:'Data':id::number)",
    "LINEAR(to_date(substring(c2, 0, 10)))",
    "col",
]

EXPECTED_PARTITION_COLUMNS = [
    ["c1", "c2"],
    ["c1", "c2"],
    ["v"],
    ["c2"],
    ["col"],
]

MOCK_DB_NAME = "SNOWFLAKE_SAMPLE_DATA"
MOCK_SCHEMA_NAME_1 = "INFORMATION_SCHEMA"
MOCK_SCHEMA_NAME_2 = "TPCDS_SF10TCL"
MOCK_VIEW_NAME = "COLUMNS"
MOCK_TABLE_NAME = "CALL_CENTER"
EXPECTED_SNOW_URL_VIEW = "https://app.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/view/COLUMNS"
EXPECTED_SNOW_URL_TABLE = "https://app.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/TPCDS_SF10TCL/table/CALL_CENTER"


def get_snowflake_sources():
    """
    Get snowflake sources
    """
    sources = {}

    with patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection",
        return_value=False,
    ):
        config = OpenMetadataWorkflowConfig.model_validate(
            SNOWFLAKE_CONFIGURATIONS["not_incremental"]
        )
        sources["not_incremental"] = SnowflakeSource.create(
            SNOWFLAKE_CONFIGURATIONS["not_incremental"]["source"],
            config.workflowConfig.openMetadataServerConfig,
            SNOWFLAKE_CONFIGURATIONS["not_incremental"]["ingestionPipelineFQN"],
        )

        with patch(
            "metadata.ingestion.source.database.incremental_metadata_extraction.IncrementalConfigCreator._get_pipeline_statuses",
            return_value=MOCK_PIPELINE_STATUSES,
        ):
            config = OpenMetadataWorkflowConfig.model_validate(
                SNOWFLAKE_CONFIGURATIONS["incremental"]
            )
            sources["incremental"] = SnowflakeSource.create(
                SNOWFLAKE_CONFIGURATIONS["incremental"]["source"],
                config.workflowConfig.openMetadataServerConfig,
                SNOWFLAKE_CONFIGURATIONS["incremental"]["ingestionPipelineFQN"],
            )
    return sources


class SnowflakeUnitTest(TestCase):
    """
    Unit test for snowflake source
    """

    def __init__(self, methodName) -> None:
        super().__init__(methodName)
        self.sources = get_snowflake_sources()

    def test_partition_parse_columns(self):
        for source in self.sources.values():
            for idx, expr in enumerate(RAW_CLUSTER_KEY_EXPRS):
                assert (
                    source.parse_column_name_from_expr(expr)
                    == EXPECTED_PARTITION_COLUMNS[idx]
                )

    def test_incremental_config_is_created_accordingly(self):
        self.assertFalse(self.sources["not_incremental"].incremental.enabled)

        self.assertTrue(self.sources["incremental"].incremental.enabled)

        milliseconds_in_one_day = 24 * 60 * 60 * 1000
        safety_margin_days = self.sources[
            "incremental"
        ].source_config.incremental.safetyMarginDays

        self.assertEqual(
            self.sources["incremental"].incremental.start_timestamp,
            30 - safety_margin_days * milliseconds_in_one_day,
        )

    def _assert_urls(self):
        for source in self.sources.values():
            self.assertEqual(
                source.get_source_url(
                    database_name=MOCK_DB_NAME,
                    schema_name=MOCK_SCHEMA_NAME_2,
                    table_name=MOCK_TABLE_NAME,
                    table_type=TableType.Regular,
                ),
                EXPECTED_SNOW_URL_TABLE,
            )

            self.assertEqual(
                source.get_source_url(
                    database_name=MOCK_DB_NAME,
                    schema_name=MOCK_SCHEMA_NAME_1,
                    table_name=MOCK_VIEW_NAME,
                    table_type=TableType.View,
                ),
                EXPECTED_SNOW_URL_VIEW,
            )

    def test_source_url(self):
        """
        method to test source url
        """
        with patch.object(
            SnowflakeSource,
            "account",
            return_value="random_account",
            new_callable=PropertyMock,
        ):
            with patch.object(
                SnowflakeSource,
                "org_name",
                return_value="random_org",
                new_callable=PropertyMock,
            ):
                self._assert_urls()

            with patch.object(
                SnowflakeSource,
                "org_name",
                new_callable=PropertyMock,
                return_value=None,
            ):
                for source in self.sources.values():
                    self.assertIsNone(
                        source.get_source_url(
                            database_name=MOCK_DB_NAME,
                            schema_name=MOCK_SCHEMA_NAME_1,
                            table_name=MOCK_VIEW_NAME,
                            table_type=TableType.View,
                        )
                    )

    def test_stored_procedure_validator(self):
        """Review how we are building the SP signature"""

        sp_payload = SnowflakeStoredProcedure(
            NAME="test_sp",
            OWNER="owner",
            LANGUAGE="SQL",
            SIGNATURE="(NAME VARCHAR, NUMBER INT)",
            COMMENT="comment",
        )

        self.assertEqual("(VARCHAR, INT)", sp_payload.unquote_signature())

        # Check https://github.com/open-metadata/OpenMetadata/issues/14492
        sp_payload = SnowflakeStoredProcedure(
            NAME="test_sp",
            OWNER="owner",
            LANGUAGE="SQL",
            SIGNATURE="()",
            COMMENT="comment",
        )

        self.assertEqual("()", sp_payload.unquote_signature())

    def test_map_class_default_initialization(self):
        """Test MAP class with default parameters"""
        map_type = MAP()

        # Test default values
        self.assertEqual(map_type.key_type, sqltypes.VARCHAR)
        self.assertEqual(map_type.value_type, sqltypes.VARCHAR)
        self.assertFalse(map_type.not_null)

        # Test visit name
        self.assertEqual(map_type.__visit_name__, "MAP")

    def test_map_class_custom_initialization(self):
        """Test MAP class with custom parameters"""
        key_type = sqltypes.INTEGER
        value_type = sqltypes.TEXT
        not_null = True

        map_type = MAP(key_type=key_type, value_type=value_type, not_null=not_null)

        # Test custom values
        self.assertEqual(map_type.key_type, key_type)
        self.assertEqual(map_type.value_type, value_type)
        self.assertTrue(map_type.not_null)

        # Test visit name remains the same
        self.assertEqual(map_type.__visit_name__, "MAP")

    def test_map_class_partial_custom_initialization(self):
        """Test MAP class with some custom parameters"""
        key_type = sqltypes.BIGINT

        map_type = MAP(key_type=key_type)

        # Test mixed values
        self.assertEqual(map_type.key_type, key_type)
        self.assertEqual(map_type.value_type, sqltypes.VARCHAR)  # default
        self.assertFalse(map_type.not_null)  # default

    @patch(
        "metadata.ingestion.source.database.database_service.DatabaseServiceSource.get_tag_labels"
    )
    @patch("metadata.ingestion.source.database.snowflake.metadata.get_tag_label")
    def test_schema_tag_inheritance(
        self, mock_get_tag_label, mock_parent_get_tag_labels
    ):
        """Test schema tag inheritance"""
        for source in self.sources.values():
            # Verify tags are fetched and stored
            mock_schema_tags = [
                Mock(
                    SCHEMA_NAME="TEST_SCHEMA", TAG_NAME="SCHEMA_TAG", TAG_VALUE="VALUE"
                ),
            ]
            mock_execute = Mock()
            mock_execute.all.return_value = mock_schema_tags
            source.engine.execute = Mock(return_value=mock_execute)

            source.set_schema_tags_map("TEST_DATABASE")
            self.assertEqual(len(source.schema_tags_map["TEST_SCHEMA"]), 1)
            self.assertEqual(
                source.schema_tags_map["TEST_SCHEMA"][0],
                {"tag_name": "SCHEMA_TAG", "tag_value": "VALUE"},
            )

            # Verify schema tag labels
            mock_get_tag_label.return_value = TagLabel(
                tagFQN="SnowflakeTag.SCHEMA_TAG",
                labelType=LabelType.Automated,
                state=State.Suggested,
                source=TagSource.Classification,
            )

            schema_labels = source.get_schema_tag_labels(schema_name="TEST_SCHEMA")
            self.assertIsNotNone(schema_labels)
            self.assertEqual(len(schema_labels), 1)

            # Verify tag inheritance
            source.context.get().__dict__["database_schema"] = "TEST_SCHEMA"
            mock_parent_get_tag_labels.return_value = [
                TagLabel(
                    tagFQN="SnowflakeTag.TABLE_TAG",
                    labelType=LabelType.Automated,
                    state=State.Suggested,
                    source=TagSource.Classification,
                )
            ]

            table_labels = source.get_tag_labels(table_name="TEST_TABLE")
            self.assertEqual(len(table_labels), 2)
            tag_fqns = [tag.tagFQN.root for tag in table_labels]
            self.assertIn("SnowflakeTag.SCHEMA_TAG", tag_fqns)
            self.assertIn("SnowflakeTag.TABLE_TAG", tag_fqns)
