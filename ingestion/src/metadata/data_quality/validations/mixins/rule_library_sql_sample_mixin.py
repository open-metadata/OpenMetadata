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

"""Failed-row samples and inspection SQL for SQLAlchemy rule-library validators."""

from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, cast

from metadata.data_quality.validations.mixins.failed_row_sampler_mixin import (
    render_literal_sql,
    table_columns_sample,
)
from metadata.generated.schema.entity.data.table import TableData

if TYPE_CHECKING:
    from metadata.profiler.processor.runner import PandasRunner, QueryRunner


class RuleLibrarySqlSampleMixin:
    """Sample the retained rule output using its executed SQL and physical table."""

    runner: "QueryRunner | PandasRunner"
    _executed_sql: tuple[str, dict[str, str]]
    _failed_rows: tuple[list[str], Sequence[Any]] | None = None

    def fetch_failed_rows_sample(self) -> TableData | None:
        if self._failed_rows is None:
            return None
        runner = cast("QueryRunner", self.runner)
        columns, rows = self._failed_rows
        sample = table_columns_sample(
            runner.table,
            columns,
            rows,
            sql=self._executed_sql[0],
            table_reference=runner.get_table_reference(),
            dialect=runner.session.get_bind().dialect,
        )
        return TableData.model_validate({"columns": sample[0], "rows": sample[1]}) if sample else None

    def get_inspection_query(self) -> str | None:
        """The SQL `_run_results` executed, with its parameters written in"""
        compiled_sql, bind_params = self._executed_sql
        return render_literal_sql(
            compiled_sql, bind_params, cast("QueryRunner", self.runner).session.get_bind().dialect
        )
