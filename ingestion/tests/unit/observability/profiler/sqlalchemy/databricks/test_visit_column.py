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
"""Validate profiler column SQL against the Databricks dialect."""

from collections.abc import Generator

import pytest
import sqlalchemy as sa
from databricks.sqlalchemy.base import DatabricksDialect
from sqlalchemy import quoted_name

from metadata.profiler.interface.sqlalchemy.databricks.profiler_interface import (
    DatabricksProfilerInterface,
)


@pytest.fixture(scope="module")
def dialect() -> Generator[DatabricksDialect, None, None]:
    statement_compiler = DatabricksDialect.statement_compiler
    original = (statement_compiler.visit_column, statement_compiler.visit_table)
    DatabricksProfilerInterface._patch_databricks_statement_compiler()
    yield DatabricksDialect()
    statement_compiler.visit_column, statement_compiler.visit_table = original


def compile_select(
    dialect: DatabricksDialect,
    schema: str,
    table_name: str,
    column_name: str,
) -> str:
    table = sa.Table(
        table_name,
        sa.MetaData(),
        sa.Column(column_name, sa.String),
        schema=schema,
    )
    return str(sa.select(table.c[column_name]).compile(dialect=dialect))


@pytest.mark.parametrize(
    "schema,table_name,column_name,expected",
    [
        ("my_schema", "my_table", "my_col", "my_schema.my_table.my_col"),
        ("my_schema", "my_table", "CamelCase", "my_schema.my_table.`CamelCase`"),
        ("default", "my_table", "my_col", "`default`.my_table.my_col"),
        ("MySchema", "MyTable", "MyCol", "`MySchema`.`MyTable`.`MyCol`"),
        (
            "MySchema",
            "MyTable",
            quoted_name("`address`.`city`", False),
            "`MySchema`.`MyTable`.`address`.`city`",
        ),
    ],
)
def test_column_identifiers_compile_to_valid_sql(
    dialect: DatabricksDialect,
    schema: str,
    table_name: str,
    column_name: str,
    expected: str,
) -> None:
    query = compile_select(dialect, schema, table_name, column_name)

    assert f"SELECT {expected}" in query
