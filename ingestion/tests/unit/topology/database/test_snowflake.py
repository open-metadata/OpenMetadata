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
from unittest.mock import MagicMock, Mock, PropertyMock, patch

import sqlalchemy.types as sqltypes

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineStatus,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.source.database.snowflake.metadata import MAP, SnowflakeSource
from metadata.ingestion.source.database.snowflake.models import SnowflakeStoredProcedure
from metadata.utils import fqn

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

SNOWFLAKE_CONFIGURATION_CUSTOM_HOST = {
    **SNOWFLAKE_CONFIGURATION,
    **{  # noqa: PIE800
        "source": {
            **SNOWFLAKE_CONFIGURATION["source"],
            "serviceConnection": {
                **SNOWFLAKE_CONFIGURATION["source"]["serviceConnection"],
                "config": {
                    **SNOWFLAKE_CONFIGURATION["source"]["serviceConnection"]["config"],
                    "snowflakeSourceHost": "custom.snowflake.com",
                },
            },
        }
    },
}

SNOWFLAKE_INCREMENTAL_CONFIGURATION = {
    **SNOWFLAKE_CONFIGURATION,
    **{  # noqa: PIE800
        "source": {
            **SNOWFLAKE_CONFIGURATION["source"],
            "sourceConfig": {"config": {"type": "DatabaseMetadata", "incremental": {"enabled": True}}},
        }
    },
}

