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
"""SQLAlchemy event-based DB introspection.

These tests use an in-memory SQLite engine to drive real `cursor.execute`
calls and assert that the diagnostics operation registry sees them as
`sqlite.query` operations.
"""

import threading

import pytest

sqlalchemy = pytest.importorskip("sqlalchemy")

# Imports must follow `importorskip` so the module is skipped cleanly
# in environments without SQLAlchemy.
from metadata.ingestion.diagnostics.collectors.operation_registry import OperationRegistry  # noqa: E402
from metadata.ingestion.diagnostics.seams.db_introspect import DbIntrospector  # noqa: E402


@pytest.fixture()
def registry():
    return OperationRegistry()


@pytest.fixture()
def introspector(registry):
    intro = DbIntrospector(registry)
    assert intro.install()
    yield intro
    intro.uninstall()


def test_query_appears_in_registry_during_execution(registry, introspector):
    """A captured op should be visible in the registry while the query runs."""
    from sqlalchemy import create_engine, event, text

    engine = create_engine("sqlite:///:memory:")

    seen_ops: list = []

    def _spy(conn, cursor, statement, parameters, context, executemany):
        # While `before_cursor_execute` listeners are mid-execution, our
        # introspector's `before` listener has already pushed the op. Sample
        # the registry at this exact point.
        seen_ops.append(registry.deepest_per_thread().get(threading.get_ident()))

    event.listen(engine, "before_cursor_execute", _spy)

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    finally:
        event.remove(engine, "before_cursor_execute", _spy)

    assert seen_ops, "spy did not capture the in-flight op"
    op_name, kwargs, _age = seen_ops[-1]
    assert op_name == "sqlite.query"
    assert "SELECT 1" in kwargs["sql"]


def test_op_is_popped_after_execution(registry, introspector):
    from sqlalchemy import create_engine, text

    engine = create_engine("sqlite:///:memory:")
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))

    # After the with-block exits, the registry should be empty for this thread.
    assert registry.deepest_per_thread().get(threading.get_ident()) is None


def test_op_is_popped_after_error(registry, introspector):
    from sqlalchemy import create_engine, text
    from sqlalchemy.exc import OperationalError

    engine = create_engine("sqlite:///:memory:")

    with pytest.raises(OperationalError), engine.connect() as conn:
        conn.execute(text("SELECT FROM nonexistent_table_xyz"))

    assert registry.deepest_per_thread().get(threading.get_ident()) is None


def test_sql_kwarg_is_truncated(registry, introspector):
    """A huge SQL string must not be held in the registry verbatim."""
    from sqlalchemy import create_engine, text

    big_comment = "/* " + ("x" * 5000) + " */ SELECT 1"
    engine = create_engine("sqlite:///:memory:")

    captured_kwargs: dict = {}

    def _spy(conn, cursor, statement, parameters, context, executemany):
        captured_kwargs.update(registry.deepest_per_thread().get(threading.get_ident())[1])

    from sqlalchemy import event

    event.listen(engine, "before_cursor_execute", _spy)
    try:
        with engine.connect() as conn:
            conn.execute(text(big_comment))
    finally:
        event.remove(engine, "before_cursor_execute", _spy)

    assert "sql" in captured_kwargs
    # The introspector truncates to 2000 chars before push.
    assert len(captured_kwargs["sql"]) <= 2100


def test_install_returns_false_without_sqlalchemy(registry, monkeypatch):
    """Robustness: if SQLAlchemy ever became optional, install returns False."""
    import builtins

    real_import = builtins.__import__

    def _no_sqlalchemy(name, *a, **kw):
        if name.startswith("sqlalchemy"):
            raise ImportError("simulated")
        return real_import(name, *a, **kw)

    monkeypatch.setattr(builtins, "__import__", _no_sqlalchemy)

    intro = DbIntrospector(registry)
    assert intro.install() is False


def test_uninstall_is_idempotent(registry):
    intro = DbIntrospector(registry)
    intro.install()
    intro.uninstall()
    intro.uninstall()  # must not raise
