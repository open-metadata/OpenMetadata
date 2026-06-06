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
Tests for the bounded LRU on Snowflake's ``get_schema_columns``.

Background: ``info_cache`` is only cleared between databases (see
``common_db_source.py:_release_engine``), so the stock ``@reflection.cache``
on ``get_schema_columns`` accumulated every schema's column metadata in
RAM for the entire database run -- ~1.6 GB per pathologically wide schema,
OOM-killing 4 GB pods. The replacement is a per-Inspector bounded LRU
(``SCHEMA_COLUMNS_CACHE_SIZE``) stored under a private key on
``info_cache`` so it inherits the per-thread isolation that
``_inspector_map`` already provides.
"""

from unittest.mock import Mock, patch

import pytest
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect

from metadata.ingestion.source.database.snowflake import utils as snowflake_utils
from metadata.ingestion.source.database.snowflake.utils import (
    _SCHEMA_COLUMNS_LRU_KEY,
    get_schema_columns,
)

# A single-row mock result; the exact content doesn't matter for these
# tests -- we only care about cache structure and execute() call counts.
_MOCK_COL_ROW = ("T1", "ID", "NUMBER", None, 10, 0, "NO", None, "NO", None, None, None, 1)


def _make_dialect():
    dialect = SnowflakeDialect()
    dialect.normalize_name = lambda x: x
    dialect.denormalize_name = lambda x: x
    return dialect


def _make_connection_returning_rows(rows=(_MOCK_COL_ROW,)):
    """Return a Mock connection whose ``execute`` returns a fresh
    iterable on each call -- we want every miss to actually iterate the
    rows, so the iterator must not be exhausted across calls."""
    connection = Mock()

    def execute_side_effect(*args, **kwargs):
        result = Mock()
        result.__iter__ = Mock(return_value=iter(list(rows)))
        return result

    connection.execute = Mock(side_effect=execute_side_effect)
    return connection


def _call(dialect, connection, schema, info_cache):
    with (
        patch.object(dialect, "_current_database_schema", return_value=("DB", schema)),
        patch.object(dialect, "_get_schema_primary_keys", return_value={}),
    ):
        return get_schema_columns(dialect, connection, schema, info_cache=info_cache)


def test_same_schema_returns_cached_dict_without_rerunning_query():
    """Two calls for the same schema -> bulk SCHEMA_COLUMNS query runs once."""
    dialect = _make_dialect()
    connection = _make_connection_returning_rows()
    info_cache = {}

    first = _call(dialect, connection, "S1", info_cache)
    second = _call(dialect, connection, "S1", info_cache)

    assert first is second
    assert connection.execute.call_count == 1


def test_lru_evicts_oldest_entry_when_over_size(monkeypatch):
    """With cache size 2, adding a 3rd schema drops the oldest."""
    monkeypatch.setattr(snowflake_utils, "SCHEMA_COLUMNS_CACHE_SIZE", 2)
    dialect = _make_dialect()
    connection = _make_connection_returning_rows()
    info_cache = {}

    _call(dialect, connection, "S1", info_cache)
    _call(dialect, connection, "S2", info_cache)
    _call(dialect, connection, "S3", info_cache)

    lru = info_cache[_SCHEMA_COLUMNS_LRU_KEY]
    assert list(lru.keys()) == ["S2", "S3"]
    assert "S1" not in lru


def test_lru_recency_protects_long_running_schema(monkeypatch):
    """The user's "long-running schema" concern: re-querying an active
    schema marks it most-recently-used, so cycling other (small)
    schemas does NOT evict it."""
    monkeypatch.setattr(snowflake_utils, "SCHEMA_COLUMNS_CACHE_SIZE", 2)
    dialect = _make_dialect()
    connection = _make_connection_returning_rows()
    info_cache = {}

    _call(dialect, connection, "A", info_cache)  # cache: [A]
    _call(dialect, connection, "B", info_cache)  # cache: [A, B]
    _call(dialect, connection, "A", info_cache)  # cache: [B, A] -- A re-touched
    _call(dialect, connection, "C", info_cache)  # cache: [A, C] -- B evicted

    lru = info_cache[_SCHEMA_COLUMNS_LRU_KEY]
    assert "A" in lru, "actively-queried schema must not be evicted"
    assert "C" in lru
    assert "B" not in lru


def test_eviction_drops_per_table_get_columns_entries(monkeypatch):
    """When a schema is evicted from the LRU, the per-table
    ``get_columns`` reflection cache entries for it are also cleared.
    Without this, the per-table entries pin the column lists and memory
    is not actually freed."""
    monkeypatch.setattr(snowflake_utils, "SCHEMA_COLUMNS_CACHE_SIZE", 1)
    dialect = _make_dialect()
    connection = _make_connection_returning_rows()
    info_cache = {}

    # Seed per-table @reflection.cache entries for two schemas. Key layout
    # mirrors what SQLAlchemy's @reflection.cache produces:
    # (fn_name, server_version_info, default_schema_name, args, kw_items, exclude)
    info_cache[("get_columns", None, None, ("T_a", "S1"), (), None)] = "list-T_a"
    info_cache[("get_columns", None, None, ("T_b", "S1"), (), None)] = "list-T_b"
    info_cache[("get_columns", None, None, ("U_a", "S2"), (), None)] = "list-U_a"

    _call(dialect, connection, "S1", info_cache)  # LRU: [S1]
    _call(dialect, connection, "S2", info_cache)  # LRU: [S2], S1 evicted

    s1_entries = [
        k
        for k in info_cache
        if isinstance(k, tuple) and k and k[0] == "get_columns" and isinstance(k[3], tuple) and k[3][1] == "S1"
    ]
    s2_entries = [
        k
        for k in info_cache
        if isinstance(k, tuple) and k and k[0] == "get_columns" and isinstance(k[3], tuple) and k[3][1] == "S2"
    ]
    assert s1_entries == [], f"S1 per-table entries still in info_cache after eviction: {s1_entries}"
    assert s2_entries, "S2 per-table entries should remain"


def test_no_info_cache_falls_through_to_uncached_compute():
    """If the caller did not pass an info_cache (rare, but supported
    by SQLAlchemy's reflection plumbing), the function should still
    return a result -- without caching anywhere."""
    dialect = _make_dialect()
    connection = _make_connection_returning_rows()

    with (
        patch.object(dialect, "_current_database_schema", return_value=("DB", "S1")),
        patch.object(dialect, "_get_schema_primary_keys", return_value={}),
    ):
        result1 = get_schema_columns(dialect, connection, "S1")
        result2 = get_schema_columns(dialect, connection, "S1")

    # Both calls returned a populated dict; no caching means the query
    # ran each time (this is the documented behaviour of
    # @reflection.cache when info_cache is absent).
    assert result1 is not None
    assert result2 is not None
    assert connection.execute.call_count == 2


def test_none_result_from_90030_is_cached():
    """The 90030 ("Information schema query returned too much data")
    fallback returns None to trigger per-table reflection in
    ``get_columns``. The None must be cached so subsequent tables in
    the same schema don't re-run the bulk query just to hit 90030."""
    dialect = _make_dialect()

    class _FakeOrigError(Exception):
        errno = 90030

    err = __import__("sqlalchemy").exc.ProgrammingError(statement="", params=None, orig=_FakeOrigError())

    connection = Mock()
    connection.execute = Mock(side_effect=err)
    info_cache = {}

    with (
        patch.object(dialect, "_current_database_schema", return_value=("DB", "S")),
        patch.object(dialect, "_get_schema_primary_keys", return_value={}),
    ):
        first = get_schema_columns(dialect, connection, "S", info_cache=info_cache)
        second = get_schema_columns(dialect, connection, "S", info_cache=info_cache)

    assert first is None
    assert second is None
    # First call hit 90030 once; second call must short-circuit via the LRU
    # (no second execute, no second 90030).
    assert connection.execute.call_count == 1
    assert info_cache[_SCHEMA_COLUMNS_LRU_KEY]["S"] is None


def test_env_var_overrides_cache_size(monkeypatch):
    """Operators can tune the cache size via OM_SNOWFLAKE_SCHEMA_COLUMNS_CACHE_SIZE.
    The value is read at module import, so this exercises the parsing branch
    by reloading the module."""
    import importlib

    monkeypatch.setenv("OM_SNOWFLAKE_SCHEMA_COLUMNS_CACHE_SIZE", "5")
    reloaded = importlib.reload(snowflake_utils)
    try:
        assert reloaded.SCHEMA_COLUMNS_CACHE_SIZE == 5
    finally:
        # Reset to default for the rest of the test session
        monkeypatch.delenv("OM_SNOWFLAKE_SCHEMA_COLUMNS_CACHE_SIZE")
        importlib.reload(snowflake_utils)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
