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

import base64
import json
import logging
import textwrap
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
from metadata.ingestion.source.database.glue.utils import get_schema_definition

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


@pytest.fixture
def glue_source():
    with patch.object(GlueSource, "test_connection", return_value=False):
        workflow_config = OpenMetadataWorkflowConfig.model_validate(mock_glue_config)
        source = GlueSource.create(
            mock_glue_config["source"],
            workflow_config.workflowConfig.openMetadataServerConfig,
        )
    # The topology context is process wide, so a leftover Glue table_data here would be
    # picked up by the next connector's tests. Restore whatever was there afterwards.
    context = source.context.get().__dict__
    original_context = context.copy()
    context["database_service"] = MOCK_DATABASE_SERVICE.name.root
    context["database"] = MOCK_DATABASE.name.root
    context["database_schema"] = MOCK_DATABASE_SCHEMA.name.root
    yield source
    context.clear()
    context.update(original_context)


class TestGlueColumnDeduplication:
    """Glue may return a partition key in StorageDescriptor.Columns as well as in PartitionKeys.

    Emitting it twice makes the server reject the whole table with
    400 'Column name <name> is repeated', so the table is never ingested.
    """

    @pytest.fixture
    def source(self, glue_source):
        return glue_source

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


class TestGlueViewModel:
    """The view text has to survive parsing before anything downstream can use it.

    GlueTable leaves pydantic's extra="ignore" default in place, so a field the model does not
    declare is dropped without a word when boto3's response is fed in.
    """

    def test_view_text_survives_model_parsing(self):
        page = TablePage(
            TableList=[
                {
                    "Name": "hive_view",
                    "TableType": "VIRTUAL_VIEW",
                    "ViewOriginalText": "SELECT id FROM events",
                    "ViewExpandedText": "SELECT `events`.`id` FROM `default`.`events`",
                }
            ]
        )

        table = page.TableList[0]
        assert table.ViewOriginalText == "SELECT id FROM events"
        assert table.ViewExpandedText == "SELECT `events`.`id` FROM `default`.`events`"


def _blob(sql: str, **extra) -> str:
    """The base64 document a Presto/Trino view carries, built the way Athena builds it."""
    return base64.b64encode(json.dumps({"originalSql": sql, **extra}).encode()).decode()


def _view(original=None, expanded=None, name="sample_view") -> GlueTable:
    return GlueTable(
        Name=name,
        TableType="VIRTUAL_VIEW",
        ViewOriginalText=original,
        ViewExpandedText=expanded,
    )


class TestGlueSchemaDefinition:
    """Glue stores a Hive view as plain SQL and a Presto/Trino view as a comment wrapping a
    base64 document, and hands back only the raw text either way, so the source has to work
    out which one it is holding."""

    @pytest.mark.parametrize(
        "table,expected",
        [
            (
                _view(original=f"/* Presto View: {_blob('SELECT id FROM events')} */"),
                "CREATE VIEW default.sample_view AS SELECT id FROM events",
            ),
            (
                _view(original=f"/* Trino View: {_blob('SELECT 1')} */"),
                "CREATE VIEW default.sample_view AS SELECT 1",
            ),
            (
                _view(original=f"/* Presto Materialized View: {_blob('SELECT 2')} */"),
                "CREATE VIEW default.sample_view AS SELECT 2",
            ),
            (
                _view(original=f"/* Presto View: {_blob('SELECT 3').rstrip('=')} */"),
                "CREATE VIEW default.sample_view AS SELECT 3",
            ),
            (
                _view(original="/* Presto View: " + "\n".join(textwrap.wrap(_blob("SELECT 4"), 8)) + " */"),
                "CREATE VIEW default.sample_view AS SELECT 4",
            ),
            (
                _view(original="SELECT id FROM events"),
                "CREATE VIEW default.sample_view AS SELECT id FROM events",
            ),
            (
                _view(original="CREATE VIEW default.sample_view AS SELECT 1"),
                "CREATE VIEW default.sample_view AS SELECT 1",
            ),
            (
                _view(original="CREATE OR REPLACE VIEW default.sample_view AS SELECT 1"),
                "CREATE OR REPLACE VIEW default.sample_view AS SELECT 1",
            ),
            (
                _view(original="", expanded="SELECT `events`.`id` FROM `default`.`events`"),
                "CREATE VIEW default.sample_view AS SELECT `events`.`id` FROM `default`.`events`",
            ),
            (
                _view(original="   \n\t ", expanded="SELECT 1"),
                "CREATE VIEW default.sample_view AS SELECT 1",
            ),
            (_view(original=None, expanded="/* Presto View */"), None),
            (_view(), None),
        ],
        ids=[
            "presto_blob",
            "trino_blob",
            "presto_materialized_blob",
            "blob_padding_stripped",
            "blob_wrapped_lines",
            "hive_plain_select_wrapped",
            "already_create_view",
            "create_or_replace_view",
            "original_empty_uses_expanded",
            "original_whitespace_uses_expanded",
            "expanded_marker_only_is_not_a_definition",
            "both_absent",
        ],
    )
    def test_schema_definition(self, table, expected):
        assert get_schema_definition(table, "default", table.Name) == expected

    def test_hyphenated_names_are_quoted(self):
        """Glue allows a hyphen in a database name, and an unquoted one is not parseable SQL."""
        table = _view(original="SELECT 1", name="my-view")

        assert (
            get_schema_definition(table, "zipcode-db", table.Name) == 'CREATE VIEW "zipcode-db"."my-view" AS SELECT 1'
        )

    def test_quote_in_a_name_is_doubled(self):
        table = _view(original="SELECT 1", name='odd"name')

        assert get_schema_definition(table, "default", table.Name) == 'CREATE VIEW default."odd""name" AS SELECT 1'


