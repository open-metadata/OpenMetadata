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
Mixins for fetching failed row samples from test case validations.

SQARowSamplerMixin: SQLAlchemy-based row sampling (builds query, captures compiled SQL)
PandasFailedRowSamplerMixin: DataFrame-based row sampling (filters chunks via df.query())
"""

from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, cast

import sqlglot
from sqlalchemy import Table, inspect, text
from sqlalchemy.engine import Dialect
from sqlalchemy.engine.default import DefaultDialect
from sqlglot import exp
from sqlglot.optimizer.normalize_identifiers import normalize_identifiers

from metadata.generated.schema.entity.data.table import ColumnName, TableData
from metadata.profiler.orm.types.custom_hex_byte_string import HexByteString
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import test_suite_logger

if TYPE_CHECKING:
    from pandas import DataFrame

logger = test_suite_logger()

FAILED_ROW_SAMPLE_SIZE = 50
_HEX_BYTE_STRING = HexByteString()
_DEFAULT_DIALECT = DefaultDialect()


class PandasFailedRowSamplerMixin:
    """Mixin to fetch failed row samples from Pandas DataFrames"""

    def _get_failed_rows_sample(self) -> tuple[list[str], list[list[Any]]]:
        cols = None
        rows = []
        for chunk in self.runner():
            if cols is None:
                cols = chunk.columns.tolist()
            prepared_chunk = chunk[cols]
            _filter = self.filter()

            if isinstance(_filter, str):
                # Backwards-compatible path: string expression evaluated via DataFrame.query
                filtered_chunk = prepared_chunk.query(_filter)
            else:
                # New path: support boolean masks, callables, or pre-filtered DataFrames
                criteria = _filter(prepared_chunk) if callable(_filter) else _filter

                if criteria is None:
                    # No filtering; keep full chunk
                    filtered_chunk = prepared_chunk
                else:
                    # Try treating the criteria as a mask for boolean indexing first.
                    # If that fails, assume it is already a filtered DataFrame-like object.
                    try:
                        filtered_chunk = prepared_chunk[criteria]
                    except Exception:  # pylint: disable=broad-except
                        filtered_chunk = criteria

            chunk_rows = filtered_chunk.values.tolist()
            rows.extend(chunk_rows[:FAILED_ROW_SAMPLE_SIZE])
            if len(rows) >= FAILED_ROW_SAMPLE_SIZE:
                break

        return cols or [], rows


class SQARowSamplerMixin:
    """Mixin to fetch failed row samples from SQLAlchemy queries"""

    def _get_failed_rows_sample(self) -> tuple[list[str], list[list[Any]]]:
        # pylint: disable=protected-access
        self.runner = cast(QueryRunner, self.runner)  # noqa: TC006
        cols = list(inspect(self.runner.dataset).c)
        _filter = self.filter()
        if isinstance(_filter, dict):
            query = self.runner._select_from_sample(*cols, query_filter_=_filter)
        else:
            query = self.runner._select_from_sample(*cols)
            query = query.filter(_filter)

        self._inspection_query = str(query.statement.compile(compile_kwargs={"literal_binds": True}))

        rows = query.limit(FAILED_ROW_SAMPLE_SIZE).all()
        return [col.name for col in cols], [list(row) for row in rows]


def table_columns_sample(
    table: Table, columns: list[str], rows: Sequence[Sequence[Any]], *, sql: str, table_reference: str, dialect: Dialect
) -> tuple[list[str], list[list[Any]]] | None:
    """Retain only output attributable to unchanged columns of the linked physical table.

    Server masking uses output names, so name membership alone cannot protect renamed sensitive values.
    See ADR:2026-11-12-rule-library-failed-rows-samples-keep-server-column-validation.
    """
    if not rows:
        return None
    table_columns = {column.name.lower() for column in inspect(table).c}
    if any(column.lower() not in table_columns for column in columns) or not _source_columns_only(
        sql, table_reference, dialect, table_columns
    ):
        logger.info(
            "Rule output cannot be attributed to unchanged source columns and is not stored as a failed rows sample"
        )
        return None
    return columns, [[_sample_value(value) for value in row] for row in rows[:FAILED_ROW_SAMPLE_SIZE]]


def _source_columns_only(sql: str, table_reference: str, dialect: Dialect, columns: set[str]) -> bool:
    """Fail closed on syntax or source identity that this bounded projection check cannot establish."""
    # SQLGlot ignores MySQL/MariaDB executable comments, which can hide renamed projections.
    if "/*!" in sql or "/*m!" in sql.lower():
        return False
    # MySQL/MariaDB modes can change literal boundaries, and SQLGlot may read a
    # double dash as a comment where the server reads it as part of an expression.
    if dialect.name in {"mysql", "mariadb"} and ("\\" in sql or "--" in sql):
        return False
    try:
        name = {"postgresql": "postgres", "mssql": "tsql"}.get(dialect.name, dialect.name)
        parsed = sqlglot.parse(sql, read=name, error_level=sqlglot.ErrorLevel.RAISE)
        if len(parsed) != 1 or not isinstance(parsed[0], exp.Select):
            return False
        query = normalize_identifiers(parsed[0], dialect=name)
        allowed = {"expressions", "from_", "where", "group", "having", "order", "limit", "offset", "distinct"}
        if any(value and key not in allowed for key, value in query.args.items()):
            return False
        if len(list(query.find_all(exp.Select))) != 1 or query.find(exp.Subquery):
            return False
        tables = list(query.find_all(exp.Table))
        source = query.args.get("from_")
        if len(tables) != 1 or source is None or source.this is not tables[0]:
            return False
        table = tables[0]
        if any(value and key not in {"this", "db", "catalog", "alias"} for key, value in table.args.items()):
            return False
        if not all(isinstance(part, exp.Identifier) for part in table.parts):
            return False
        expected = (
            normalize_identifiers(sqlglot.parse_one(f"SELECT * FROM {table_reference}", read=name), dialect=name)
            .args["from_"]
            .this
        )
        if [part.name for part in table.parts] != [part.name for part in expected.parts]:
            return False
        alias = table.args.get("alias")
        if alias and (alias.args.get("columns") or not isinstance(alias.this, exp.Identifier)):
            return False
        qualifiers = (
            [[table.alias]]
            if alias
            else [[part.name for part in table.parts][-size:] for size in range(1, len(table.parts) + 1)]
        )
        return bool(query.expressions) and all(
            _unchanged_projection(projection, qualifiers, columns) for projection in query.expressions
        )
    except Exception:
        logger.debug("Could not establish rule sample source columns", exc_info=True)
        return False


def _unchanged_projection(projection: exp.Expression, qualifiers: list[list[str]], columns: set[str]) -> bool:
    if isinstance(projection, exp.Alias):
        if not isinstance(projection.this, exp.Column) or projection.alias != projection.this.name:
            return False
        projection = projection.this
    if isinstance(projection, exp.Star):
        return not any(projection.args.values())
    if not isinstance(projection, exp.Column):
        return False
    parts = projection.parts
    if len(parts) > 1 and [part.name for part in parts[:-1]] not in qualifiers:
        return False
    if isinstance(projection.this, exp.Star):
        return not any(projection.this.args.values())
    return isinstance(projection.this, exp.Identifier) and projection.name.lower() in columns


class PandasRuleLibrarySample:
    """Keep a bounded sample of raw matching rows for deferred conversion."""

    def __init__(self) -> None:
        self._frames: list[DataFrame] = []
        self._remaining = FAILED_ROW_SAMPLE_SIZE

    def add(self, frame: "DataFrame") -> None:
        if self._remaining and not frame.empty:
            sample = frame.head(self._remaining).copy()
            self._frames.append(sample)
            self._remaining -= len(sample)

    def to_table_data(self) -> TableData | None:
        if not self._frames:
            return None
        columns = self._frames[0].columns.tolist()
        rows = [row for frame in self._frames for row in frame_sample_rows(frame, columns, len(frame))]
        return TableData.model_validate({"columns": [ColumnName(column) for column in columns], "rows": rows})


def frame_sample_rows(frame: "DataFrame", columns: list[str], limit: int) -> list[list[Any]]:
    """Up to `limit` rows of `frame` in the order of `columns`, as Python values with None for missing ones

    `astype(object)` comes first: an all-numeric frame otherwise becomes a float array, which rounds
    integers above 2**53.
    """
    head = frame.head(limit).reindex(columns=columns)
    values = head.astype(object).to_numpy()
    values[head.isna().to_numpy()] = None
    return [[_sample_value(value) for value in row] for row in values.tolist()]


def _sample_value(value: Any) -> Any:
    """`value` as the sample's JSON can hold it

    Drivers return binary columns as bytes or memoryview. The column samplers read those columns through
    HexByteString, so these rows show them the same way.
    """
    if isinstance(value, (bytes, bytearray, memoryview)):
        return _HEX_BYTE_STRING.process_result_value(value, _DEFAULT_DIALECT)
    return value


def render_literal_sql(sql: str, params: dict[str, Any], dialect: Dialect) -> str:
    """`sql` as `text()` runs it with `params`, with the bind parameters written in as literals"""
    statement = text(sql)
    # A test case also carries parameters its SQL does not use (`threshold`), and bindparams() rejects those.
    used = {name: value for name, value in params.items() if name in statement._bindparams}
    rendered = str(statement.bindparams(**used).compile(dialect=dialect, compile_kwargs={"literal_binds": True}))
    # Dialects whose driver takes %-style placeholders double every % in the compiled SQL; this SQL has no
    # placeholders left, so it is shown as the database receives it.
    return rendered.replace("%%", "%") if dialect.identifier_preparer._double_percents else rendered
