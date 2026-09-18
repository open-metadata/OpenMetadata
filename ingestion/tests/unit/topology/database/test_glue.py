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
Test Glue using the topology
"""

import json
import logging
from copy import deepcopy
from pathlib import Path
from unittest import TestCase
from unittest.mock import Mock, patch

import pytest

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import FileFormat, TableType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.source.database.glue.metadata import GlueSource
from metadata.ingestion.source.database.glue.models import (
    Column as GlueColumn,
)
from metadata.ingestion.source.database.glue.models import (
    DatabasePage,
    GlueSchema,
    GlueTable,
    SerializationDetails,
    StorageDetails,
    TablePage,
    TableParameters,
)

mock_file_path = Path(__file__).parent.parent.parent / "resources/datasets/glue_db_dataset.json"
with open(mock_file_path) as file:  # noqa: PTH123
    mock_data: dict = json.load(file)

mock_glue_config = {
    "source": {
        "type": "glue",
        "serviceName": "local_glue",
        "serviceConnection": {
            "config": {
                "type": "Glue",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-2",
                    "endPointURL": "https://endpoint.com/",
                },
            },
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "glue"},
        }
    },
}


def mock_fqn_build(*args, **kwargs) -> str:
    return ".".join((kwargs[key] for key in kwargs if key.endswith("_name")))  # noqa: UP034


MOCK_CUSTOM_DB_NAME = "NEW_DB"

mock_glue_config_db_test = deepcopy(mock_glue_config)
mock_glue_config_db_test["source"]["serviceConnection"]["config"]["databaseName"] = MOCK_CUSTOM_DB_NAME

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="glue_source",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Glue,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="118146679784",
    fullyQualifiedName="glue_source.118146679784",
    displayName="118146679784",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="default",
    fullyQualifiedName="glue_source.118146679784.default",
    displayName="default",
    description="",
    database=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
    service=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
)

EXPECTED_DATABASE_NAMES = ["118146679784"]

EXPECTED_DATABASE_SCHEMA_NAMES = [
    "default",
    "mydatabase",
    "testdatalake_db",
    "zipcode-db",
]

EXPECTED_TABLE_NAMES = ["cloudfront_logs", "cloudfront_logs2", "map_table"]

EXPECTED_TABLE_TYPES = [TableType.External, TableType.Iceberg, TableType.View]

EXPECTED_FILE_FORMATS = [None, FileFormat.tsv, FileFormat.parquet]

EXPECTED_LOCATION_PATHS = [
    "s3://athena-examples-MyRegion/cloudfront/plaintext",
    "s3://athena-postgres/",
    "s3://athena-postgres/map-test",
]


class GlueUnitTest(TestCase):
    @patch("metadata.ingestion.source.database.glue.metadata.GlueSource.test_connection")
    def __init__(self, methodName, test_connection) -> None:  # noqa: N803
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_glue_config)
        self.glue_source = GlueSource.create(
            mock_glue_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.glue_source.context.get().__dict__["database_service"] = MOCK_DATABASE_SERVICE.name.root
        self.glue_source.context.get().__dict__["database"] = MOCK_DATABASE.name.root
        self.glue_source.context.get().__dict__["database_schema"] = MOCK_DATABASE_SCHEMA.name.root
        self.glue_source._get_glue_database_and_schemas = lambda: [
            DatabasePage(**mock_data.get("mock_database_paginator"))
        ]
        self.glue_source._get_glue_tables = lambda: [TablePage(**mock_data.get("mock_table_paginator"))]

    def get_table_requests(self):
        tables = self.glue_source.get_tables_name_and_type()
        for table in tables:
            yield next(self.glue_source.yield_table(table)).right

    def test_database_names(self):
        assert EXPECTED_DATABASE_NAMES == list(self.glue_source.get_database_names())  # noqa: SIM300

    @patch("metadata.ingestion.source.database.glue.metadata.GlueSource.test_connection")
    def test_custom_db_name(self, test_connection):
        test_connection.return_value = False
        glue_source_new = GlueSource.create(
            mock_glue_config_db_test["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.assertEqual(list(glue_source_new.get_database_names()), [MOCK_CUSTOM_DB_NAME])

    def test_database_schema_names(self):
        assert EXPECTED_DATABASE_SCHEMA_NAMES == list(self.glue_source.get_database_schema_names())  # noqa: SIM300

    def test_database_schema_names_filters_other_catalogs_before_schema_filter(self):
        self.glue_source.source_config.schemaFilterPattern = FilterPattern(includes=["default"])
        self.glue_source._get_glue_database_and_schemas = lambda: [
            DatabasePage(
                DatabaseList=[
                    GlueSchema(
                        CatalogId=MOCK_DATABASE.name.root,
                        Name="default",
                        Description="current catalog schema",
                    ),
                    GlueSchema(
                        CatalogId="different-catalog",
                        Name="default",
                        Description="other catalog schema",
                    ),
                ]
            )
        ]

        assert ["default"] == list(self.glue_source.get_database_schema_names())  # noqa: SIM300

    @patch("metadata.ingestion.source.database.glue.metadata.fqn")
    def test_table_names(self, fqn):
        fqn.build = mock_fqn_build
        for table_and_table_type in list(self.glue_source.get_tables_name_and_type()):
            table_and_table_type[0]
            assert table_and_table_type[0] in EXPECTED_TABLE_NAMES
            assert table_and_table_type[1] in EXPECTED_TABLE_TYPES

    @patch("metadata.ingestion.source.database.glue.metadata.fqn")
    def test_file_formats(self, fqn):
        fqn.build = mock_fqn_build
        assert list(map(lambda x: x.fileFormat, self.get_table_requests())) == EXPECTED_FILE_FORMATS  # noqa: C417

    @patch("metadata.ingestion.source.database.glue.metadata.fqn")
    def test_location_paths(self, fqn):
        fqn.build = mock_fqn_build
        assert list(map(lambda x: x.locationPath, self.get_table_requests())) == EXPECTED_LOCATION_PATHS  # noqa: C417

    def test_iceberg_column_filtering_logic(self):
        """Test the Iceberg column filtering logic directly"""

        # Create mock Glue column data (as returned by boto3)
        current_column = {
            "Name": "current_col",
            "Type": "int",
            "Comment": "Current column",
            "Parameters": {"iceberg.field.current": "true"},
        }
        non_current_column = {
            "Name": "non_current_col",
            "Type": "string",
            "Comment": "Non-current column",
            "Parameters": {"iceberg.field.current": "false"},
        }
        column_without_params = {
            "Name": "normal_col",
            "Type": "boolean",
            "Comment": "Normal column",
            "Parameters": {},
        }

        # Test the filtering logic directly (same logic as in get_columns function)
        current_columns = []
        for col in [current_column, non_current_column, column_without_params]:
            col_name = col["Name"]
            col_type = col["Type"]  # noqa: F841
            col_comment = col.get("Comment", "")  # noqa: F841
            col_parameters = col.get("Parameters", {})

            # Check if this is a non-current Iceberg column
            iceberg_current = col_parameters.get("iceberg.field.current", "true")
            is_current = iceberg_current != "false"

            if is_current:
                current_columns.append(col_name)

        # Verify that only current columns are returned
        current_column_names = current_columns

        # Should include current_col and normal_col, but not non_current_col
        self.assertIn("current_col", current_column_names)
        self.assertIn("normal_col", current_column_names)
        self.assertNotIn("non_current_col", current_column_names)

        # Verify that exactly 2 columns are returned (current_col and normal_col)
        self.assertEqual(len(current_columns), 2)

    def test_iceberg_table_detection(self):
        """Test that Iceberg tables are correctly detected"""

        # Test with Iceberg table
        mock_iceberg_table = Mock()
        mock_iceberg_table.Parameters = Mock()
        mock_iceberg_table.Parameters.table_type = "ICEBERG"

        # Test with non-Iceberg table
        mock_regular_table = Mock()
        mock_regular_table.Parameters = Mock()
        mock_regular_table.Parameters.table_type = "EXTERNAL_TABLE"

        # Test with table without parameters
        mock_no_params_table = Mock()
        mock_no_params_table.Parameters = None

        # Test the detection logic
        is_iceberg_1 = mock_iceberg_table.Parameters and mock_iceberg_table.Parameters.table_type == "ICEBERG"
        is_iceberg_2 = mock_regular_table.Parameters and mock_regular_table.Parameters.table_type == "ICEBERG"
        is_iceberg_3 = mock_no_params_table.Parameters and mock_no_params_table.Parameters.table_type == "ICEBERG"

        self.assertTrue(is_iceberg_1)
        self.assertFalse(is_iceberg_2)
        self.assertFalse(is_iceberg_3)

    def _custom_db_name_source(self, pages):
        """A source configured with a custom databaseName, reading the given catalog pages."""
        with patch(
            "metadata.ingestion.source.database.glue.metadata.GlueSource.test_connection",
            return_value=False,
        ):
            source = GlueSource.create(
                mock_glue_config_db_test["source"],
                self.config.workflowConfig.openMetadataServerConfig,
            )
        source.context.get().__dict__["database_service"] = MOCK_DATABASE_SERVICE.name.root
        source.context.get().__dict__["database"] = MOCK_CUSTOM_DB_NAME
        source._get_glue_database_and_schemas = lambda: pages
        return source

    def test_custom_db_name_still_discovers_schemas(self):
        """databaseName names the OpenMetadata database, it does not select a Glue catalog.

        The catalog check compares against a Glue CatalogId, so a custom name matched
        nothing and every schema was dropped while the run still reported Success.
        """
        source = self._custom_db_name_source([DatabasePage(**mock_data.get("mock_database_paginator"))])

        assert EXPECTED_DATABASE_SCHEMA_NAMES == list(source.get_database_schema_names())  # noqa: SIM300
        assert source.status.failures == []
        assert source.status.warnings == []

    def test_custom_db_name_merges_catalogs_and_warns(self):
        """One name means one database, so catalogs merge. Say so, rather than dropping them."""
        source = self._custom_db_name_source(
            [
                DatabasePage(
                    DatabaseList=[
                        GlueSchema(
                            CatalogId=MOCK_DATABASE.name.root,
                            Name="default",
                            Description="current catalog schema",
                        ),
                        GlueSchema(
                            CatalogId="different-catalog",
                            Name="foreign_schema",
                            Description="other catalog schema",
                        ),
                    ]
                )
            ]
        )

        assert ["default", "foreign_schema"] == list(source.get_database_schema_names())  # noqa: SIM300
        assert len(source.status.warnings) == 1
        assert "more than one catalog" in source.status.warnings[0][MOCK_CUSTOM_DB_NAME]

    def test_schema_without_catalog_id_is_not_counted_as_another_catalog(self):
        """A missing CatalogId is not a second catalog, so it must not warn about merging."""
        source = self._custom_db_name_source(
            [
                DatabasePage(
                    DatabaseList=[
                        GlueSchema(CatalogId=MOCK_DATABASE.name.root, Name="default"),
                        GlueSchema(Name="schema_without_catalog"),
                    ]
                )
            ]
        )

        assert ["default", "schema_without_catalog"] == list(source.get_database_schema_names())  # noqa: SIM300
        assert source.status.warnings == []

    def test_tables_are_read_from_the_schema_own_catalog(self):
        """A schema from another catalog must not have its tables read from the caller's."""
        source = self._custom_db_name_source(
            [
                DatabasePage(
                    DatabaseList=[
                        GlueSchema(CatalogId="different-catalog", Name="foreign_schema"),
                    ]
                )
            ]
        )
        assert ["foreign_schema"] == list(source.get_database_schema_names())  # noqa: SIM300

        paginator = Mock()
        paginator.paginate.return_value = [mock_data.get("mock_table_paginator")]
        source.glue = Mock()
        source.glue.get_paginator.return_value = paginator
        source.context.get().__dict__["database_schema"] = "foreign_schema"

        list(source._get_glue_tables())

        paginator.paginate.assert_called_once_with(DatabaseName="foreign_schema", CatalogId="different-catalog")

    def test_iceberg_columns_are_read_from_the_schema_own_catalog(self):
        """The Iceberg detail lookup must name the same catalog the schema came from.

        Reading it from the caller's catalog raises, and the broad fallback then serves
        the unfiltered storage-descriptor columns, so dropped columns come back as live.
        """
        source = self._custom_db_name_source(
            [
                DatabasePage(
                    DatabaseList=[
                        GlueSchema(CatalogId="different-catalog", Name="foreign_schema"),
                    ]
                )
            ]
        )
        assert ["foreign_schema"] == list(source.get_database_schema_names())  # noqa: SIM300

        iceberg_table = Mock()
        iceberg_table.Name = "iceberg_table"
        iceberg_table.Parameters.table_type = "ICEBERG"
        source.context.get().__dict__["database_schema"] = "foreign_schema"
        # The topology context is shared, so a stray table_data leaks into later tests.
        source.context.get().__dict__["table_data"] = iceberg_table
        self.addCleanup(source.context.get().__dict__.pop, "table_data", None)
        source.glue = Mock()
        source.glue.get_table.return_value = {"Table": {"StorageDescriptor": {"Columns": []}}}

        list(source.get_columns(Mock()))

        source.glue.get_table.assert_called_once_with(
            DatabaseName="foreign_schema",
            Name="iceberg_table",
            CatalogId="different-catalog",
        )


