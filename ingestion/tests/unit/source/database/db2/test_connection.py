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
"""Unit tests for DB2 connection handling."""

import sys
import types
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import column, table
from sqlalchemy.sql.elements import TextClause

from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    Db2Connection as Db2ConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    Db2Scheme,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.db2.connection import (
    Db2Connection,
    Db2IbmiStrategy,
)
from metadata.ingestion.source.database.db2.utils import (
    _ibmi_compat_select,
    patch_ibmi_dialect,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.db2.connection"
UTILS_MODULE = "metadata.ingestion.source.database.db2.utils"


def _ibmi_config() -> Db2ConnectionConfig:
    return Db2ConnectionConfig(
        scheme=Db2Scheme.ibmi,
        username="openmetadata_user",
        password="openmetadata_password",
        hostPort="myhost:8471",
        database="MYDB",
    )


def _db2_config() -> Db2ConnectionConfig:
    return Db2ConnectionConfig(
        scheme=Db2Scheme.db2_ibm_db,
        username="openmetadata_user",
        password="openmetadata_password",
        hostPort="localhost:50000",
        database="testdb",
    )


def test_db2_connection_is_base_connection():
    assert issubclass(Db2Connection, BaseConnection)


def test_ibmi_url_drops_the_port():
    config = _ibmi_config()
    assert (
        Db2IbmiStrategy(config).get_connection_url(config)
        == "ibmi://openmetadata_user:openmetadata_password@myhost/MYDB"
    )


def test_ibmi_args_pass_the_port_via_connect_args():
    config = _ibmi_config()
    assert Db2IbmiStrategy(config).get_connection_args(config)["port"] == 8471


def test_ibmi_args_reject_a_non_numeric_port():
    config = _ibmi_config()
    config.hostPort = "myhost:not-a-port"
    with pytest.raises(ValueError, match="Invalid port"):
        Db2IbmiStrategy(config).get_connection_args(config)


def test_get_client_dispatches_ibmi_scheme_to_ibmi_strategy():
    config = _ibmi_config()
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = Db2Connection(config).client
    url_fn = mock_connection.call_args.kwargs["get_connection_url_fn"]
    assert url_fn.__name__ == "get_connection_url"
    assert url_fn(config) == "ibmi://openmetadata_user:openmetadata_password@myhost/MYDB"


def test_get_client_dispatches_db2_scheme_to_standard_strategy():
    config = _db2_config()
    with (
        patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection,
        patch(f"{CONNECTION_MODULE}.check_ssl_and_init", return_value=None),
    ):
        _ = Db2Connection(config).client
    assert mock_connection.call_args.kwargs["get_connection_url_fn"].__name__ == "get_connection_url_common"


def test_ibmi_strategy_patches_the_dialect_before_building_the_engine():
    config = _ibmi_config()
    with (
        patch(f"{CONNECTION_MODULE}.create_generic_db_connection"),
        patch(f"{CONNECTION_MODULE}.patch_ibmi_dialect") as mock_patch,
    ):
        _ = Db2Connection(config).client
    mock_patch.assert_called_once()


def test_standard_strategy_does_not_patch_the_ibmi_dialect():
    config = _db2_config()
    with (
        patch(f"{CONNECTION_MODULE}.create_generic_db_connection"),
        patch(f"{CONNECTION_MODULE}.check_ssl_and_init", return_value=None),
        patch(f"{CONNECTION_MODULE}.patch_ibmi_dialect") as mock_patch,
    ):
        _ = Db2Connection(config).client
    mock_patch.assert_not_called()


_TABLE = table("t", column("a"), column("b"))


def test_compat_select_accepts_the_legacy_column_list():
    assert "SELECT t.a, t.b" in str(_ibmi_compat_select([_TABLE.c.a, _TABLE.c.b]))


def test_compat_select_accepts_a_positional_whereclause():
    statement = str(_ibmi_compat_select([_TABLE.c.a], _TABLE.c.b == "x"))
    assert "WHERE t.b =" in statement


def test_compat_select_expands_a_whole_table():
    statement = str(_ibmi_compat_select([_TABLE], _TABLE.c.a == "z"))
    assert "SELECT t.a, t.b" in statement
    assert "WHERE t.a =" in statement


def test_compat_select_ignores_a_none_whereclause():
    assert "WHERE" not in str(_ibmi_compat_select([_TABLE.c.a], None))


def test_compat_select_supports_where_chaining():
    statement = _ibmi_compat_select([_TABLE.c.a]).where(_TABLE.c.b == "y")
    assert "WHERE t.b =" in str(statement)


def test_compat_select_passes_the_modern_form_through():
    assert "SELECT t.a, t.b" in str(_ibmi_compat_select(_TABLE.c.a, _TABLE.c.b))


def test_compat_select_carries_over_the_legacy_order_by_keyword():
    """get_foreign_keys/get_indexes group composite constraints in column order."""
    statement = str(_ibmi_compat_select([_TABLE.c.a], _TABLE.c.b == "x", order_by=[_TABLE.c.b]))
    assert "ORDER BY t.b" in statement


def test_compat_select_rejects_unsupported_legacy_keywords():
    with pytest.raises(TypeError, match="Unsupported legacy select"):
        _ibmi_compat_select([_TABLE.c.a], distinct=True)


@pytest.fixture
def ibmi_dialect():
    """The patched dialect plus a bare instance to invoke unbound methods on."""
    base = pytest.importorskip("sqlalchemy_ibmi.base")
    patch_ibmi_dialect()
    dialect = base.IBMiDb2Dialect.__new__(base.IBMiDb2Dialect)
    dialect.normalize_name = lambda name: name.strip().lower() if name else name

    return base, dialect


def test_default_schema_name_is_sent_as_an_executable_clause(ibmi_dialect):
    """SA 2.0 raises ObjectNotExecutableError on the raw string used upstream."""
    base, dialect = ibmi_dialect
    connection = MagicMock()
    connection.execute.return_value.scalar.return_value = "MYLIB  "

    assert base.IBMiDb2Dialect._get_default_schema_name(dialect, connection) == "mylib"
    assert isinstance(connection.execute.call_args[0][0], TextClause)


def test_check_text_server_is_sent_as_an_executable_clause(ibmi_dialect):
    base, dialect = ibmi_dialect
    connection = MagicMock()
    connection.execute.return_value.scalar.return_value = 1

    assert base.IBMiDb2Dialect._check_text_server(dialect, connection) == 1
    assert isinstance(connection.execute.call_args[0][0], TextClause)


def test_reflection_queries_compile_under_sqlalchemy_2(ibmi_dialect):
    """get_schema_names uses the legacy select([...]) form the shim rewrites."""
    base, dialect = ibmi_dialect
    connection = MagicMock()
    connection.execute.return_value = [("myschema",)]

    names = base.IBMiDb2Dialect.get_schema_names.__wrapped__(dialect, connection)

    assert names == ["myschema"]


def test_index_reflection_preserves_composite_column_order(ibmi_dialect):
    """get_indexes passes order_by= as a legacy keyword; dropping it would return
    composite index columns in nondeterministic order."""
    base, dialect = ibmi_dialect
    dialect.denormalize_name = lambda name: name
    connection = MagicMock()
    connection.execute.return_value = [("IDX", "D", "COL_A"), ("IDX", "D", "COL_B")]

    indexes = base.IBMiDb2Dialect.get_indexes.__wrapped__(dialect, connection, "mytable", schema="myschema")

    assert indexes[0]["column_names"] == ["col_a", "col_b"]
    assert "ORDER BY" in str(connection.execute.call_args[0][0])


def test_patching_the_dialect_twice_is_idempotent(ibmi_dialect):
    assert patch_ibmi_dialect() is True
    assert patch_ibmi_dialect() is True


def test_patching_is_skipped_when_the_dialect_module_is_partially_initialised():
    """An interrupted import leaves a module that imports but has no dialect."""
    half_loaded = types.ModuleType("sqlalchemy_ibmi.base")
    with (
        patch.dict(
            sys.modules,
            {
                "sqlalchemy_ibmi": types.ModuleType("sqlalchemy_ibmi"),
                "sqlalchemy_ibmi.base": half_loaded,
            },
        ),
        patch(f"{UTILS_MODULE}._IBMI_PATCHED", False),
    ):
        assert patch_ibmi_dialect() is False


def test_patching_is_skipped_when_sqlalchemy_ibmi_is_absent():
    with (
        patch.dict(sys.modules, {"sqlalchemy_ibmi.base": None}),
        patch(f"{UTILS_MODULE}._IBMI_PATCHED", False),
    ):
        assert patch_ibmi_dialect() is False
