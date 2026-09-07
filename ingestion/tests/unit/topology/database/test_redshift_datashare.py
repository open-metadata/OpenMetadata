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
Test the ingestion of Redshift databases created from a datashare, which cannot
be connected to and are read from the cross-database catalog views instead.
"""

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.table import DataType, TableType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.redshift.datashare import (
    _column_type,
    _system_data_type,
    _table_type,
)
from metadata.ingestion.source.database.redshift.metadata import (
    RedshiftSource,
)
from metadata.ingestion.source.database.redshift.metadata import (
    logger as metadata_logger,
)

LOCAL_DATABASE = "dev"
SHARED_DATABASE = "example_data_share_name"

mock_redshift_config = {
    "source": {
        "type": "redshift",
        "serviceName": "local_redshift",
        "serviceConnection": {
            "config": {
                "type": "Redshift",
                "username": "username",
                "authType": {"password": "password"},
                "database": LOCAL_DATABASE,
                "ingestAllDatabases": True,
                "hostPort": "cluster.name.region.redshift.amazonaws.com:5439",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "redshift"},
        }
    },
}

DATABASE_ROWS = [
    SimpleNamespace(database_name=LOCAL_DATABASE, database_type="local"),
    SimpleNamespace(database_name=SHARED_DATABASE, database_type="auto mounted catalog"),
]

SCHEMA_ROWS = [("public",), ("sales",)]

TABLE_ROWS = [
    SimpleNamespace(table_name="orders", table_type="SHARED TABLE", remarks="Shared orders"),
    SimpleNamespace(table_name="orders_view", table_type="view", remarks=None),
]

COLUMN_ROWS = [
    SimpleNamespace(
        column_name="order_id",
        data_type="integer",
        character_maximum_length=None,
        numeric_precision=32,
        numeric_scale=0,
        is_nullable="NO",
        column_default=None,
        ordinal_position=1,
        remarks=None,
    ),
    SimpleNamespace(
        column_name="customer",
        data_type="character varying",
        character_maximum_length=64,
        numeric_precision=None,
        numeric_scale=None,
        is_nullable="YES",
        column_default=None,
        ordinal_position=2,
        remarks="Customer name",
    ),
]


class RedshiftDatashareTest(unittest.TestCase):
    """Datashare databases are read from SVV_ALL_* instead of a connection"""

    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    def setUp(self, mock_test_connection):
        mock_test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_redshift_config)
        self.redshift_source = RedshiftSource.create(
            mock_redshift_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.redshift_source.context.get().__dict__["database_service"] = "local_redshift"
        self.redshift_source.context.get().__dict__["database"] = SHARED_DATABASE
        self.redshift_source.context.get().__dict__["database_schema"] = "public"
        self.connection = MagicMock()
        self.connection.execute.side_effect = self._execute
        thread_id = self.redshift_source.context.get_current_thread_id()
        self.redshift_source._connection_map[thread_id] = self.connection
        self.show_databases_error = None
        self.svv_databases_error = None
        self.schema_rows = SCHEMA_ROWS

    def _execute(self, statement, params=None):
        """Answer each catalog view with the rows a consumer cluster would return"""
        query = str(statement).upper()
        if "SHOW DATABASES" in query:
            if self.show_databases_error:
                raise self.show_databases_error
            return MagicMock(fetchall=lambda: DATABASE_ROWS)
        if "SVV_REDSHIFT_DATABASES" in query:
            if self.svv_databases_error:
                raise self.svv_databases_error
            return MagicMock(fetchall=lambda: DATABASE_ROWS)
        if "SVV_ALL_SCHEMAS" in query:
            self.assertEqual(params["database"], SHARED_DATABASE)
            return self.schema_rows
        if "SVV_ALL_TABLES" in query:
            self.assertEqual(params["database"], SHARED_DATABASE)
            return TABLE_ROWS
        if "SVV_ALL_COLUMNS" in query:
            self.assertEqual(params["database"], SHARED_DATABASE)
            return COLUMN_ROWS
        raise AssertionError(f"Unexpected query on the local connection: {statement}")

    def _database_names(self, unreachable_databases):
        """Walk the databases, failing to connect to the given ones"""

        def set_inspector(database_name: str):
            if database_name in unreachable_databases:
                raise ConnectionError(f'Cannot connect to shared database "{database_name}"')

        with (
            patch.object(RedshiftSource, "get_database_names_raw", return_value=[LOCAL_DATABASE, SHARED_DATABASE]),
            patch.object(RedshiftSource, "set_inspector", side_effect=set_inspector),
            patch.object(RedshiftSource, "_set_incremental_table_processor"),
            patch.object(RedshiftSource, "set_external_location_map"),
        ):
            return list(self.redshift_source.get_database_names())

    def test_unreachable_shared_database_is_still_ingested(self):
        """The database that refused the connection is yielded in datashare mode"""
        with self.assertLogs(metadata_logger, level="INFO") as logs:
            self.assertEqual(self._database_names({SHARED_DATABASE}), [LOCAL_DATABASE, SHARED_DATABASE])
        self.assertEqual(self.redshift_source.datashare_database, SHARED_DATABASE)
        # The connection error stays visible, so a genuine failure is diagnosable
        self.assertTrue(
            any(f'Cannot connect to shared database "{SHARED_DATABASE}"' in line for line in logs.output),
            logs.output,
        )

    def test_connectable_databases_are_untouched(self):
        """Nothing changes for a cluster whose databases all accept connections"""
        self.assertEqual(self._database_names(set()), [LOCAL_DATABASE, SHARED_DATABASE])
        self.assertIsNone(self.redshift_source.datashare_database)
        # Only the probe that classifies the databases reached the connection
        self.assertEqual(self.connection.execute.call_count, 1)

    def test_shared_database_that_connects_is_never_downgraded(self):
        """A failure *after* the connection opens is not a datashare refusal.

        `set_inspector` only builds a lazy engine, so a missing grant on a
        per-database query used to look exactly like a refused connection and
        silently sent a perfectly usable connection down the catalog path.
        """

        def failing_location_map(database_name: str):
            raise RuntimeError(f"permission denied for relation svv_external_tables ({database_name})")

        with (
            patch.object(RedshiftSource, "get_database_names_raw", return_value=[LOCAL_DATABASE, SHARED_DATABASE]),
            patch.object(RedshiftSource, "set_inspector"),
            patch.object(RedshiftSource, "_set_incremental_table_processor"),
            patch.object(RedshiftSource, "set_external_location_map", side_effect=failing_location_map),
        ):
            self.assertEqual(list(self.redshift_source.get_database_names()), [])
        self.assertIsNone(self.redshift_source.datashare_database)
        # Only the classification probe ran; no catalog view was consulted
        self.assertEqual(self.connection.execute.call_count, 1)

    def test_unreachable_local_database_is_reported(self):
        """A database that is not shared keeps failing as it does today"""
        self.assertEqual(self._database_names({LOCAL_DATABASE}), [SHARED_DATABASE])
        self.assertIsNone(self.redshift_source.datashare_database)

    def test_falls_back_to_svv_when_show_databases_is_unavailable(self):
        """Clusters predating SHOW DATABASES still classify through the SVV view"""
        self.show_databases_error = RuntimeError('syntax error at or near "DATABASES"')
        self.assertEqual(self._database_names({SHARED_DATABASE}), [LOCAL_DATABASE, SHARED_DATABASE])
        self.assertEqual(self.redshift_source.datashare_database, SHARED_DATABASE)

    def test_shared_database_with_no_readable_schemas_is_skipped(self):
        """A database the catalog cannot see into is skipped, not registered empty.

        A catalog database mounted from Glue needs an IAM-authenticated session;
        under password auth the catalog views report nothing for it.
        """
        self.schema_rows = []
        self.assertEqual(self._database_names({SHARED_DATABASE}), [LOCAL_DATABASE])
        self.assertIsNone(self.redshift_source.datashare_database)

    def test_no_classification_source_keeps_current_behaviour(self):
        """With neither source readable, no database is classified as shared"""
        self.show_databases_error = RuntimeError("permission denied")
        self.svv_databases_error = RuntimeError("permission denied for view svv_redshift_databases")
        self.assertEqual(self._database_names({SHARED_DATABASE}), [LOCAL_DATABASE])
        self.assertIsNone(self.redshift_source.datashare_database)

    def test_schema_names_come_from_the_catalog(self):
        self.assertEqual(self._database_names({SHARED_DATABASE}), [LOCAL_DATABASE, SHARED_DATABASE])
        self.assertEqual(list(self.redshift_source.get_raw_database_schema_names()), ["public", "sales"])

    def test_table_names_and_types_come_from_the_catalog(self):
        self.redshift_source.datashare_database = SHARED_DATABASE
        self.redshift_source.source_config.includeViews = True
        tables = self.redshift_source.query_table_names_and_types("public")
        self.assertEqual(
            [(table.name, table.type_) for table in tables],
            [("orders", TableType.Regular), ("orders_view", TableType.View)],
        )
        # Constraints are not readable across databases, so none are carried over
        self.assertEqual(self.redshift_source._get_columns_with_constraints("public", "orders"), ([], [], []))

    def test_views_are_skipped_when_not_requested(self):
        self.redshift_source.datashare_database = SHARED_DATABASE
        self.redshift_source.source_config.includeViews = False
        tables = self.redshift_source.query_table_names_and_types("public")
        self.assertEqual([table.name for table in tables], ["orders"])

    def test_table_description_comes_from_the_catalog(self):
        self.redshift_source.datashare_database = SHARED_DATABASE
        self.redshift_source.query_table_names_and_types("public")
        self.assertEqual(
            self.redshift_source.get_table_description("public", "orders", MagicMock()),
            "Shared orders",
        )

    def test_table_descriptions_of_two_schemas_do_not_overwrite_each_other(self):
        """Remarks are keyed by schema, so schemas walked in parallel keep their own"""
        self.redshift_source.datashare_database = SHARED_DATABASE
        self.redshift_source.query_table_names_and_types("public")
        self.redshift_source.query_table_names_and_types("sales")
        self.assertEqual(
            self.redshift_source.get_table_description("public", "orders", MagicMock()),
            "Shared orders",
        )

    def test_columns_are_built_from_the_catalog(self):
        self.redshift_source.datashare_database = SHARED_DATABASE
        columns, constraints, foreign_columns = self.redshift_source.get_columns_and_constraints(
            schema_name="public",
            table_name="orders",
            db_name=SHARED_DATABASE,
            inspector=MagicMock(),
            table_type=TableType.Regular,
        )
        self.assertEqual(constraints, [])
        self.assertEqual(foreign_columns, [])
        self.assertEqual([column.name.root for column in columns], ["order_id", "customer"])
        self.assertEqual(columns[0].dataType, DataType.INT)
        self.assertEqual(columns[0].dataTypeDisplay, "integer")
        self.assertEqual(columns[0].ordinalPosition, 1)
        self.assertEqual(columns[1].dataType, DataType.VARCHAR)
        self.assertEqual(columns[1].dataLength, 64)
        self.assertEqual(columns[1].dataTypeDisplay, "character varying(64)")
        self.assertEqual(columns[1].description.root, "Customer name")

    def test_stored_procedures_are_not_read_from_the_local_database(self):
        self.redshift_source.datashare_database = SHARED_DATABASE
        self.redshift_source.source_config.includeStoredProcedures = True
        self.assertEqual(list(self.redshift_source.get_stored_procedures()), [])

    def test_schema_definition_is_not_read_from_the_local_database(self):
        self.redshift_source.datashare_database = SHARED_DATABASE
        self.assertIsNone(
            self.redshift_source.get_schema_definition(TableType.View, "orders_view", "public", MagicMock())
        )


class RedshiftDatashareHelpersTest(unittest.TestCase):
    """SVV_ALL_* reports free-form type and table type names"""

    def test_table_type(self):
        self.assertEqual(_table_type("TABLE"), TableType.Regular)
        self.assertEqual(_table_type("base table"), TableType.Regular)
        self.assertEqual(_table_type("SHARED TABLE"), TableType.Regular)
        self.assertEqual(_table_type("view"), TableType.View)
        self.assertEqual(_table_type("EXTERNAL TABLE"), TableType.External)
        self.assertEqual(_table_type(None), TableType.Regular)

    def test_system_data_type(self):
        self.assertEqual(_system_data_type("character varying", 64, None, None), "character varying(64)")
        self.assertEqual(_system_data_type("numeric", None, 8, 2), "numeric(8,2)")
        # Every numeric type reports a precision; only scaled ones should show it
        self.assertEqual(_system_data_type("integer", None, 32, 0), "integer")

    def test_column_type(self):
        self.assertEqual(str(_column_type("character varying", 64, None, None)), "VARCHAR(64)")
        self.assertEqual(str(_column_type("numeric", None, 8, 2)), "NUMERIC(8, 2)")
        self.assertEqual(str(_column_type("integer", None, 32, 0)), "INTEGER")
        self.assertEqual(str(_column_type("super", None, None, None)), "SUPER")
        # The Hive spellings a Data Catalog datashare reports resolve too
        self.assertEqual(str(_column_type("string", 32, None, None)), "VARCHAR(32)")
        # A type the dialect does not know keeps its source spelling for the parser
        self.assertEqual(_column_type("int", None, None, None), "int")


if __name__ == "__main__":
    unittest.main()
