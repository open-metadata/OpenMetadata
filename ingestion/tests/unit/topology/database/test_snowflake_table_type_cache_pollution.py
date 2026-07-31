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
Regression test for the Snowflake column-reflection cache-key pollution.

SnowflakeSource._get_columns_internal used to forward ``table_type`` to
``inspector.get_columns(...)``. SQLAlchemy's ``@reflection.cache`` decorator
on the underlying dialect ``get_columns`` and ``_get_schema_columns``
includes ``**kw`` in its cache key, so a varying ``table_type`` (Regular for
base tables, View for views) produces distinct cache keys for the SAME
schema. On the table -> view transition this cache-misses on
``_get_schema_columns`` and re-materializes the whole schema's column
metadata (~1.6 GB for ~13k wide tables) -- the exact mechanism behind the
``COM_US_IMDNA_ADL.AWB_INTERM`` pod OOM (kernel SIGKILL at the 4 GB cgroup
limit, no traceback).

These tests pin the fix: ``_get_columns_internal`` must not forward
``table_type`` into ``inspector.get_columns(...)``. ``table_type`` is still
read by the early-return branches above (Stage / Stream) before that call.
"""

from unittest.mock import Mock

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeSource


def _call(inspector, table_type, table_name="T1"):
    """Drive SnowflakeSource._get_columns_internal as an unbound method --
    for Regular / View the code path only touches ``inspector`` and the
    module-level logger, so a bare Mock for ``self`` is sufficient."""
    SnowflakeSource._get_columns_internal(
        Mock(),
        schema_name="AWB_INTERM",
        table_name=table_name,
        db_name="COM_US_IMDNA_ADL",
        inspector=inspector,
        table_type=table_type,
    )


def test_table_type_is_not_forwarded_for_base_tables():
    inspector = Mock()
    inspector.get_columns.return_value = []

    _call(inspector, TableType.Regular, table_name="T1")

    assert inspector.get_columns.call_count == 1
    kwargs = inspector.get_columns.call_args_list[0].kwargs
    assert "table_type" not in kwargs, (
        f"table_type forwarded to inspector.get_columns ({kwargs}); this "
        "pollutes SQLAlchemy's @reflection.cache key and reintroduces the "
        "AWB_INTERM-style OOM at the table->view transition."
    )
    # db_name is still passed (Databricks reads kw['db_name']; for Snowflake
    # it's constant per database run so it does not vary the cache key)
    assert kwargs == {"db_name": "COM_US_IMDNA_ADL"}


def test_table_type_is_not_forwarded_for_views():
    inspector = Mock()
    inspector.get_columns.return_value = []

    _call(inspector, TableType.View, table_name="V1")

    kwargs = inspector.get_columns.call_args_list[0].kwargs
    assert "table_type" not in kwargs
    assert kwargs == {"db_name": "COM_US_IMDNA_ADL"}


def test_table_then_view_call_signatures_are_identical():
    """The smoking-gun assertion: at the table -> view transition the kwargs
    passed to inspector.get_columns must be identical so SQLAlchemy's
    @reflection.cache key on the downstream _get_schema_columns is stable."""
    inspector = Mock()
    inspector.get_columns.return_value = []

    _call(inspector, TableType.Regular, table_name="T1")
    _call(inspector, TableType.View, table_name="V1")

    assert inspector.get_columns.call_count == 2
    table_kwargs = inspector.get_columns.call_args_list[0].kwargs
    view_kwargs = inspector.get_columns.call_args_list[1].kwargs
    assert table_kwargs == view_kwargs, (
        f"kwargs differ between table call {table_kwargs} and view call "
        f"{view_kwargs}; this re-introduces the cache-miss that caused the "
        "AWB_INTERM 1.6 GB schema column re-materialization."
    )


def test_stage_short_circuit_still_works():
    """The Stage early-return path must still fire (it does not call
    inspector.get_columns at all -- Stages have no columns in Snowflake)."""
    inspector = Mock()

    _call(inspector, TableType.Stage, table_name="STG")

    assert inspector.get_columns.call_count == 0
