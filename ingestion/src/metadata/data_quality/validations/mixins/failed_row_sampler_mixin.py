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

from sqlalchemy import Table, inspect, text
from sqlalchemy.engine import Dialect

from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import test_suite_logger

if TYPE_CHECKING:
    from pandas import DataFrame

logger = test_suite_logger()

FAILED_ROW_SAMPLE_SIZE = 50


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
    table: Table, columns: list[str], rows: Sequence[Sequence[Any]]
) -> tuple[list[str], list[list[Any]]] | None:
    """The first FAILED_ROW_SAMPLE_SIZE of `rows`, or None when an output column is not one of `table`'s

    The server masks a sample's PII by column name, so it refuses columns the table does not have.
    Output such as an aggregate or an alias would be refused, so it is not kept.
    See ADR:2026-11-12-rule-library-failed-rows-samples-keep-server-column-validation.
    """
    if not rows:
        return None
    table_columns = {column.name.lower() for column in inspect(table).c}
    unmatched = [column for column in columns if column.lower() not in table_columns]
    if unmatched:
        logger.info(
            "Rule output columns %s are not columns of the table: aggregate or aliased rule output"
            " is not stored as a failed rows sample",
            unmatched,
        )
        return None
    return columns, [list(row) for row in rows[:FAILED_ROW_SAMPLE_SIZE]]


def frame_sample_rows(frame: "DataFrame", columns: list[str], limit: int) -> list[list[Any]]:
    """Up to `limit` rows of `frame` in the order of `columns`, as Python values with None for missing ones

    `astype(object)` comes first: an all-numeric frame otherwise becomes a float array, which rounds
    integers above 2**53.
    """
    head = frame.head(limit).reindex(columns=columns)
    values = head.astype(object).to_numpy()
    values[head.isna().to_numpy()] = None
    return values.tolist()


def render_literal_sql(sql: str, params: dict[str, str], dialect: Dialect) -> str:
    """`sql` as `text()` runs it with `params`, with the bind parameters written in as literals"""
    statement = text(sql)
    # A test case also carries parameters its SQL does not use (`threshold`), and bindparams() rejects those.
    used = {name: value for name, value in params.items() if name in statement._bindparams}
    rendered = str(statement.bindparams(**used).compile(dialect=dialect, compile_kwargs={"literal_binds": True}))
    # Dialects whose driver takes %-style placeholders double every % in the compiled SQL; this SQL has no
    # placeholders left, so it is shown as the database receives it.
    return rendered.replace("%%", "%") if dialect.identifier_preparer._double_percents else rendered
