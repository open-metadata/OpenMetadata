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
Tests for CommonDbSourceService._prepare_foreign_constraints
"""

import gc
import weakref
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect
from sqlalchemy.pool import QueuePool

from metadata.generated.schema.entity.data.table import (
    Column,
    ConstraintType,
    DataType,
    Table,
    TableConstraint,
)
from metadata.ingestion.connections.session import create_and_bind_thread_safe_session
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.multi_db_source import MultiDBSource


@pytest.fixture
def source():
    """Create a mock CommonDbSourceService with the minimal context needed."""
    mock_source = MagicMock()
    mock_source._prepare_foreign_constraints = (
        CommonDbSourceService._prepare_foreign_constraints.__get__(mock_source)
    )

    context = MagicMock()
    context.database_service = "test_service"
    context.database = "test_db"
    context.foreign_tables = []
    mock_source.context.get.return_value = context
    mock_source.context.get_global.return_value = context

    return mock_source


MOCK_COLUMNS = [
    Column(name="id", dataType=DataType.INT),
    Column(name="order_id", dataType=DataType.INT),
]


class TestPrepareForeignConstraintsReferredSchema:
    """Test referred_schema resolution in _prepare_foreign_constraints."""

    def test_explicit_referred_schema_used_for_cross_schema_fk(self, source):
        """When referred_schema is explicitly set (cross-schema FK),
        it should be used instead of the current schema."""
        mock_referred_table = MagicMock(spec=Table)
        mock_referred_table.columns = MOCK_COLUMNS
        source.metadata.get_by_name.return_value = mock_referred_table

        with patch(
            "metadata.ingestion.source.database.common_db_source.fqn._build",
            return_value="test_service.test_db.other_schema.orders.order_id",
        ), patch(
            "metadata.ingestion.source.database.common_db_source.get_relationship_type",
            return_value=None,
        ):
            result = source._prepare_foreign_constraints(
                supports_database=False,
                column={
                    "referred_schema": "other_schema",
                    "referred_table": "orders",
                    "referred_columns": ["order_id"],
                    "constrained_columns": ["order_id"],
                },
                table_name="line_items",
                schema_name="current_schema",
                db_name="test_db",
                columns=MOCK_COLUMNS,
            )

        source.metadata.get_by_name.assert_called_once_with(
            entity=Table,
            fqn="test_service.test_db.other_schema.orders",
        )
        assert result is not None
        assert result.constraintType == ConstraintType.FOREIGN_KEY

    def test_schema_name_fallback_when_referred_schema_is_none(self, source):
        """When referred_schema is None (same-schema FK, e.g. Snowflake),
        it should fall back to schema_name."""
        mock_referred_table = MagicMock(spec=Table)
        mock_referred_table.columns = MOCK_COLUMNS
        source.metadata.get_by_name.return_value = mock_referred_table

        with patch(
            "metadata.ingestion.source.database.common_db_source.fqn._build",
            return_value="test_service.test_db.public.orders.order_id",
        ), patch(
            "metadata.ingestion.source.database.common_db_source.get_relationship_type",
            return_value=None,
        ):
            result = source._prepare_foreign_constraints(
                supports_database=False,
                column={
                    "referred_schema": None,
                    "referred_table": "orders",
                    "referred_columns": ["order_id"],
                    "constrained_columns": ["order_id"],
                },
                table_name="line_items",
                schema_name="public",
                db_name="test_db",
                columns=MOCK_COLUMNS,
            )

        source.metadata.get_by_name.assert_called_once_with(
            entity=Table,
            fqn="test_service.test_db.public.orders",
        )
        assert result is not None
        assert result.constraintType == ConstraintType.FOREIGN_KEY

    def test_schema_name_fallback_when_referred_schema_is_empty_string(self, source):
        """When referred_schema is an empty string, it should fall back
        to schema_name."""
        mock_referred_table = MagicMock(spec=Table)
        mock_referred_table.columns = MOCK_COLUMNS
        source.metadata.get_by_name.return_value = mock_referred_table

        with patch(
            "metadata.ingestion.source.database.common_db_source.fqn._build",
            return_value="test_service.test_db.public.orders.order_id",
        ), patch(
            "metadata.ingestion.source.database.common_db_source.get_relationship_type",
            return_value=None,
        ):
            result = source._prepare_foreign_constraints(
                supports_database=False,
                column={
                    "referred_schema": "",
                    "referred_table": "orders",
                    "referred_columns": ["order_id"],
                    "constrained_columns": ["order_id"],
                },
                table_name="line_items",
                schema_name="public",
                db_name="test_db",
                columns=MOCK_COLUMNS,
            )

        source.metadata.get_by_name.assert_called_once_with(
            entity=Table,
            fqn="test_service.test_db.public.orders",
        )
        assert result is not None

    def test_supports_database_uses_referred_database(self, source):
        """When supports_database is True, the referred_database from
        the column dict should be used instead of the context database."""
        mock_referred_table = MagicMock(spec=Table)
        mock_referred_table.columns = MOCK_COLUMNS
        source.metadata.get_by_name.return_value = mock_referred_table

        with patch(
            "metadata.ingestion.source.database.common_db_source.fqn._build",
            return_value="test_service.other_db.public.orders.order_id",
        ), patch(
            "metadata.ingestion.source.database.common_db_source.get_relationship_type",
            return_value=None,
        ):
            result = source._prepare_foreign_constraints(
                supports_database=True,
                column={
                    "referred_schema": "public",
                    "referred_database": "other_db",
                    "referred_table": "orders",
                    "referred_columns": ["order_id"],
                    "constrained_columns": ["order_id"],
                },
                table_name="line_items",
                schema_name="public",
                db_name="test_db",
                columns=MOCK_COLUMNS,
            )

        source.metadata.get_by_name.assert_called_once_with(
            entity=Table,
            fqn="test_service.other_db.public.orders",
        )
        assert result is not None

    def test_referred_table_not_found_appends_to_global_foreign_tables(self, source):
        """When the referred table is not found in metadata, the FK should
        be added to global foreign_tables for deferred resolution."""
        source.metadata.get_by_name.return_value = None

        result = source._prepare_foreign_constraints(
            supports_database=False,
            column={
                "referred_schema": None,
                "referred_table": "orders",
                "referred_columns": ["order_id"],
                "constrained_columns": ["order_id"],
            },
            table_name="line_items",
            schema_name="public",
            db_name="test_db",
            columns=MOCK_COLUMNS,
        )

        assert result is None
        assert len(source.context.get_global.return_value.foreign_tables) == 1


class TestNormalizeTableConstraints:
    """Test DatabaseServiceSource.normalize_table_constraints."""

    def test_case_mismatch_is_normalized(self):
        """Constraint column names with different casing should be
        normalized to match actual column definitions."""
        columns = [
            Column(name="Entity_ID", dataType=DataType.INT),
            Column(name="Entity_Type", dataType=DataType.INT),
        ]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.CLUSTER_KEY,
                columns=["Entity_id", "Entity_Type"],
            )
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, columns)
        assert result[0].columns == ["Entity_ID", "Entity_Type"]

    def test_all_lowercase_constraint_columns(self):
        """Fully lowercase constraint columns should resolve to actual casing."""
        columns = [
            Column(name="OrderID", dataType=DataType.INT),
            Column(name="CustomerName", dataType=DataType.STRING),
        ]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.PRIMARY_KEY,
                columns=["orderid", "customername"],
            )
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, columns)
        assert result[0].columns == ["OrderID", "CustomerName"]

    def test_already_matching_columns_unchanged(self):
        """Columns that already match should pass through unchanged."""
        columns = [
            Column(name="id", dataType=DataType.INT),
            Column(name="name", dataType=DataType.STRING),
        ]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.UNIQUE,
                columns=["id", "name"],
            )
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, columns)
        assert result[0].columns == ["id", "name"]

    def test_unmatched_columns_preserved(self):
        """Constraint columns not found in column definitions should be
        kept as-is (fallback)."""
        columns = [
            Column(name="id", dataType=DataType.INT),
        ]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.CLUSTER_KEY,
                columns=["id", "missing_col"],
            )
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, columns)
        assert result[0].columns == ["id", "missing_col"]

    def test_empty_constraints_returns_empty(self):
        """Empty or None constraints should return an empty list."""
        columns = [Column(name="id", dataType=DataType.INT)]
        assert DatabaseServiceSource.normalize_table_constraints([], columns) == []
        assert DatabaseServiceSource.normalize_table_constraints(None, columns) == []

    def test_empty_columns_returns_constraints_unchanged(self):
        """Empty columns list should return constraints as-is."""
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.PRIMARY_KEY,
                columns=["id"],
            )
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, [])
        assert result[0].columns == ["id"]

    def test_multiple_constraints_normalized(self):
        """All constraints in the list should be normalized."""
        columns = [
            Column(name="Entity_ID", dataType=DataType.INT),
            Column(name="Created_At", dataType=DataType.DATETIME),
        ]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.CLUSTER_KEY,
                columns=["entity_id"],
            ),
            TableConstraint(
                constraintType=ConstraintType.PRIMARY_KEY,
                columns=["ENTITY_ID"],
            ),
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, columns)
        assert result[0].columns == ["Entity_ID"]
        assert result[1].columns == ["Entity_ID"]

    def test_constraint_with_none_columns_skipped(self):
        """Constraints with None columns field should not cause errors."""
        columns = [Column(name="id", dataType=DataType.INT)]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.CLUSTER_KEY,
                columns=None,
            ),
            TableConstraint(
                constraintType=ConstraintType.PRIMARY_KEY,
                columns=["ID"],
            ),
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, columns)
        assert result[0].columns is None
        assert result[1].columns == ["id"]


class _ReleaseOnlySurrogate(CommonDbSourceService):
    """
    Minimal concrete subclass that bypasses CommonDbSourceService.__init__
    (which needs a full workflow config) so we can drive _release_engine /
    close against a real SQLAlchemy engine in isolation.
    """

    def __init__(self, engine=None):  # pylint: disable=super-init-not-called
        self.engine = engine
        self.connection_obj = engine
        self._connection_map = {}
        self._inspector_map = {}
        self.session = None
        self.ssl_manager = None

    def create(self, *args, **kwargs):  # satisfy abstract method contract
        raise NotImplementedError


def _make_release_surrogate(engine=None):
    """
    Build a minimal stand-in for CommonDbSourceService that has just the
    attributes _release_engine touches, bypassing the heavy __init__ that
    requires a full workflow config.
    """
    return _ReleaseOnlySurrogate(engine=engine)


@pytest.fixture
def sqlite_engine():
    """Real, in-memory SQLite engine with an explicit QueuePool."""
    engine = create_engine("sqlite:///:memory:", poolclass=QueuePool)
    yield engine
    try:
        engine.dispose()
    except Exception:
        pass


@pytest.fixture
def surrogate(sqlite_engine):
    """Minimal CommonDbSourceService with a real engine attached."""
    return _make_release_surrogate(sqlite_engine)


class TestReleaseEngine:
    """Option B: _release_engine closes all pooled connections, clears
    inspector/session state, and disposes the engine regardless of
    which thread called it."""

    def test_closes_every_connection_map_entry(self, surrogate):
        conn_a = surrogate.engine.connect()
        conn_b = surrogate.engine.connect()
        surrogate._connection_map[111] = conn_a
        surrogate._connection_map[222] = conn_b

        surrogate._release_engine()

        assert conn_a.closed is True
        assert conn_b.closed is True
        assert surrogate._connection_map == {}

    def test_clears_inspector_map(self, surrogate):
        surrogate._connection_map[999] = surrogate.engine.connect()
        surrogate._inspector_map[999] = inspect(surrogate._connection_map[999])
        assert len(surrogate._inspector_map) == 1

        surrogate._release_engine()

        assert surrogate._inspector_map == {}

    def test_disposes_pool_and_clears_engine_ref(self, surrogate):
        captured_engine = surrogate.engine
        original_pool = captured_engine.pool
        assert isinstance(original_pool, QueuePool)
        connection = surrogate.engine.connect()
        surrogate._connection_map[1] = connection

        surrogate._release_engine()

        assert surrogate.engine is None
        assert connection.closed is True
        assert original_pool.checkedout() == 0

    def test_removes_session(self, surrogate):
        surrogate.session = create_and_bind_thread_safe_session(surrogate.engine)
        assert surrogate.session is not None

        surrogate._release_engine()

        assert surrogate.session is None

    def test_idempotent_when_engine_is_none(self):
        surrogate = _make_release_surrogate(engine=None)
        surrogate._release_engine()
        assert surrogate.engine is None
        assert surrogate._connection_map == {}
        assert surrogate._inspector_map == {}

    def test_tolerates_already_closed_connection(self, surrogate):
        healthy = surrogate.engine.connect()
        already_closed = surrogate.engine.connect()
        already_closed.close()
        surrogate._connection_map[1] = healthy
        surrogate._connection_map[2] = already_closed

        surrogate._release_engine()

        assert healthy.closed is True
        assert surrogate._connection_map == {}

    def test_clears_connection_obj_alongside_engine(self, surrogate):
        # connection_obj is set in __init__ to the initial engine and used by
        # test_connection(); without clearing it on release, it pins the
        # original Engine alive for the source's lifetime even after dispose.
        assert surrogate.connection_obj is surrogate.engine

        surrogate._release_engine()

        assert surrogate.connection_obj is None

    def test_closes_connections_from_arbitrary_thread_ids(self, surrogate):
        """Key property of Option B: close-all, not detach-current-thread.
        Every fairy in _connection_map must close regardless of the caller's
        thread id."""
        conns = {
            111: surrogate.engine.connect(),
            222: surrogate.engine.connect(),
            333: surrogate.engine.connect(),
        }
        surrogate._connection_map.update(conns)

        surrogate._release_engine()

        for conn in conns.values():
            assert conn.closed is True
        assert surrogate._connection_map == {}


class TestEngineGcReclamation:
    """Acceptance test for the memory leak fix: after _release_engine and
    dropping the strong reference, the old Engine must be garbage-collectable.
    The previous kill_active_connections path left _ConnectionRecord fairies
    pinning the engine, which is what this test guards against."""

    def test_old_engine_becomes_gc_eligible_after_release(self):
        engine = create_engine("sqlite:///:memory:", poolclass=QueuePool)
        surrogate = _make_release_surrogate(engine)
        surrogate._connection_map[12345] = surrogate.engine.connect()

        old_engine_ref = weakref.ref(surrogate.engine)

        surrogate._release_engine()
        surrogate.engine = None
        engine = None  # drop local strong ref too

        gc.collect()

        assert old_engine_ref() is None


class _FakeSource(MultiDBSource):
    """Minimal MultiDBSource that exposes a real SQLAlchemy connection so we
    can exercise _execute_database_query against a live cursor."""

    def __init__(self, engine: Engine):
        self._engine = engine
        self._conn = engine.connect()

    @property
    def connection(self):
        return self._conn

    def close(self):
        try:
            self._conn.close()
        except Exception:
            pass

    def get_configured_database(self):
        return None

    def get_database_names_raw(self):
        return self._execute_database_query("SELECT name FROM dbs ORDER BY id")


class TestExecuteDatabaseQueryEagerFetch:
    """Option B Part 2: _execute_database_query must eagerly .fetchall()
    so that _release_engine closing the connection in _connection_map
    (the original regression pattern from set_inspector) does not
    invalidate the cursor the generator is iterating."""

    @pytest.fixture
    def seeded_engine(self):
        engine = create_engine("sqlite:///:memory:", poolclass=QueuePool)
        with engine.connect() as conn:
            conn.execute(text("CREATE TABLE dbs (id INTEGER PRIMARY KEY, name TEXT)"))
            conn.execute(
                text(
                    "INSERT INTO dbs(id, name) VALUES (1, 'alpha'), (2, 'beta'), (3, 'gamma')"
                )
            )
            conn.commit()
        yield engine
        try:
            engine.dispose()
        except Exception:
            pass

    @pytest.fixture
    def fake_source(self, seeded_engine):
        source = _FakeSource(seeded_engine)
        yield source
        source.close()

    def test_generator_survives_connection_close_mid_iteration(self, fake_source):
        # Simulates what _release_engine actually does: it close()s every
        # connection in _connection_map BEFORE disposing the engine. Without
        # .fetchall() the cursor would die at that close() and the next
        # yield would raise; with .fetchall() the rows are already buffered.
        generator = fake_source.get_database_names_raw()

        first = next(generator)
        assert first == "alpha"

        fake_source._conn.close()

        remaining = list(generator)
        assert remaining == ["beta", "gamma"]

    def test_returns_all_rows_in_order(self, fake_source):
        results = list(fake_source.get_database_names_raw())

        assert results == ["alpha", "beta", "gamma"]