class TestGlueColumnDeduplication:
    """Glue may return a partition key in StorageDescriptor.Columns as well as in PartitionKeys.

    Emitting it twice makes the server reject the whole table with
    400 'Column name <name> is repeated', so the table is never ingested.
    """

    @pytest.fixture
    def source(self):
        with patch.object(GlueSource, "test_connection", return_value=False):
            workflow_config = OpenMetadataWorkflowConfig.model_validate(mock_glue_config)
            glue_source = GlueSource.create(
                mock_glue_config["source"],
                workflow_config.workflowConfig.openMetadataServerConfig,
            )
        # The topology context is process wide, so a leftover Glue table_data here would be
        # picked up by the next connector's tests. Restore whatever was there afterwards.
        context = glue_source.context.get().__dict__
        original_context = context.copy()
        context["database_service"] = MOCK_DATABASE_SERVICE.name.root
        context["database"] = MOCK_DATABASE.name.root
        context["database_schema"] = MOCK_DATABASE_SCHEMA.name.root
        yield glue_source
        context.clear()
        context.update(original_context)

    @staticmethod
    def _glue_table(columns, partition_keys, is_iceberg=False) -> GlueTable:
        return GlueTable(
            Name="sample_partitioned_table",
            TableType="EXTERNAL_TABLE",
            Parameters=TableParameters(table_type="ICEBERG") if is_iceberg else None,
            StorageDescriptor=StorageDetails(
                Columns=[GlueColumn(Name=name, Type="string") for name in columns],
                Location="s3://sample-bucket/sample_partitioned_table/",
                SerdeInfo=SerializationDetails(
                    SerializationLibrary="org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe"
                ),
            ),
            PartitionKeys=[GlueColumn(Name=name, Type="string") for name in partition_keys],
        )

    @staticmethod
    def _column_names(source, table):
        source.context.get().__dict__["table_data"] = table
        return [column.name.root for column in source.get_columns(table.StorageDescriptor)]

    @staticmethod
    def _get_table_response(columns, partition_keys) -> dict:
        return {
            "Table": {
                "StorageDescriptor": {
                    "Columns": [{"Name": name, "Type": "string", "Parameters": {}} for name in columns]
                },
                "PartitionKeys": [{"Name": name, "Type": "string", "Parameters": {}} for name in partition_keys],
            }
        }

    @pytest.mark.parametrize(
        "columns,partition_keys,expected",
        [
            (["event_id", "load_date"], ["load_date"], ["event_id", "load_date"]),
            (["event_id"], ["load_date"], ["event_id", "load_date"]),
            (["event_id", "DT"], ["dt"], ["event_id", "DT", "dt"]),
        ],
        # case_distinct_kept guards the dedup key itself: comparison stays case sensitive so a
        # future case-insensitive tweak cannot silently merge two columns. Glue lowercases column
        # names on write, so this shape is defensive rather than something Glue can hand us.
        ids=["partition_key_repeated", "partition_key_only", "case_distinct_kept"],
    )
    def test_standard_path_emits_each_column_once(self, source, columns, partition_keys, expected):
        assert self._column_names(source, self._glue_table(columns, partition_keys)) == expected

    def test_iceberg_path_drops_partition_field_repeated_in_columns(self, source):
        table = self._glue_table(["event_id", "bucket_key"], ["bucket_key"], is_iceberg=True)

        with patch.object(source, "glue") as glue_client:
            glue_client.get_table.return_value = self._get_table_response(["event_id", "bucket_key"], ["bucket_key"])
            names = self._column_names(source, table)

        assert names == ["event_id", "bucket_key"]

    def test_iceberg_fallback_path_drops_duplicate_when_get_table_fails(self, source):
        """A GetTable failure falls back to the standard path, which must dedupe too."""
        table = self._glue_table(["event_id", "bucket_key"], ["bucket_key"], is_iceberg=True)

        with patch.object(source, "glue") as glue_client:
            glue_client.get_table.side_effect = RuntimeError("AccessDeniedException")
            names = self._column_names(source, table)

        assert names == ["event_id", "bucket_key"]

    def test_columns_colliding_after_truncation_are_deduplicated(self, source):
        """Emitted names are truncated to 256 chars, so two longer Glue names can collide there
        and hit the same server-side validation."""
        prefix = "a" * 256
        table = self._glue_table([f"{prefix}_first", f"{prefix}_second"], [])

        assert self._column_names(source, table) == [prefix]

    def test_repeated_partition_key_is_not_reported_as_a_warning(self, source, caplog):
        """Glue repeating a partition key is routine and needs no operator action. Warnings from
        the source are counted into the workflow summary, so this must stay at debug."""
        table = self._glue_table(["event_id", "load_date"], ["load_date"])

        with caplog.at_level(logging.WARNING):
            assert self._column_names(source, table) == ["event_id", "load_date"]

        assert caplog.records == []
