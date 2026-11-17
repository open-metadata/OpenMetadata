#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""SQL compilation contracts for the functions used by Oracle table-diff sampling."""

import pytest
from sqlalchemy import bindparam, literal
from sqlalchemy.dialects import oracle, postgresql
from sqlalchemy.engine.default import DefaultDialect
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.sql.elements import ColumnElement

from metadata.profiler.orm.functions.md5 import MD5
from metadata.profiler.orm.functions.substr import Substr


@pytest.mark.parametrize(
    "expression, expected",
    (
        (Substr(literal("abcdef"), 2, 3), "SUBSTR('abcdef', 2, 3)"),
        (MD5(literal("a'b")), "LOWER(RAWTOHEX(STANDARD_HASH(TO_CHAR('a''b'), 'MD5')))"),
        (
            Substr(MD5(literal("abc")), 1, 8) < "0000000a",
            "SUBSTR(LOWER(RAWTOHEX(STANDARD_HASH(TO_CHAR('abc'), 'MD5'))), 1, 8) < '0000000a'",
        ),
    ),
    ids=("substring-positions", "escaped-hash-input", "sampling-prefix-and-threshold"),
)
def test_oracle_functions_compile_to_supported_sql(expression: ColumnElement, expected: str) -> None:
    assert str(expression.compile(dialect=oracle.dialect(), compile_kwargs={"literal_binds": True})) == expected


def test_oracle_compilers_preserve_bound_parameters() -> None:
    expression = Substr(MD5(bindparam("key_text")), bindparam("prefix_start"), bindparam("prefix_length")) < bindparam(
        "nonce"
    )
    compiled = expression.compile(dialect=oracle.dialect())

    assert (
        str(compiled)
        == "SUBSTR(LOWER(RAWTOHEX(STANDARD_HASH(TO_CHAR(:key_text), 'MD5'))), :prefix_start, :prefix_length) < :nonce"
    )
    assert set(compiled.params) == {"key_text", "prefix_start", "prefix_length", "nonce"}


@pytest.mark.parametrize("dialect", (DefaultDialect(), postgresql.dialect()), ids=("default", "postgres"))
def test_other_dialects_keep_their_existing_compilation(dialect: Dialect) -> None:
    expression = Substr(MD5(literal("abc")), 1, 8) < "19999999"

    assert str(expression.compile(dialect=dialect, compile_kwargs={"literal_binds": True})) == (
        "SUBSTRING(MD5('abc'), 1, 8) < '19999999'"
    )