SNOWFLAKE_CONFIGURATIONS = {
    "incremental": SNOWFLAKE_INCREMENTAL_CONFIGURATION,
    "not_incremental": SNOWFLAKE_CONFIGURATION,
    "custom_host": SNOWFLAKE_CONFIGURATION_CUSTOM_HOST,
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

# Table URLs
EXPECTED_SNOW_URL_TABLE = "https://app.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/TPCDS_SF10TCL/table/CALL_CENTER"
EXPECTED_SNOW_URL_TABLE_CUSTOM = "https://custom.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/TPCDS_SF10TCL/table/CALL_CENTER"
EXPECTED_SNOW_URL_TRANSIENT = "https://app.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/table/TEST_TRANSIENT"
EXPECTED_SNOW_URL_TRANSIENT_CUSTOM = "https://custom.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/table/TEST_TRANSIENT"
EXPECTED_SNOW_URL_DYNAMIC = "https://app.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/dynamic-table/TEST_DYNAMIC"
EXPECTED_SNOW_URL_DYNAMIC_CUSTOM = "https://custom.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/dynamic-table/TEST_DYNAMIC"
EXPECTED_SNOW_URL_EXTERNAL = "https://app.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/external-table/TEST_EXTERNAL"
EXPECTED_SNOW_URL_EXTERNAL_CUSTOM = "https://custom.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/external-table/TEST_EXTERNAL"

EXPECTED_SNOW_URL_VIEW = "https://app.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/view/COLUMNS"
EXPECTED_SNOW_URL_VIEW_CUSTOM = "https://custom.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/view/COLUMNS"
EXPECTED_SNOW_URL_MATERIALIZED_VIEW = "https://app.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/materialized-view/TEST_MV"
EXPECTED_SNOW_URL_MATERIALIZED_VIEW_CUSTOM = "https://custom.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/materialized-view/TEST_MV"

EXPECTED_SNOW_URL_STREAM = "https://app.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/stream/TEST_STREAM"
EXPECTED_SNOW_URL_STREAM_CUSTOM = "https://custom.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/stream/TEST_STREAM"

# Procedure URLs
EXPECTED_SNOW_URL_PROCEDURE = "https://app.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/procedure/TEST_PROC(VARCHAR)"
EXPECTED_SNOW_URL_PROCEDURE_CUSTOM = "https://custom.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/procedure/TEST_PROC(VARCHAR)"
EXPECTED_SNOW_URL_UDF = "https://app.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/user-function/TEST_UDF(NUMBER)"
EXPECTED_SNOW_URL_UDF_CUSTOM = "https://custom.snowflake.com/random_org/random_account/#/data/databases/SNOWFLAKE_SAMPLE_DATA/schemas/INFORMATION_SCHEMA/user-function/TEST_UDF(NUMBER)"


def get_snowflake_sources():
    """
    Get snowflake sources
    """
    sources = {}

    with patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection",
        return_value=False,
    ):
        config = OpenMetadataWorkflowConfig.model_validate(SNOWFLAKE_CONFIGURATIONS["not_incremental"])
        sources["not_incremental"] = SnowflakeSource.create(
            SNOWFLAKE_CONFIGURATIONS["not_incremental"]["source"],
            config.workflowConfig.openMetadataServerConfig,
            SNOWFLAKE_CONFIGURATIONS["not_incremental"]["ingestionPipelineFQN"],
        )

        config_custom = OpenMetadataWorkflowConfig.model_validate(SNOWFLAKE_CONFIGURATIONS["custom_host"])
        sources["custom_host"] = SnowflakeSource.create(
            SNOWFLAKE_CONFIGURATIONS["custom_host"]["source"],
            config_custom.workflowConfig.openMetadataServerConfig,
            SNOWFLAKE_CONFIGURATIONS["custom_host"]["ingestionPipelineFQN"],
        )

        with patch(
            "metadata.ingestion.source.database.incremental_metadata_extraction.IncrementalConfigCreator._get_pipeline_statuses",
            return_value=MOCK_PIPELINE_STATUSES,
        ):
            config = OpenMetadataWorkflowConfig.model_validate(SNOWFLAKE_CONFIGURATIONS["incremental"])
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

    def __init__(self, methodName) -> None:  # noqa: N803
        super().__init__(methodName)
        self.sources = get_snowflake_sources()

    def test_partition_parse_columns(self):
        for source in self.sources.values():
            for idx, expr in enumerate(RAW_CLUSTER_KEY_EXPRS):
                assert source.parse_column_name_from_expr(expr) == EXPECTED_PARTITION_COLUMNS[idx]

    def test_incremental_config_is_created_accordingly(self):
        self.assertFalse(self.sources["not_incremental"].incremental.enabled)

        self.assertTrue(self.sources["incremental"].incremental.enabled)

        milliseconds_in_one_day = 24 * 60 * 60 * 1000
        safety_margin_days = self.sources["incremental"].source_config.incremental.safetyMarginDays

        self.assertEqual(
            self.sources["incremental"].incremental.start_timestamp,
            30 - safety_margin_days * milliseconds_in_one_day,
        )

    def _assert_urls(self):
        for source_key, source in self.sources.items():
            if source_key == "custom_host":
                expected_table_url = EXPECTED_SNOW_URL_TABLE_CUSTOM
                expected_transient_url = EXPECTED_SNOW_URL_TRANSIENT_CUSTOM
                expected_dynamic_url = EXPECTED_SNOW_URL_DYNAMIC_CUSTOM
                expected_external_url = EXPECTED_SNOW_URL_EXTERNAL_CUSTOM
                expected_view_url = EXPECTED_SNOW_URL_VIEW_CUSTOM
                expected_materialized_view_url = EXPECTED_SNOW_URL_MATERIALIZED_VIEW_CUSTOM
                expected_stream_url = EXPECTED_SNOW_URL_STREAM_CUSTOM
                expected_procedure_url = EXPECTED_SNOW_URL_PROCEDURE_CUSTOM
                expected_udf_url = EXPECTED_SNOW_URL_UDF_CUSTOM
            else:
                expected_table_url = EXPECTED_SNOW_URL_TABLE
                expected_transient_url = EXPECTED_SNOW_URL_TRANSIENT
                expected_dynamic_url = EXPECTED_SNOW_URL_DYNAMIC
                expected_external_url = EXPECTED_SNOW_URL_EXTERNAL
                expected_view_url = EXPECTED_SNOW_URL_VIEW
                expected_materialized_view_url = EXPECTED_SNOW_URL_MATERIALIZED_VIEW
                expected_stream_url = EXPECTED_SNOW_URL_STREAM
                expected_procedure_url = EXPECTED_SNOW_URL_PROCEDURE
                expected_udf_url = EXPECTED_SNOW_URL_UDF

            # Test regular table URL
            self.assertEqual(
                source.get_source_url(
                    database_name=MOCK_DB_NAME,
                    schema_name=MOCK_SCHEMA_NAME_2,
                    table_name=MOCK_TABLE_NAME,
                    table_type=TableType.Regular,
                ),
                expected_table_url,
            )

            # Test transient table URL (should use 'table')
            self.assertEqual(
                source.get_source_url(
                    database_name=MOCK_DB_NAME,
                    schema_name=MOCK_SCHEMA_NAME_1,
                    table_name="TEST_TRANSIENT",
                    table_type=TableType.Transient,
                ),
                expected_transient_url,
            )

            # Test dynamic table URL
            self.assertEqual(
                source.get_source_url(
                    database_name=MOCK_DB_NAME,
                    schema_name=MOCK_SCHEMA_NAME_1,
                    table_name="TEST_DYNAMIC",
                    table_type=TableType.Dynamic,
                ),
                expected_dynamic_url,
            )

            # Test external table URL
            self.assertEqual(
                source.get_source_url(
                    database_name=MOCK_DB_NAME,
                    schema_name=MOCK_SCHEMA_NAME_1,
                    table_name="TEST_EXTERNAL",
                    table_type=TableType.External,
                ),
                expected_external_url,
            )

            # Test view URL
            self.assertEqual(
                source.get_source_url(
                    database_name=MOCK_DB_NAME,
                    schema_name=MOCK_SCHEMA_NAME_1,
                    table_name=MOCK_VIEW_NAME,
                    table_type=TableType.View,
                ),
                expected_view_url,
            )

            # Test materialized view URL
            self.assertEqual(
                source.get_source_url(
                    database_name=MOCK_DB_NAME,
                    schema_name=MOCK_SCHEMA_NAME_1,
                    table_name="TEST_MV",
                    table_type=TableType.MaterializedView,
                ),
                expected_materialized_view_url,
            )

            # Test stream URL
            self.assertEqual(
                source.get_source_url(
                    database_name=MOCK_DB_NAME,
                    schema_name=MOCK_SCHEMA_NAME_1,
                    table_name="TEST_STREAM",
                    table_type=TableType.Stream,
                ),
                expected_stream_url,
            )

            # Test stored procedure URL
            self.assertEqual(
                source.get_procedure_source_url(
                    database_name=MOCK_DB_NAME,
                    schema_name=MOCK_SCHEMA_NAME_1,
                    procedure_name="TEST_PROC",
                    procedure_signature="(VARCHAR)",
                    procedure_type="StoredProcedure",
                ),
                expected_procedure_url,
            )

            # Test UDF URL
            self.assertEqual(
                source.get_procedure_source_url(
                    database_name=MOCK_DB_NAME,
                    schema_name=MOCK_SCHEMA_NAME_1,
                    procedure_name="TEST_UDF",
                    procedure_signature="(NUMBER)",
                    procedure_type="UDF",
                ),
                expected_udf_url,
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

    def test_source_url_custom_host(self):
        """
        Test source URL generation with custom snowflakeSourceHost
        """
        with patch.object(  # noqa: SIM117
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
                custom_source = self.sources["custom_host"]

                # Test custom host URL generation for table
                self.assertEqual(
                    custom_source.get_source_url(
                        database_name=MOCK_DB_NAME,
                        schema_name=MOCK_SCHEMA_NAME_2,
                        table_name=MOCK_TABLE_NAME,
                        table_type=TableType.Regular,
                    ),
                    EXPECTED_SNOW_URL_TABLE_CUSTOM,
                )

                # Test custom host URL generation for view
                self.assertEqual(
                    custom_source.get_source_url(
                        database_name=MOCK_DB_NAME,
                        schema_name=MOCK_SCHEMA_NAME_1,
                        table_name=MOCK_VIEW_NAME,
                        table_type=TableType.View,
                    ),
                    EXPECTED_SNOW_URL_VIEW_CUSTOM,
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

    def _setup_tag_context(self, source, service_name="local_snowflake"):
        """Populate the topology context for schema-stage tag tests and return the FQN trio."""
        source.context.get().__dict__["database_service"] = service_name
        source.context.get().__dict__["database"] = "TEST_DATABASE"
        source.context.get().__dict__["database_schema"] = "TEST_SCHEMA"

        database_fqn = fqn.build(
            source.metadata,
            entity_type=Database,
            service_name=service_name,
            database_name="TEST_DATABASE",
        )
        schema_fqn = fqn.build(
            source.metadata,
            entity_type=DatabaseSchema,
            service_name=service_name,
            database_name="TEST_DATABASE",
            schema_name="TEST_SCHEMA",
        )
        table_fqn = fqn.build(
            source.metadata,
            entity_type=Table,
            service_name=service_name,
            database_name="TEST_DATABASE",
            schema_name="TEST_SCHEMA",
            table_name="TEST_TABLE",
            skip_es_search=True,
        )
        return database_fqn, schema_fqn, table_fqn

    def test_schema_tag_inheritance(self):
        """Schema tags propagate to tables; classification dedup is preserved."""
        for source in self.sources.values():
            mock_schema_tags = [
                Mock(SCHEMA_NAME="TEST_SCHEMA", TAG_NAME="SCHEMA_TAG", TAG_VALUE="VALUE"),
            ]
            mock_conn = MagicMock()
            mock_conn.execute.return_value = mock_schema_tags
            source.engine = MagicMock()
            source.engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
            source.engine.connect.return_value.__exit__ = MagicMock(return_value=False)

            source.set_schema_tags_map("TEST_DATABASE")
            self.assertEqual(len(source.schema_tags_map["TEST_SCHEMA"]), 1)
            self.assertEqual(
                source.schema_tags_map["TEST_SCHEMA"][0],
                {"tag_name": "SCHEMA_TAG", "tag_value": "VALUE"},
            )

            _, schema_fqn, table_fqn = self._setup_tag_context(source)

            source.tags_registry.attach(
                scope_fqn=schema_fqn,
                entity_fqn=schema_fqn,
                classification_name="SCHEMA_CLASSIFICATION",
                tag_name="SCHEMA_TAG",
                classification_description="",
                tag_description="",
            )
            source.tags_registry.attach(
                scope_fqn=schema_fqn,
                entity_fqn=table_fqn,
                classification_name="TABLE_CLASSIFICATION",
                tag_name="TABLE_TAG",
                classification_description="",
                tag_description="",
            )

            schema_labels = source.get_schema_tag_labels(schema_name="TEST_SCHEMA")
            self.assertIsNotNone(schema_labels)
            self.assertEqual(len(schema_labels), 1)
            self.assertEqual(schema_labels[0].tagFQN.root, "SCHEMA_CLASSIFICATION.SCHEMA_TAG")

            table_labels = source.get_tag_labels(table_name="TEST_TABLE")
            self.assertEqual(len(table_labels), 2)
            tag_fqns = [tag.tagFQN.root for tag in table_labels]
            self.assertIn("SCHEMA_CLASSIFICATION.SCHEMA_TAG", tag_fqns)
            self.assertIn("TABLE_CLASSIFICATION.TABLE_TAG", tag_fqns)

    def test_database_tag_inheritance(self):
        """Database tags propagate to schemas and tables when classifications don't overlap."""
        for source in self.sources.values():
            mock_database_tags = [
                Mock(
                    DATABASE_NAME="TEST_DATABASE",
                    TAG_NAME="DATABASE_TAG",
                    TAG_VALUE="DB_VALUE",
                ),
            ]
            mock_conn = MagicMock()
            mock_conn.execute.return_value = mock_database_tags
            source.engine = MagicMock()
            source.engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
            source.engine.connect.return_value.__exit__ = MagicMock(return_value=False)

            source.set_database_tags_map("TEST_DATABASE")
            self.assertEqual(len(source.database_tags_map["TEST_DATABASE"]), 1)
            self.assertEqual(
                source.database_tags_map["TEST_DATABASE"][0],
                {"tag_name": "DATABASE_TAG", "tag_value": "DB_VALUE"},
            )

            database_fqn, schema_fqn, table_fqn = self._setup_tag_context(source)

            source.tags_registry.attach(
                scope_fqn=database_fqn,
                entity_fqn=database_fqn,
                classification_name="DATABASE_TAG",
                tag_name="DB_VALUE",
                classification_description="",
                tag_description="",
            )
            source.tags_registry.attach(
                scope_fqn=schema_fqn,
                entity_fqn=schema_fqn,
                classification_name="SCHEMA_TAG",
                tag_name="SCHEMA_VALUE",
                classification_description="",
                tag_description="",
            )
            source.tags_registry.attach(
                scope_fqn=schema_fqn,
                entity_fqn=table_fqn,
                classification_name="TABLE_TAG",
                tag_name="TABLE_VALUE",
                classification_description="",
                tag_description="",
            )

            schema_labels = source.get_schema_tag_labels(schema_name="TEST_SCHEMA")
            self.assertIsNotNone(schema_labels)
            self.assertEqual(len(schema_labels), 2)
            tag_fqns = [tag.tagFQN.root for tag in schema_labels]
            self.assertIn("SCHEMA_TAG.SCHEMA_VALUE", tag_fqns)
            self.assertIn("DATABASE_TAG.DB_VALUE", tag_fqns)

            table_labels = source.get_tag_labels(table_name="TEST_TABLE")
            self.assertEqual(len(table_labels), 3)
            tag_fqns = [tag.tagFQN.root for tag in table_labels]
            self.assertIn("TABLE_TAG.TABLE_VALUE", tag_fqns)
            self.assertIn("SCHEMA_TAG.SCHEMA_VALUE", tag_fqns)
            self.assertIn("DATABASE_TAG.DB_VALUE", tag_fqns)

    def test_tag_value_precedence(self):
        """Lower-level tags override inherited values for the same classification.

        Database: ENV=dev, Schema: ENV=staging, Table: ENV=production.
        Schema lookup must return only ENV.staging; table lookup only ENV.production.
        """
        for source in self.sources.values():
            database_fqn, schema_fqn, table_fqn = self._setup_tag_context(source)

            source.tags_registry.attach(
                scope_fqn=database_fqn,
                entity_fqn=database_fqn,
                classification_name="ENV",
                tag_name="dev",
                classification_description="",
                tag_description="",
            )
            source.tags_registry.attach(
                scope_fqn=schema_fqn,
                entity_fqn=schema_fqn,
                classification_name="ENV",
                tag_name="staging",
                classification_description="",
                tag_description="",
            )
            source.tags_registry.attach(
                scope_fqn=schema_fqn,
                entity_fqn=table_fqn,
                classification_name="ENV",
                tag_name="production",
                classification_description="env classification",
                tag_description="production tag",
            )

            schema_labels = source.get_schema_tag_labels(schema_name="TEST_SCHEMA")
            self.assertEqual(len(schema_labels), 1)
            self.assertEqual(schema_labels[0].tagFQN.root, "ENV.staging")

            table_labels = source.get_tag_labels(table_name="TEST_TABLE")
            self.assertEqual(len(table_labels), 1)
            self.assertEqual(table_labels[0].tagFQN.root, "ENV.production")

    def test_table_names_full_query_generation(self):
        """Test complete SQL query generation for full extraction with different parameters"""
        from snowflake.sqlalchemy.snowdialect import SnowflakeDialect

        from metadata.ingestion.source.database.snowflake.utils import get_table_names

        dialect = SnowflakeDialect()

        mock_cursor_case1 = Mock()
        mock_cursor_case1.__iter__ = Mock(return_value=iter([]))

        mock_connection = Mock()
        mock_connection.execute = Mock(return_value=mock_cursor_case1)

        get_table_names(
            dialect,
            mock_connection,
            schema="TEST_SCHEMA",
            include_transient_tables=False,
            include_views=True,
        )

        call_args = mock_connection.execute.call_args
        executed_query_case1 = str(call_args[0][0])

        self.assertIn("COALESCE(IS_TRANSIENT, 'NO') != 'YES'", executed_query_case1)
        self.assertNotIn("TABLE_TYPE != 'VIEW'", executed_query_case1)

        mock_cursor_case2 = Mock()
        mock_cursor_case2.__iter__ = Mock(return_value=iter([]))
        mock_connection.execute = Mock(return_value=mock_cursor_case2)

        get_table_names(
            dialect,
            mock_connection,
            schema="TEST_SCHEMA",
            include_transient_tables=True,
            include_views=False,
        )

        call_args = mock_connection.execute.call_args
        executed_query_case2 = str(call_args[0][0])

        self.assertIn("TABLE_TYPE != 'VIEW'", executed_query_case2)
        self.assertNotIn("COALESCE(IS_TRANSIENT, 'NO') != 'YES'", executed_query_case2)

    def test_get_stored_procedures(self):
        """
        Test fetching stored procedures with filter
        """
        source = self.sources["not_incremental"]
        source.source_config.includeStoredProcedures = True
        source.source_config.storedProcedureFilterPattern = FilterPattern(excludes=["sp_exclude"])
        source.context.get().__dict__["database_service"] = "snowflake_source"
        source.context.get().__dict__["database"] = "test_db"
        source.context.get().__dict__["database_schema"] = "test_schema"

        mock_engine = MagicMock()
        source.engine = mock_engine

        # Mock rows as objects with _asdict() to mimic SQLAlchemy Row
        row1 = MagicMock()
        row1._asdict.return_value = {
            "NAME": "sp_include",
            "OWNER": "owner",
            "LANGUAGE": "SQL",
            "DEFINITION": "def1",
            "SIGNATURE": "(VARCHAR)",
            "COMMENT": "comment",
            "PROCEDURE_TYPE": "PROCEDURE",
        }
        row2 = MagicMock()
        row2._asdict.return_value = {
            "NAME": "sp_exclude",
            "OWNER": "owner",
            "LANGUAGE": "SQL",
            "DEFINITION": "def2",
            "SIGNATURE": "(VARCHAR)",
            "COMMENT": "comment",
            "PROCEDURE_TYPE": "PROCEDURE",
        }

        mock_conn = MagicMock()
        mock_conn.execute.return_value = [row1, row2]
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

        results = list(source.get_stored_procedures())

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].name, "sp_include")

    def test_empty_tag_value_skipped_with_warning(self):
        """Test that empty TAG_VALUE tags are skipped with a warning.

        In Snowflake, tags can have key-only semantics where TAG_VALUE is empty.
        When this happens, we should skip the tag and log a warning rather than
        fail with a validation error.
        """
        for source in self.sources.values():
            mock_schema_tags = [
                Mock(
                    SCHEMA_NAME="TEST_SCHEMA",
                    TAG_NAME="SELECT_STAR_STATUS_PII",
                    TAG_VALUE="",
                ),
                Mock(
                    SCHEMA_NAME="TEST_SCHEMA",
                    TAG_NAME="ANOTHER_EMPTY_TAG",
                    TAG_VALUE=None,
                ),
                Mock(
                    SCHEMA_NAME="TEST_SCHEMA",
                    TAG_NAME="TEST_TAG",
                    TAG_VALUE="123",
                ),
            ]
            mock_conn = MagicMock()
            mock_conn.execute.return_value = mock_schema_tags
            source.engine = MagicMock()
            source.engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
            source.engine.connect.return_value.__exit__ = MagicMock(return_value=False)

            source.set_schema_tags_map("TEST_DATABASE")
            # Only the tag with a value should be stored
            self.assertEqual(len(source.schema_tags_map["TEST_SCHEMA"]), 1)
            self.assertEqual(
                source.schema_tags_map["TEST_SCHEMA"][0],
                {"tag_name": "TEST_TAG", "tag_value": "123"},
            )


class TestSnowflakeGetDatabaseNamesRawEagerFetch:
    """
    Option B Part 2 applied to Snowflake: get_database_names_raw must call
    .fetchall() so that a subsequent engine.dispose() / set_inspector does
    not invalidate the cursor mid-iteration.
    """

    @staticmethod
    def _build_mock_rows():
        return [
            ["row_meta", "DB_A"],
            ["row_meta", "DB_B"],
            ["row_meta", "DB_C"],
        ]

    def test_fetchall_invoked_exactly_once(self):
        source = SnowflakeSource.__new__(SnowflakeSource)
        result = MagicMock()
        result.fetchall.return_value = self._build_mock_rows()
        mock_conn = MagicMock()
        mock_conn.execute.return_value = result

        with patch.object(SnowflakeSource, "connection", new_callable=PropertyMock) as mocked_conn_prop:
            mocked_conn_prop.return_value = mock_conn
            list(source.get_database_names_raw())

        assert result.fetchall.call_count == 1

    def test_yields_database_names_in_order(self):
        source = SnowflakeSource.__new__(SnowflakeSource)
        result = MagicMock()
        result.fetchall.return_value = self._build_mock_rows()
        mock_conn = MagicMock()
        mock_conn.execute.return_value = result

        with patch.object(SnowflakeSource, "connection", new_callable=PropertyMock) as mocked_conn_prop:
            mocked_conn_prop.return_value = mock_conn
            names = list(source.get_database_names_raw())

        assert names == ["DB_A", "DB_B", "DB_C"]


class SnowflakeBadNameIsolationTest(TestCase):
    """
    Regression tests for the fault-isolation paths added so that a single
    invalid table name in a schema does not poison ingestion for unrelated
    tables. See:
      - snowflake/utils.py::get_schema_columns  (per-row try/except)
      - snowflake/metadata.py::_get_table_names_and_types
        (per-table try/except around deleted-tables FQN listcomp)
    """

    @staticmethod
    def _column_row(table_name, column_name, ordinal):
        """Build a row tuple in the shape _get_schema_columns iterates over."""
        return (
            table_name,
            column_name,
            "NUMBER",  # coltype
            None,  # character_maximum_length
            38,  # numeric_precision
            0,  # numeric_scale
            "YES",  # is_nullable
            None,  # column_default
            "NO",  # is_identity
            None,  # comment
            None,  # identity_start
            None,  # identity_increment
            ordinal,  # ordinal_position
        )

    def test_get_schema_columns_skips_invalid_table_name(self):
        """A row in information_schema.columns whose table_name cannot be
        FQN-quoted must be skipped, and columns for valid tables in the same
        result must still be populated."""
        from snowflake.sqlalchemy.snowdialect import SnowflakeDialect

        from metadata.ingestion.source.database.snowflake.utils import (
            get_schema_columns,
        )

        dialect = SnowflakeDialect()
        # The function calls these on `self`; stub them.
        dialect._current_database_schema = Mock(return_value=("DB", "SCHEMA"))
        dialect._get_schema_primary_keys = Mock(return_value={})

        rows = [
            self._column_row("GOOD_TBL", "ID", 1),
            # Unbalanced quote — quote_name raises ValueError, even with re.DOTALL.
            self._column_row('BAD"NAME', "X", 1),
            self._column_row("GOOD_TBL", "NAME", 2),
        ]

        mock_connection = Mock()
        mock_connection.execute = Mock(return_value=iter(rows))

        result = get_schema_columns(dialect, mock_connection, schema="SCHEMA", info_cache={})

        # The good table's columns were populated even though a bad-named row
        # appeared between them — fault isolation at the per-row level.
        good_key = next(k for k in result if k.lower() == "good_tbl")
        self.assertEqual(len(result[good_key]), 2)
        self.assertEqual([c["name"].lower() for c in result[good_key]], ["id", "name"])
        # The bad-named row was skipped, not added under any case-variant key.
        self.assertFalse(any("bad" in k.lower() for k in result))

    def test_get_table_names_skips_deleted_with_invalid_name(self):
        """A deleted table whose name cannot be FQN-quoted must not abort the
        listcomp that populates context.deleted_tables — valid deletions
        before/after the bad row should still be recorded."""
        from datetime import datetime

        from metadata.ingestion.source.database.snowflake.models import (
            SnowflakeTable,
            SnowflakeTableList,
        )

        source = self.sources["not_incremental"] if hasattr(self, "sources") else None
        if source is None:
            source = next(iter(get_snowflake_sources().values()))

        deleted_at = datetime(2026, 1, 1)
        snowflake_tables = SnowflakeTableList(
            tables=[
                SnowflakeTable(name="GOOD_GONE", deleted=deleted_at, type_=TableType.Regular),
                SnowflakeTable(name='BAD"GONE', deleted=deleted_at, type_=TableType.Regular),
                SnowflakeTable(name="ALIVE_TBL", deleted=None, type_=TableType.Regular),
            ]
        )

        mock_inspector = MagicMock()
        mock_inspector.get_table_names = Mock(return_value=snowflake_tables)
        source.context.get().__dict__["database_service"] = "svc"
        source.context.get().__dict__["database"] = "db"
        source.context.get_global().deleted_tables = []

        def fake_fqn_build(*, metadata, entity_type, service_name, database_name, schema_name, table_name, **_kw):
            from metadata.utils.fqn import quote_name

            # quote_name still rejects names with embedded `"`; let that drive the failure.
            quote_name(table_name)
            return f"{service_name}.{database_name}.{schema_name}.{table_name}"

        with (
            patch.object(SnowflakeSource, "inspector", new_callable=PropertyMock) as p,
            patch(
                "metadata.ingestion.source.database.snowflake.metadata.fqn.build",
                side_effect=fake_fqn_build,
            ),
        ):
            p.return_value = mock_inspector
            not_deleted = source._get_table_names_and_types("SCHEMA")

        # Iteration completed and yielded the alive table.
        names = [t.name for t in not_deleted]
        self.assertEqual(names, ["ALIVE_TBL"])
        # The good deleted FQN was recorded; the bad-named one was skipped.
        recorded = source.context.get_global().deleted_tables
        self.assertEqual(len(recorded), 1)
        self.assertIn("GOOD_GONE", recorded[0])
        self.assertNotIn("BAD", " ".join(recorded))

    def setUp(self):
        # Build a snowflake source we can mutate per-test.
        if not hasattr(self, "sources"):
            self.sources = get_snowflake_sources()


def test_test_connection_wires_query_history_and_preserves_access_history_probe():
    """
    The test connection must register a GetQueries check that probes query_history
    (usage workflow / legacy lineage fallback), and keep the ACCESS_HISTORY probe
    available for the lineage path. GetAccessHistory has no DatabaseStep member yet,
    so it is not wired here - see VALIDATION.md / the colocated connection test.
    """
    from metadata.core.connections.test_connection.check import collect_checks
    from metadata.core.connections.test_connection.checks.database import DatabaseStep
    from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
        SnowflakeConnection as SnowflakeConnectionConfig,
    )
    from metadata.ingestion.source.database.snowflake.connection import (
        SnowflakeChecks,
    )
    from metadata.ingestion.source.database.snowflake.queries import (
        SNOWFLAKE_ACCESS_HISTORY_PROBE,
        SNOWFLAKE_TEST_GET_QUERIES,
    )

    checks = SnowflakeChecks(
        client=MagicMock(),
        service_connection=SnowflakeConnectionConfig(username="user", account="acc", warehouse="wh"),
    )
    collected = collect_checks(checks)

    assert DatabaseStep.GetQueries in collected
    assert "query_history" in SNOWFLAKE_TEST_GET_QUERIES.lower()
    assert "ACCESS_HISTORY" in SNOWFLAKE_ACCESS_HISTORY_PROBE
