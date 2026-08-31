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
Validate the SQL the profiler emits against the real Databricks dialect.
"""

import pytest
import sqlalchemy as sa
from databricks.sqlalchemy import DatabricksDialect
from sqlalchemy import quoted_name

from metadata.profiler.interface.sqlalchemy.databricks.profiler_interface import (
    DatabricksProfilerInterface,
)
from metadata.profiler.orm.functions.modulo import ModuloFn
from metadata.profiler.orm.functions.random_num import RandomNumFn


@pytest.fixture(scope="module")
def dialect():
    """Databricks dialect with the profiler compiler overrides installed."""
    statement_compiler = DatabricksDialect.statement_compiler
    original = (statement_compiler.visit_column, statement_compiler.visit_table)
    DatabricksProfilerInterface._patch_databricks_statement_compiler()
    yield DatabricksDialect()
    statement_compiler.visit_column, statement_compiler.visit_table = original


def compile_select(dialect, table, column_key):
    return str(sa.select(table.c[column_key]).compile(dialect=dialect))


def test_lowercase_identifiers_are_left_unquoted(dialect):
    """Databricks does not quote all-lowercase identifiers, and neither should we."""
    table = sa.Table("my_table", sa.MetaData(), sa.Column("my_col", sa.Boolean), schema="my_schema")

    query = compile_select(dialect, table, "my_col")

    assert "SELECT my_schema.my_table.my_col" in query
    assert "`" not in query


def test_quoted_identifiers_keep_their_backticks(dialect):
    """Mixed-case identifiers are quoted by the dialect and must stay balanced."""
    table = sa.Table("MyTable", sa.MetaData(), sa.Column("MyCol", sa.Boolean), schema="MySchema")

    query = compile_select(dialect, table, "MyCol")

    assert "SELECT `MySchema`.`MyTable`.`MyCol`" in query
    assert query.count("`") % 2 == 0


def test_struct_children_are_quoted_individually(dialect):
    """Struct paths arrive pre-quoted with quoting disabled, mirroring _get_struct_columns."""
    nested = quoted_name("`addr`.`city`", False)
    table = sa.Table("MyTable", sa.MetaData(), sa.Column(nested, sa.String), schema="MySchema")

    query = compile_select(dialect, table, nested)

    assert "SELECT `MySchema`.`MyTable`.`addr`.`city`" in query


def test_modulo_compiles_to_a_spark_function(dialect):
    """The generic `%%` escape is only valid for pyformat drivers, not Databricks."""
    compiled = str(ModuloFn(RandomNumFn(), 100).compile(dialect=dialect, compile_kwargs={"literal_binds": True}))

    assert compiled == "MOD(ABS(RANDOM()) * 100, 100)"
    assert "%%" not in compiled
