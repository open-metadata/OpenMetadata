"""
Test Cockroach using the topology
"""

import types
from unittest import TestCase
from unittest.mock import MagicMock, patch

from sqlalchemy.types import VARCHAR

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    ConstraintType,
    DataType,
    PartitionIntervalTypes,
    TableType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.cockroach.metadata import CockroachSource
from metadata.ingestion.source.database.cockroach.queries import (
    COCKROACH_GET_PARTITION_DETAILS,
)
from metadata.ingestion.source.database.common_pg_mappings import (
    GEOMETRY,
    POINT,
    POLYGON,
)

mock_cockroach_config = {
    "source": {
        "type": "cockroach",
        "serviceName": "local_cockroach1",
        "serviceConnection": {
            "config": {
                "type": "Cockroach",
                "username": "username",
                "authType": {
                    "password": "password",
                },
                "hostPort": "localhost:26257",
                "database": "cockroach",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "cockroach"},
        }
    },
}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="cockroach_source",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Cockroach,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="default",
    fullyQualifiedName="cockroach_source.default",
    displayName="default",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="default",
    fullyQualifiedName="cockroach_source.default.default",
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


MOCK_COLUMN_VALUE = [
    {
        "name": "username",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "varchar(50)",
        "comment": None,
    },
    {
        "name": "geom_c",
        "type": GEOMETRY(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "geometry",
        "comment": None,
    },
    {
        "name": "point_c",
        "type": POINT(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "point",
        "comment": None,
    },
    {
        "name": "polygon_c",
        "type": POLYGON(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "comment": None,
        "system_data_type": "polygon",
    },
]


EXPECTED_COLUMN_VALUE = [
    Column(
        name="username",
        displayName=None,
        dataType=DataType.VARCHAR,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="varchar(50)",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="geom_c",
        displayName=None,
        dataType=DataType.GEOMETRY,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="geometry",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="point_c",
        displayName=None,
        dataType=DataType.GEOMETRY,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="point",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="polygon_c",
        displayName=None,
        dataType=DataType.GEOMETRY,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="polygon",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
]


# ── get_table_partition_details: shared mock rows ──────────────────────────────
# Each tuple mirrors the SELECT list of COCKROACH_GET_PARTITION_DETAILS:
#   (partition_name, column_names, partition_type, table_name, database_name)
# A trailing `schema_name` element is carried only to let the mock side_effect
# reproduce the database-side `WHERE tables.name = :table_name AND
# tables.schema_name = :schema_name` scoping. It is never part of the SELECT.
PARTITION_ROWS = [
    # public.events — partitioned by LIST on the `region` column
    ("us_east", "region", "list", "events", "default", "public"),
    ("us_west", "region", "list", "events", "default", "public"),
    # analytics.events — same-named table in another schema, RANGE on `id`
    ("p0", "id", "range", "events", "default", "analytics"),
    ("p1", "id", "range", "events", "default", "analytics"),
]


def _make_partition_engine(rows):
    """Build a mock engine/conn whose `execute(...).all()` filters ``rows`` by
    the bound ``table_name``/``schema_name`` params, simulating the fixed
    ``COCKROACH_GET_PARTITION_DETAILS`` WHERE clause at the DB layer.

    ``rows`` is a list of 6-tuples:
    ``(partition_name, column_names, partition_type, table_name, database_name,
       schema_name)``.
    """
    conn = MagicMock()

    def _execute(stmt, params=None, **kwargs):
        params = params or {}
        filtered = [
            (r[0], r[1], r[2], r[3], r[4])
            for r in rows
            if r[3] == params.get("table_name") and r[5] == params.get("schema_name")
        ]
        result = MagicMock()
        result.all.return_value = filtered
        return result

    conn.execute.side_effect = _execute
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value = conn
    return engine, conn


def _make_inspector(column_names):
    """Build a mock inspector whose `get_columns` returns column dicts for the
    given names, mirroring the SQLAlchemy inspector row shape (``{"name": ...}``)
    used by `get_table_partition_details` to validate split partition tokens."""
    inspector = MagicMock()
    inspector.get_columns.return_value = [{"name": name} for name in column_names]
    return inspector


class cockroachUnitTest(TestCase):  # noqa: N801
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    def __init__(self, methodName, test_connection) -> None:  # noqa: N803
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_cockroach_config)
        self.cockroach_source = CockroachSource.create(
            mock_cockroach_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

        self.cockroach_source.context.get().__dict__["database_service"] = MOCK_DATABASE_SERVICE.name.root
        self.cockroach_source.context.get().__dict__["database"] = MOCK_DATABASE.name.root
        self.cockroach_source.context.get().__dict__["database_schema"] = MOCK_DATABASE_SCHEMA.name.root

    def test_datatype(self):
        inspector = types.SimpleNamespace()
        inspector.get_columns = lambda table_name, schema_name, table_type, db_name: MOCK_COLUMN_VALUE
        inspector.get_pk_constraint = lambda table_name, schema_name: []
        inspector.get_unique_constraints = lambda table_name, schema_name: []
        inspector.get_foreign_keys = lambda table_name, schema_name: []

        result, _, _ = self.cockroach_source.get_columns_and_constraints(
            "public", "user", "cockroach", inspector, TableType.Regular
        )
        for i, _ in enumerate(EXPECTED_COLUMN_VALUE):
            self.assertEqual(result[i], EXPECTED_COLUMN_VALUE[i])

    @patch("sqlalchemy.engine.base.Engine")
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection")
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.cockroach_source.close()

    def test_is_hidden_shard_column(self):
        """
        Test that hidden shard columns are correctly identified.

        CockroachDB creates hidden virtual columns for hash-sharded indexes
        with names like 'crdb_internal_id_shard_16'. These columns are marked
        as NOT VISIBLE and should be filtered from constraint columns.

        See: https://www.cockroachlabs.com/docs/stable/hash-sharded-indexes
        """
        # These should be identified as hidden shard columns
        self.assertTrue(CockroachSource._is_hidden_shard_column("crdb_internal_id_shard_16"))
        self.assertTrue(CockroachSource._is_hidden_shard_column("crdb_internal_user_id_shard_8"))
        self.assertTrue(CockroachSource._is_hidden_shard_column("crdb_internal_my_column_name_shard_32"))
        self.assertTrue(CockroachSource._is_hidden_shard_column("crdb_internal_start_time_end_time_shard_4"))

        # These should NOT be identified as hidden shard columns
        self.assertFalse(CockroachSource._is_hidden_shard_column("id"))
        self.assertFalse(CockroachSource._is_hidden_shard_column("user_id"))
        self.assertFalse(CockroachSource._is_hidden_shard_column("crdb_internal"))
        self.assertFalse(CockroachSource._is_hidden_shard_column("crdb_internal_shard"))
        self.assertFalse(CockroachSource._is_hidden_shard_column("crdb_internal_id_shard"))
        self.assertFalse(CockroachSource._is_hidden_shard_column("my_crdb_internal_id_shard_16"))
        self.assertFalse(CockroachSource._is_hidden_shard_column("crdb_internal_id_shard_16_extra"))

    def test_hidden_shard_columns_filtered_from_pk_constraints(self):
        """
        Test that hidden shard columns are filtered from primary key constraints.

        When a table uses hash-sharded indexes, CockroachDB adds hidden shard
        columns to the primary key. These should be filtered out to prevent
        'Invalid column name found in table constraint' errors.
        """
        inspector = types.SimpleNamespace()
        inspector.get_columns = lambda table_name, schema_name, table_type, db_name: MOCK_COLUMN_VALUE
        # Simulate a primary key with both regular and hidden shard columns
        inspector.get_pk_constraint = lambda table_name, schema_name: {
            "constrained_columns": [
                "crdb_internal_id_shard_16",  # Hidden shard column - should be filtered
                "username",  # Regular column - should be kept
            ],
            "name": "test_table_pkey",
        }
        inspector.get_unique_constraints = lambda table_name, schema_name: []
        inspector.get_foreign_keys = lambda table_name, schema_name: []

        (
            columns,
            table_constraints,  # noqa: RUF059
            _,
        ) = self.cockroach_source.get_columns_and_constraints(
            "public", "test_table", "cockroach", inspector, TableType.Regular
        )

        # Find the column named 'username' and check its constraint
        username_col = next((col for col in columns if col.name.root == "username"), None)
        self.assertIsNotNone(username_col)
        # Since we now have only one pk_column after filtering, it should be a column-level constraint
        self.assertEqual(username_col.constraint, Constraint.PRIMARY_KEY)

    def test_all_hidden_shard_columns_filtered_results_in_no_pk(self):
        """
        Test edge case where all primary key columns are hidden shard columns.

        If all columns in the primary key are hidden shard columns, the
        resulting pk_columns list should be empty.
        """
        inspector = types.SimpleNamespace()
        inspector.get_columns = lambda table_name, schema_name, table_type, db_name: MOCK_COLUMN_VALUE
        # All primary key columns are hidden shard columns
        inspector.get_pk_constraint = lambda table_name, schema_name: {
            "constrained_columns": [
                "crdb_internal_id_shard_16",
                "crdb_internal_timestamp_shard_8",
            ],
            "name": "test_table_pkey",
        }
        inspector.get_unique_constraints = lambda table_name, schema_name: []
        inspector.get_foreign_keys = lambda table_name, schema_name: []

        (
            columns,
            table_constraints,
            _,
        ) = self.cockroach_source.get_columns_and_constraints(
            "public", "test_table", "cockroach", inspector, TableType.Regular
        )

        # No table-level primary key constraint should be created
        pk_constraints = [tc for tc in (table_constraints or []) if tc.constraintType == ConstraintType.PRIMARY_KEY]
        self.assertEqual(len(pk_constraints), 0)

        # No column should have PRIMARY_KEY constraint
        for col in columns:
            self.assertNotEqual(col.constraint, Constraint.PRIMARY_KEY)

    def test_multi_column_pk_with_hidden_shard_column(self):
        """
        Test that multi-column primary keys with hidden shard columns work correctly.

        When a table has a composite primary key with both regular columns and
        hidden shard columns, only the regular columns should remain in the
        constraint after filtering.
        """
        inspector = types.SimpleNamespace()
        inspector.get_columns = lambda table_name, schema_name, table_type, db_name: MOCK_COLUMN_VALUE
        # Simulate a composite primary key with hidden shard column
        inspector.get_pk_constraint = lambda table_name, schema_name: {
            "constrained_columns": [
                "crdb_internal_id_shard_16",  # Hidden - should be filtered
                "username",  # Regular column
                "geom_c",  # Regular column
            ],
            "name": "test_table_pkey",
        }
        inspector.get_unique_constraints = lambda table_name, schema_name: []
        inspector.get_foreign_keys = lambda table_name, schema_name: []

        (
            columns,  # noqa: RUF059
            table_constraints,
            _,
        ) = self.cockroach_source.get_columns_and_constraints(
            "public", "test_table", "cockroach", inspector, TableType.Regular
        )

        # Should have a table-level PRIMARY_KEY constraint with the two visible columns
        pk_constraints = [tc for tc in (table_constraints or []) if tc.constraintType == ConstraintType.PRIMARY_KEY]
        self.assertEqual(len(pk_constraints), 1)
        self.assertEqual(pk_constraints[0].columns, ["username", "geom_c"])

    # ── get_table_partition_details ─────────────────────────────────────────────

    def test_partition_query_filters_by_schema_name(self):
        """COCKROACH_GET_PARTITION_DETAILS must scope partitions by schema_name.

        Regression for the bug where same-named tables in different schemas had
        their partitions mixed: `public.events` and `analytics.events` both
        matched `tables.name = 'events'` and their partitions were merged into a
        single TablePartition attached to whichever was being ingested.
        """
        self.assertIn("tables.name = :table_name", COCKROACH_GET_PARTITION_DETAILS)
        self.assertIn("tables.schema_name = :schema_name", COCKROACH_GET_PARTITION_DETAILS)

    def test_partition_query_restricts_to_primary_index_and_top_level(self):
        """The query must join `crdb_internal.table_indexes` and restrict to the
        primary index (`index_type = 'primary'`) and top-level partitions
        (`parent_name IS NULL`).

        Without the primary-index filter, `result[0]` could sample a
        secondary-index partition row with a different `column_names`, making the
        fix non-deterministic. The top-level filter avoids sampling subpartition
        rows whose `column_names` covers only the additional subpartition columns.
        """
        self.assertIn("crdb_internal.table_indexes", COCKROACH_GET_PARTITION_DETAILS)
        self.assertIn("partitions.index_id = table_indexes.index_id", COCKROACH_GET_PARTITION_DETAILS)
        self.assertIn("table_indexes.index_type = 'primary'", COCKROACH_GET_PARTITION_DETAILS)
        self.assertIn("partitions.parent_name IS NULL", COCKROACH_GET_PARTITION_DETAILS)

    def test_get_table_partition_details_binds_schema_name_param(self):
        """The override must forward `schema_name` to the executed statement.

        Before the fix the override accepted `schema_name` in its signature but
        only bound `table_name`, so the query could never scope by schema.
        """
        engine, conn = _make_partition_engine(PARTITION_ROWS)
        self.cockroach_source.engine = engine

        self.cockroach_source.get_table_partition_details("events", "public", _make_inspector(["region"]))

        self.assertEqual(conn.execute.call_count, 1)
        params = conn.execute.call_args.args[1]
        self.assertEqual(params, {"table_name": "events", "schema_name": "public"})

    def test_partition_details_public_events_excludes_analytics_columns(self):
        """`public.events` must carry only `public`'s partition columns.

        Two partitions exist on the same `region` column; the fix takes a single
        representative row (`result[0]`) and splits it, so `region` is emitted
        exactly once (no duplicates) rather than once per partition.
        """
        engine, _ = _make_partition_engine(PARTITION_ROWS)
        self.cockroach_source.engine = engine

        is_partitioned, partition = self.cockroach_source.get_table_partition_details(
            "events", "public", _make_inspector(["region", "id"])
        )

        self.assertTrue(is_partitioned)
        self.assertIsNotNone(partition)
        column_names = [col.columnName for col in partition.columns]
        self.assertEqual(column_names, ["region"])
        for col in partition.columns:
            self.assertEqual(col.intervalType, PartitionIntervalTypes.COLUMN_VALUE)
        # No leakage from analytics.events (partitioned by `id`, range)
        self.assertNotIn("id", column_names)

    def test_partition_details_analytics_events_excludes_public_columns(self):
        """`analytics.events` must carry only `analytics`'s partition columns.

        Two range partitions exist on the same `id` column; the fix deduplicates
        them to a single `id` entry.
        """
        engine, _ = _make_partition_engine(PARTITION_ROWS)
        self.cockroach_source.engine = engine

        is_partitioned, partition = self.cockroach_source.get_table_partition_details(
            "events", "analytics", _make_inspector(["id"])
        )

        self.assertTrue(is_partitioned)
        self.assertIsNotNone(partition)
        column_names = [col.columnName for col in partition.columns]
        self.assertEqual(column_names, ["id"])
        for col in partition.columns:
            self.assertEqual(col.intervalType, PartitionIntervalTypes.TIME_UNIT)
        # No leakage from public.events (partitioned by `region`, list)
        self.assertNotIn("region", column_names)

    def test_partition_details_does_not_flag_non_partitioned_same_named_table(self):
        """A non-partitioned same-named table must NOT inherit partitions from a
        partitioned table in another schema.

        Before the fix, ingesting `reporting.events` (no partitions) while
        `public.events` (partitioned) existed returned public's rows and wrongly
        flagged `reporting.events` as Partitioned with bogus partition columns.
        """
        rows = [
            # only public.events is partitioned; reporting.events has no rows
            ("us_east", "region", "list", "events", "default", "public"),
            ("us_west", "region", "list", "events", "default", "public"),
        ]
        engine, _ = _make_partition_engine(rows)
        self.cockroach_source.engine = engine

        is_partitioned, partition = self.cockroach_source.get_table_partition_details(
            "events", "reporting", MagicMock()
        )

        self.assertFalse(is_partitioned)
        self.assertIsNone(partition)

    def test_get_table_partition_details_empty_returns_false_none(self):
        """No matching partition rows must yield ``(False, None)``."""
        engine, _ = _make_partition_engine([])
        self.cockroach_source.engine = engine

        is_partitioned, partition = self.cockroach_source.get_table_partition_details(
            "ghost_table", "public", MagicMock()
        )

        self.assertFalse(is_partitioned)
        self.assertIsNone(partition)

    def test_partition_details_interval_type_mapping_and_fallback(self):
        """Verify INTERVAL_TYPE_MAP mapping for ``list``/``range`` and the
        ``COLUMN_VALUE`` fallback for an unknown partition strategy.

        A single table's partitions share one partition strategy, so the fix
        takes the strategy from the representative first row. Each scenario
        below is a separate table whose first (and only) row carries the
        strategy under test.
        """
        for partition_type, expected in [
            ("list", PartitionIntervalTypes.COLUMN_VALUE),
            ("range", PartitionIntervalTypes.TIME_UNIT),
            ("weird", PartitionIntervalTypes.COLUMN_VALUE),  # unknown -> fallback
        ]:
            rows = [("p", "region", partition_type, "t", "db", "public")]
            engine, _ = _make_partition_engine(rows)
            self.cockroach_source.engine = engine

            _, partition = self.cockroach_source.get_table_partition_details("t", "public", _make_inspector(["region"]))

            self.assertEqual([col.intervalType for col in partition.columns], [expected])

    def test_partition_details_splits_multi_column_partition_key(self):
        """A multi-column partition key is comma-joined in `column_names`
        (e.g. "region, kind"); the fix must split it into one
        `PartitionColumnDetails` per key column instead of emitting a single
        malformed `"region, kind"` name.

        Regression for the hard ingestion failure where `"region, kind"` was
        rejected by the server as an invalid column name.
        """
        rows = [
            ("us_east_a", "region, kind", "list", "events", "default", "public"),
            ("us_west_b", "region, kind", "list", "events", "default", "public"),
        ]
        engine, _ = _make_partition_engine(rows)
        self.cockroach_source.engine = engine

        is_partitioned, partition = self.cockroach_source.get_table_partition_details(
            "events", "public", _make_inspector(["region", "kind", "id"])
        )

        self.assertTrue(is_partitioned)
        column_names = [col.columnName for col in partition.columns]
        self.assertEqual(column_names, ["region", "kind"])
        # The malformed comma-joined name must never be published
        self.assertNotIn("region, kind", column_names)
        # Multi-column partitions collapse to a single representative row, so
        # each key column appears exactly once despite two partitions
        self.assertEqual(len(column_names), len(set(column_names)))

    def test_partition_details_trims_whitespace_around_split_tokens(self):
        """Split tokens are trimmed so stray whitespace around the ", "
        separator still yields names that match real columns."""
        rows = [("p", " region , kind ", "list", "t", "db", "public")]
        engine, _ = _make_partition_engine(rows)
        self.cockroach_source.engine = engine

        _, partition = self.cockroach_source.get_table_partition_details(
            "t", "public", _make_inspector(["region", "kind"])
        )

        self.assertEqual([col.columnName for col in partition.columns], ["region", "kind"])

    def test_partition_details_keeps_column_name_containing_comma(self):
        """CockroachDB emits identifiers unquoted, so `PARTITION BY LIST
        ("My Col", "a,b", "Upper")` yields `column_names = "My Col, a,b, Upper"`.
        Splitting on the ", " separator must keep `a,b` whole; a bare ","
        split would tear it into `a` and `b` and silently drop it."""
        rows = [("p1", "My Col, a,b, Upper", "list", "t", "db", "public")]
        engine, _ = _make_partition_engine(rows)
        self.cockroach_source.engine = engine

        _, partition = self.cockroach_source.get_table_partition_details(
            "t", "public", _make_inspector(["My Col", "a,b", "Upper", "id"])
        )

        self.assertEqual([col.columnName for col in partition.columns], ["My Col", "a,b", "Upper"])

    def test_partition_details_logs_dropped_tokens(self):
        """A token that is not a table column is dropped with a debug log, so a
        partition column that disappears from the published entity is traceable."""
        rows = [("p", "region, ghost_col", "list", "t", "db", "public")]
        engine, _ = _make_partition_engine(rows)
        self.cockroach_source.engine = engine

        with patch("metadata.ingestion.source.database.cockroach.metadata.logger") as logger:
            self.cockroach_source.get_table_partition_details("t", "public", _make_inspector(["region"]))

        logger.debug.assert_called_once()
        self.assertIn(["ghost_col"], logger.debug.call_args.args)

    def test_partition_details_drops_tokens_not_in_table_columns(self):
        """Split tokens that are not real table columns are dropped, guarding
        against publishing an invalid `columnName` the server would reject."""
        rows = [("p", "region, ghost_col", "list", "t", "db", "public")]
        engine, _ = _make_partition_engine(rows)
        self.cockroach_source.engine = engine

        _, partition = self.cockroach_source.get_table_partition_details(
            "t", "public", _make_inspector(["region", "kind"])
        )

        # Only the real column survives; the phantom token is dropped
        self.assertEqual([col.columnName for col in partition.columns], ["region"])

    def test_partition_details_returns_false_none_when_all_tokens_invalid(self):
        """If every split token fails validation against the table's columns,
        no partition is published (graceful omission), avoiding a
        `TablePartition` with an empty `columns` list."""
        rows = [("p", "ghost_a, ghost_b", "list", "t", "db", "public")]
        engine, _ = _make_partition_engine(rows)
        self.cockroach_source.engine = engine

        is_partitioned, partition = self.cockroach_source.get_table_partition_details(
            "t", "public", _make_inspector(["region", "kind"])
        )

        self.assertFalse(is_partitioned)
        self.assertIsNone(partition)
