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

from sqlalchemy.sql import sqltypes
from sqlalchemy_redshift.dialect import RedshiftDialect

from metadata.generated.schema.entity.data.table import DataType, TableType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.redshift.datashare import _table_type
from metadata.ingestion.source.database.redshift.metadata import (
    RedshiftSource,
)
from metadata.ingestion.source.database.redshift.metadata import (
    logger as metadata_logger,
)
from metadata.ingestion.source.database.redshift.strategy import (
    BaseStrategy,
    DatashareStrategy,
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

# pg_database hands back the system databases too; SHOW DATABASES does not.
# tuples: the pg_database path reads them positionally
PG_DATABASE_ROWS = [(name,) for name in (LOCAL_DATABASE, SHARED_DATABASE, "template0", "padb_harvest")]

SCHEMA_ROWS = [
    SimpleNamespace(database_name=SHARED_DATABASE, schema_name="public"),
    SimpleNamespace(database_name=SHARED_DATABASE, schema_name="sales"),
]

TABLE_ROWS = [
    SimpleNamespace(table_name="orders", table_type="SHARED TABLE", remarks="Shared orders"),
    SimpleNamespace(table_name="orders_view", table_type="view", remarks=None),
]

STORED_PROCEDURE_ROWS = [
    SimpleNamespace(
        _asdict=lambda: {"name": "refresh_orders", "owner": "admin", "definition": "BEGIN END;"},
    )
]

def _column_row(name, format_type, table_name="orders", notnull=False, comment=None, attnum=1):
    """A row of REDSHIFT_GET_DATASHARE_SCHEMA_COLUMN_INFO, whose format_type the
    query builds so that both paths hand the dialect the same thing."""
    return SimpleNamespace(
        **{
            "schema": "public",
            "table_name": table_name,
            "name": name,
            "format_type": format_type,
            "default": None,
            "notnull": notnull,
            "encode": None,
            "comment": comment,
            "distkey": None,
            "sortkey": 0,
            "attnum": attnum,
        }
    )


COLUMN_ROWS = [
    _column_row("order_id", "integer", notnull=True, attnum=1),
    _column_row("customer", "character varying(64)", comment="Customer name", attnum=2),
    # Spelling a datashare of Glue-backed external tables reports
    _column_row("payload", "array<struct<a:string>>", attnum=3),
]


class RedshiftSourceFixture:
    """A Redshift source whose only connection answers the catalog views."""

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
        self._svv_all_columns_calls = 0

    def _execute(self, statement, params=None):
        """Answer each catalog view with the rows a consumer cluster would return"""
        query = str(statement).upper()
        if "PG_DATABASE" in query:
            return MagicMock(fetchall=lambda: PG_DATABASE_ROWS)
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
            self.assertEqual(params["schema"], "public")
            self._svv_all_columns_calls += 1
            return COLUMN_ROWS
        if "PG_PROC_INFO" in query:
            return MagicMock(all=lambda: STORED_PROCEDURE_ROWS)
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

    def _enter_datashare_mode(self):
        """Walk the databases so that the datashare strategy is chosen the way a
        real run chooses it, rather than by assigning it here."""
        self._database_names({SHARED_DATABASE})
        self.assertIsInstance(self.redshift_source.strategy, DatashareStrategy)

    def assertDatashareStrategy(self, database_name):  # noqa: N802
        strategy = self.redshift_source.strategy
        self.assertIsInstance(strategy, DatashareStrategy)
        self.assertEqual(strategy.database_name, database_name)

    def assertBaseStrategy(self):  # noqa: N802
        self.assertIsInstance(self.redshift_source.strategy, BaseStrategy)


class RedshiftDatashareTest(RedshiftSourceFixture, unittest.TestCase):
    """Datashare databases are read from SVV_ALL_* instead of a connection"""

    def test_unreachable_shared_database_is_still_ingested(self):
        """The database that refused the connection is yielded in datashare mode"""
        with self.assertLogs(metadata_logger, level="INFO") as logs:
            self.assertEqual(self._database_names({SHARED_DATABASE}), [LOCAL_DATABASE, SHARED_DATABASE])
        self.assertDatashareStrategy(SHARED_DATABASE)
        # The connection error stays visible, so a genuine failure is diagnosable
        self.assertTrue(
            any(f'Cannot connect to shared database "{SHARED_DATABASE}"' in line for line in logs.output),
            logs.output,
        )

    def test_connectable_databases_are_untouched(self):
        """Nothing changes for a cluster whose databases all accept connections"""
        self.assertEqual(self._database_names(set()), [LOCAL_DATABASE, SHARED_DATABASE])
        self.assertBaseStrategy()
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
        self.assertBaseStrategy()
        # Only the classification probe ran; no catalog view was consulted
        self.assertEqual(self.connection.execute.call_count, 1)

    def test_unreachable_local_database_is_reported(self):
        """A database that is not shared keeps failing as it does today"""
        self.assertEqual(self._database_names({LOCAL_DATABASE}), [SHARED_DATABASE])
        self.assertBaseStrategy()

    def test_database_without_a_reported_type_is_treated_as_local(self):
        """An empty `database_type` must not read as non-local"""
        global DATABASE_ROWS  # noqa: PLW0603
        original = DATABASE_ROWS
        DATABASE_ROWS = [
            SimpleNamespace(database_name=name, database_type=None) for name in (LOCAL_DATABASE, SHARED_DATABASE)
        ]
        try:
            self.assertEqual(self._database_names({SHARED_DATABASE}), [LOCAL_DATABASE])
            self.assertBaseStrategy()
        finally:
            DATABASE_ROWS = original

    def test_falls_back_to_svv_when_show_databases_is_unavailable(self):
        """Clusters predating SHOW DATABASES still classify through the SVV view"""
        self.show_databases_error = RuntimeError('syntax error at or near "DATABASES"')
        self.assertEqual(self._database_names({SHARED_DATABASE}), [LOCAL_DATABASE, SHARED_DATABASE])
        self.assertDatashareStrategy(SHARED_DATABASE)

    def test_shared_database_with_no_readable_schemas_is_skipped(self):
        """A database the catalog cannot see into is skipped, not registered empty.

        A catalog database mounted from Glue needs an IAM-authenticated session;
        under password auth the catalog views report nothing for it.
        """
        self.schema_rows = []
        self.assertEqual(self._database_names({SHARED_DATABASE}), [LOCAL_DATABASE])
        self.assertBaseStrategy()

    def test_no_classification_source_keeps_current_behaviour(self):
        """With neither source readable, no database is classified as shared"""
        self.show_databases_error = RuntimeError("permission denied")
        self.svv_databases_error = RuntimeError("permission denied for view svv_redshift_databases")
        self.assertEqual(self._database_names({SHARED_DATABASE}), [LOCAL_DATABASE])
        self.assertBaseStrategy()

    def test_schema_names_come_from_the_catalog(self):
        self.assertEqual(self._database_names({SHARED_DATABASE}), [LOCAL_DATABASE, SHARED_DATABASE])
        self.assertEqual(list(self.redshift_source.get_raw_database_schema_names()), ["public", "sales"])

    def test_table_names_and_types_come_from_the_catalog(self):
        self._enter_datashare_mode()
        self.redshift_source.source_config.includeViews = True
        tables = self.redshift_source.query_table_names_and_types("public")
        self.assertEqual(
            [(table.name, table.type_) for table in tables],
            [("orders", TableType.Regular), ("orders_view", TableType.View)],
        )
        # Constraints are not readable across databases, so none are carried over
        self.assertEqual(self.redshift_source._get_columns_with_constraints("public", "orders"), ([], [], []))

    def test_views_are_skipped_when_not_requested(self):
        self._enter_datashare_mode()
        self.redshift_source.source_config.includeViews = False
        tables = self.redshift_source.query_table_names_and_types("public")
        self.assertEqual([table.name for table in tables], ["orders"])

    def test_table_description_comes_from_the_catalog(self):
        self._enter_datashare_mode()
        self.redshift_source.query_table_names_and_types("public")
        self.assertEqual(
            self.redshift_source.get_table_description("public", "orders", MagicMock()),
            "Shared orders",
        )

    def test_table_descriptions_of_two_schemas_do_not_overwrite_each_other(self):
        """Remarks are keyed by schema, so schemas walked in parallel keep their own"""
        self._enter_datashare_mode()
        self.redshift_source.query_table_names_and_types("public")
        self.redshift_source.query_table_names_and_types("sales")
        self.assertEqual(
            self.redshift_source.get_table_description("public", "orders", MagicMock()),
            "Shared orders",
        )

    def _catalog_columns(self):
        inspector = MagicMock()
        # Only the dialect is used, and it must be the real one: the merged path
        # builds columns exactly as reflection does.
        inspector.dialect = RedshiftDialect()
        inspector.dialect._domains = {}
        return self.redshift_source.get_columns_and_constraints(
            schema_name="public",
            table_name="orders",
            db_name=SHARED_DATABASE,
            inspector=inspector,
            table_type=TableType.Regular,
        )

    def test_columns_are_built_from_the_catalog(self):
        self._enter_datashare_mode()
        columns, constraints, foreign_columns = self._catalog_columns()
        self.assertEqual(constraints, [])
        self.assertEqual(foreign_columns, [])
        self.assertEqual([column.name.root for column in columns], ["order_id", "customer", "payload"])
        self.assertEqual(columns[0].dataType, DataType.INT)
        self.assertEqual(columns[0].dataTypeDisplay, "integer")
        self.assertEqual(columns[0].ordinalPosition, 1)
        self.assertEqual(columns[1].dataType, DataType.VARCHAR)
        self.assertEqual(columns[1].dataLength, 64)
        self.assertEqual(columns[1].dataTypeDisplay, "character varying(64)")
        self.assertEqual(columns[1].description.root, "Customer name")

    def test_a_type_the_dialect_cannot_resolve_keeps_its_source_spelling(self):
        """`array<struct<...>>` has no SQLAlchemy type. The dialect hands back an
        unusable class for it, so the raw spelling has to survive or the column
        degrades to UNKNOWN."""
        self._enter_datashare_mode()
        columns, _, _ = self._catalog_columns()
        payload = columns[2]
        self.assertEqual(payload.dataType, DataType.ARRAY)
        self.assertEqual(payload.dataTypeDisplay, "array<struct<a:string>>")

    def test_columns_are_read_once_per_schema_not_once_per_table(self):
        """The rows cross a database boundary, so the per-table query this
        replaced was an N+1."""
        self._enter_datashare_mode()
        before = self._svv_all_columns_calls
        self._catalog_columns()
        self._catalog_columns()
        self.assertEqual(self._svv_all_columns_calls - before, 1)

    def test_stored_procedures_are_not_read_from_the_local_database(self):
        """The catalog views carry none, and the local connection's would be wrong"""
        self._enter_datashare_mode()
        self.redshift_source.source_config.includeStoredProcedures = True
        self.assertEqual(list(self.redshift_source.get_stored_procedures()), [])

    def test_schema_definition_is_not_read_from_the_local_database(self):
        self._enter_datashare_mode()
        self.assertIsNone(
            self.redshift_source.get_schema_definition(TableType.View, "orders_view", "public", MagicMock())
        )


class RedshiftDatabaseListingTest(RedshiftSourceFixture, unittest.TestCase):
    """One SHOW DATABASES replaces the pg_database listing plus the classifier"""

    def test_databases_come_from_show_databases(self):
        self.assertEqual(
            list(self.redshift_source.get_database_names_raw()),
            [LOCAL_DATABASE, SHARED_DATABASE],
        )

    def test_system_databases_are_not_walked(self):
        """pg_database reports template0 / padb_harvest, which the walk then tries
        to connect to. SHOW DATABASES omits them."""
        listed = list(self.redshift_source.get_database_names_raw())
        self.assertNotIn("template0", listed)
        self.assertNotIn("padb_harvest", listed)

    def test_listing_and_classification_share_one_round_trip(self):
        list(self.redshift_source.get_database_names_raw())
        self.redshift_source.datashare.shared_database_names  # noqa: B018
        self.assertEqual(self.connection.execute.call_count, 1)

    def test_falls_back_to_pg_database_when_show_is_unavailable(self):
        """A cluster or role that cannot run either classifier keeps the old listing"""
        self.show_databases_error = RuntimeError('syntax error at or near "DATABASES"')
        self.svv_databases_error = RuntimeError("permission denied")
        self.assertEqual(
            list(self.redshift_source.get_database_names_raw()),
            [LOCAL_DATABASE, SHARED_DATABASE, "template0", "padb_harvest"],
        )


class RedshiftBaseStrategyTest(RedshiftSourceFixture, unittest.TestCase):
    """A connectable database keeps being read through reflection.

    The datashare work moved these reads behind a strategy, so each one needs a
    guard proving the connected path still lands on the inspector rather than on
    a catalog view.
    """

    def test_a_connectable_database_keeps_the_base_strategy(self):
        self._database_names(set())
        self.assertBaseStrategy()

    def test_schema_names_come_from_the_inspector(self):
        inspector = MagicMock()
        inspector.get_schema_names.return_value = ["public", "staging"]
        self.redshift_source._inspector_map[self.redshift_source.context.get_current_thread_id()] = inspector
        self.assertEqual(list(self.redshift_source.get_raw_database_schema_names()), ["public", "staging"])

    def test_table_description_comes_from_the_inspector(self):
        inspector = MagicMock()
        inspector.get_table_comment.return_value = {"text": "Reflected comment"}
        self.assertEqual(
            self.redshift_source.get_table_description("public", "orders", inspector),
            "Reflected comment",
        )
        inspector.get_table_comment.assert_called_once_with("orders", "public")

    def test_schema_definition_comes_from_the_inspector(self):
        inspector = MagicMock()
        inspector.get_view_definition.return_value = "SELECT 1"
        self.assertEqual(
            self.redshift_source.get_schema_definition(TableType.View, "orders_view", "public", inspector),
            "SELECT 1",
        )
        inspector.get_view_definition.assert_called_once_with("orders_view", "public")

    def test_columns_come_from_the_inspector(self):
        inspector = MagicMock()
        inspector.get_columns.return_value = [{"name": "order_id", "type": sqltypes.INTEGER()}]
        columns = self.redshift_source._get_columns_internal(
            "public", "orders", LOCAL_DATABASE, inspector, TableType.Regular
        )
        self.assertEqual([column["name"] for column in columns], ["order_id"])

    def test_stored_procedures_are_read_from_a_connectable_database(self):
        self.redshift_source.source_config.includeStoredProcedures = True
        procedures = list(self.redshift_source.get_stored_procedures())
        self.assertEqual([procedure.name for procedure in procedures], ["refresh_orders"])


class RedshiftDatashareHelpersTest(unittest.TestCase):
    """SVV_ALL_TABLES reports free-form table type names"""

    def test_table_type(self):
        self.assertEqual(_table_type("TABLE"), TableType.Regular)
        self.assertEqual(_table_type("base table"), TableType.Regular)
        self.assertEqual(_table_type("SHARED TABLE"), TableType.Regular)
        self.assertEqual(_table_type("view"), TableType.View)
        self.assertEqual(_table_type("EXTERNAL TABLE"), TableType.External)
        self.assertEqual(_table_type(None), TableType.Regular)


if __name__ == "__main__":
    unittest.main()