class TestGlueSchemaDefinitionWarnings:
    """A view whose text Glue simply does not store needs no operator action, so that stays at
    debug. A payload Glue did hand us that we could not decode is the only case worth a warning."""

    @pytest.mark.parametrize(
        "original",
        [
            "/* Presto View: bm90IGpzb24= */",
            "/* Presto View: " + base64.b64encode(json.dumps({"foo": "bar"}).encode()).decode() + " */",
            "/* Presto View: " + base64.b64encode(b"\xff\xfe").decode() + " */",
            "/* Presto View: not!valid!base64 */",
        ],
        ids=["not_json", "no_original_sql", "not_utf8", "not_base64"],
    )
    def test_unreadable_payload_warns(self, original, caplog):
        with caplog.at_level(logging.WARNING):
            assert get_schema_definition(_view(original=original), "default", "sample_view") is None

        assert len(caplog.records) == 1

    def test_missing_definition_is_not_a_warning(self, caplog):
        with caplog.at_level(logging.WARNING):
            assert get_schema_definition(_view(expanded="/* Presto View */"), "default", "sample_view") is None

        assert caplog.records == []


class TestGlueViewRequest:
    """The definition has to reach CreateTableRequest, and only for views."""

    @staticmethod
    def _request(source, table, table_type):
        source.context.get().__dict__["table_data"] = table
        with patch("metadata.ingestion.source.database.glue.metadata.fqn") as mock_fqn:
            mock_fqn.build = mock_fqn_build
            return next(source.yield_table((table.Name, table_type))).right

    def test_view_request_carries_the_schema_definition(self, glue_source):
        table = _view(original=f"/* Presto View: {_blob('SELECT id FROM events')} */", name="presto_view")

        request = self._request(glue_source, table, TableType.View)

        assert request.tableType is TableType.View
        assert request.schemaDefinition.root == "CREATE VIEW default.presto_view AS SELECT id FROM events"

    def test_view_without_a_definition_is_still_ingested(self, glue_source):
        request = self._request(glue_source, _view(expanded="/* Presto View */"), TableType.View)

        assert request is not None
        assert request.schemaDefinition is None
        assert glue_source.status.failures == []

    def test_view_with_a_null_storage_descriptor_is_still_ingested(self, glue_source):
        table = _view(original="SELECT 1")
        table.StorageDescriptor = None

        request = self._request(glue_source, table, TableType.View)

        assert request.schemaDefinition.root == "CREATE VIEW default.sample_view AS SELECT 1"
        assert request.locationPath is None

    @pytest.mark.parametrize(
        "table_type",
        [TableType.Regular, TableType.External, TableType.Iceberg],
        ids=["regular", "external", "iceberg"],
    )
    def test_non_view_tables_get_no_schema_definition(self, glue_source, table_type):
        """View text on a table Glue did not type as a view must not change what we send."""
        table = _view(original="SELECT 1", name="ordinary_table")
        table.TableType = "EXTERNAL_TABLE"

        assert self._request(glue_source, table, table_type).schemaDefinition is None


class TestGlueIcebergView:
    """Glue types an Iceberg view as VIRTUAL_VIEW and also stamps table_type=ICEBERG on it, and
    the Iceberg branch wins the type ladder, so keying the definition off TableType.View alone
    would leave exactly this shape without one."""

    @staticmethod
    def _iceberg_view() -> GlueTable:
        return GlueTable(
            Name="iceberg_view",
            TableType="VIRTUAL_VIEW",
            Parameters=TableParameters(table_type="ICEBERG"),
            ViewOriginalText="SELECT id FROM events",
        )

    def test_iceberg_view_is_typed_iceberg(self, glue_source):
        glue_source._get_glue_tables = lambda: [TablePage(TableList=[self._iceberg_view()])]

        with patch("metadata.ingestion.source.database.glue.metadata.fqn") as mock_fqn:
            mock_fqn.build = mock_fqn_build
            assert list(glue_source.get_tables_name_and_type()) == [("iceberg_view", TableType.Iceberg)]

    def test_iceberg_view_still_carries_its_definition(self, glue_source):
        request = TestGlueViewRequest._request(glue_source, self._iceberg_view(), TableType.Iceberg)

        assert request.tableType is TableType.Iceberg
        assert request.schemaDefinition.root == "CREATE VIEW default.iceberg_view AS SELECT id FROM events"

    def test_an_iceberg_table_is_still_left_alone(self, glue_source):
        """The Iceberg branch is reached by ordinary tables too, which must stay unchanged."""
        table = GlueTable(
            Name="iceberg_table",
            TableType="EXTERNAL_TABLE",
            Parameters=TableParameters(table_type="ICEBERG"),
            ViewOriginalText="SELECT 1",
        )

        request = TestGlueViewRequest._request(glue_source, table, TableType.Iceberg)

        assert request.schemaDefinition is None


