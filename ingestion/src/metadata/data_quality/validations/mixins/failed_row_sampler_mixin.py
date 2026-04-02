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

from typing import Any, List, Tuple, cast

from sqlalchemy import inspect

from metadata.profiler.processor.runner import QueryRunner

FAILED_ROW_SAMPLE_SIZE = 50


class PandasFailedRowSamplerMixin:
    """Mixin to fetch failed row samples from Pandas DataFrames"""

    def _get_failed_rows_sample(self) -> Tuple[List[str], List[List[Any]]]:
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

    def _get_failed_rows_sample(self) -> Tuple[List[str], List[List[Any]]]:
        # pylint: disable=protected-access
        self.runner = cast(QueryRunner, self.runner)
        cols = list(inspect(self.runner.dataset).c)
        _filter = self.filter()
        if isinstance(_filter, dict):
            query = self.runner._select_from_sample(*cols, query_filter_=_filter)
        else:
            query = self.runner._select_from_sample(*cols)
            query = query.filter(_filter)

        self._inspection_query = str(
            query.statement.compile(compile_kwargs={"literal_binds": True})
        )

        rows = query.limit(FAILED_ROW_SAMPLE_SIZE).all()
        return [col.name for col in cols], [list(row) for row in rows]