class TestGlueIncludeFlags:
    """Glue ingested every table and view whatever these flags said, unlike the generic path and
    unlike Delta Lake, which is the other source that hand-builds its requests."""

    @staticmethod
    def _tables() -> list[GlueTable]:
        return [
            GlueTable(Name="ordinary_table", TableType="EXTERNAL_TABLE"),
            GlueTable(Name="a_view", TableType="VIRTUAL_VIEW", ViewOriginalText="SELECT 1"),
            GlueTable(
                Name="iceberg_view",
                TableType="VIRTUAL_VIEW",
                Parameters=TableParameters(table_type="ICEBERG"),
            ),
        ]

    def _names(self, source, **flags):
        for flag, value in flags.items():
            setattr(source.source_config, flag, value)
        tables = self._tables()
        source._get_glue_tables = lambda: [TablePage(TableList=tables)]
        with patch("metadata.ingestion.source.database.glue.metadata.fqn") as mock_fqn:
            mock_fqn.build = mock_fqn_build
            return [name for name, _ in source.get_tables_name_and_type()]

    def test_both_flags_on_is_the_default_and_keeps_everything(self, glue_source):
        assert self._names(glue_source) == ["ordinary_table", "a_view", "iceberg_view"]

    def test_include_views_off_drops_every_view_format(self, glue_source):
        assert self._names(glue_source, includeViews=False) == ["ordinary_table"]

    def test_include_tables_off_keeps_only_views(self, glue_source):
        assert self._names(glue_source, includeTables=False) == ["a_view", "iceberg_view"]

    def test_both_off_yields_nothing(self, glue_source):
        assert self._names(glue_source, includeTables=False, includeViews=False) == []


class TestGlueViewDefinitionEdges:
    """Cases where a definition that looks fine still resolves to the wrong lineage, or to none."""

    def test_a_select_mentioning_create_view_is_still_wrapped(self):
        """The header check has to read the head of the statement. Matching anywhere would take
        the text inside this literal for a header and leave the SELECT without a target."""
        table = _view(original="SELECT 'CREATE VIEW' AS ddl FROM audit_log")

        assert get_schema_definition(table, "default", "sample_view") == (
            "CREATE VIEW default.sample_view AS SELECT 'CREATE VIEW' AS ddl FROM audit_log"
        )

    @pytest.mark.parametrize(
        "original",
        [
            "\n  CREATE VIEW default.sample_view AS SELECT 1",
            "/* a leading comment */ CREATE VIEW default.sample_view AS SELECT 1",
            "-- a leading line comment\nCREATE VIEW default.sample_view AS SELECT 1",
        ],
        ids=["leading_whitespace", "leading_block_comment", "leading_line_comment"],
    )
    def test_a_real_header_is_never_wrapped_twice(self, original):
        definition = get_schema_definition(_view(original=original), "default", "sample_view")

        assert definition == original.strip()
        assert definition.count("CREATE VIEW") == 1

    def test_the_statement_names_the_table_under_its_stored_name(self, glue_source):
        """standardize_table_name truncates to 128 chars, so naming the raw Glue name here would
        point the lineage target at an entity the catalog does not hold. This one has to run the
        whole path, because the truncation happens in get_tables_name_and_type."""
        long_name = "v" * 200
        glue_source._get_glue_tables = lambda: [TablePage(TableList=[_view(original="SELECT 1", name=long_name)])]

        with patch("metadata.ingestion.source.database.glue.metadata.fqn") as mock_fqn:
            mock_fqn.build = mock_fqn_build
            requests = [
                next(glue_source.yield_table(name_and_type)).right
                for name_and_type in glue_source.get_tables_name_and_type()
            ]

        stored_name = requests[0].name.root
        assert stored_name == long_name[:128]
        assert requests[0].schemaDefinition.root == f"CREATE VIEW default.{stored_name} AS SELECT 1"

    def test_a_view_with_a_null_serde_info_is_still_ingested(self, glue_source):
        """StorageDetails() defaults SerdeInfo to a non-null value, so only an explicit null
        reaches the guard in get_format."""
        table = _view(original="SELECT 1")
        table.StorageDescriptor = StorageDetails(SerdeInfo=None)

        request = TestGlueViewRequest._request(glue_source, table, TableType.View)

        assert request.fileFormat is None
        assert request.schemaDefinition.root == "CREATE VIEW default.sample_view AS SELECT 1"
