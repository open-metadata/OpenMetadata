#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Validator Mixin for SQA tests cases
"""

from typing import Any, List, Optional

from sqlalchemy import Column
from sqlalchemy.exc import SQLAlchemyError

from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.entity_link import get_decoded_column
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class SQAValidatorMixin:
    """Validator mixin for SQA test cases"""

    def get_column_name(self, entity_link: str, columns: List) -> Column:
        """Given a column name get the column object

        Args:
            column_name (str): Column name
        Returns:
            Column: Column object
        """
        column = get_decoded_column(entity_link)
        column_obj = next(
            (col for col in columns if col.name == column),
            None,
        )
        if column_obj is None:
            raise ValueError(f"Cannot find column {column}")
        return column_obj

    def run_query_results(
        self,
        runner: QueryRunner,
        metric: Metrics,
        column: Optional[Column] = None,
        **kwargs: Optional[Any],
    ) -> Optional[int]:
        """Run the metric query against the column

        Args:
            runner (QueryRunner): runner object witj sqlalchemy session object
            metric (Metrics): metric object
            column (Column): column object
            props_ (Optional[Any], optional): props to pass to metric object at runtime. Defaults to None.

        Raises:
            ValueError: error if no value is returned

        Returns:
            Any: value returned by the metric query
        """
        metric_obj = add_props(**kwargs)(metric.value) if kwargs else metric.value
        metric_fn = metric_obj(column).fn() if column is not None else metric_obj().fn()

        try:
            value = dict(runner.dispatch_query_select_first(metric_fn))  # type: ignore
            res = value.get(metric.name)
        except Exception as exc:
            raise SQLAlchemyError(exc)

        if res is None:
            raise ValueError(
                f"\nQuery on table/column {column.name if column is not None else ''} returned None. Your table might be empty. "
                "If you confirmed your table is not empty and are still seeing this message you can:\n"
                "\t1. check the documentation: https://docs.open-metadata.org/v1.3.x/connectors/ingestion/workflows/data-quality/tests\n"
                "\t2. reach out to the Collate team for support"
            )

        return res

    def _compute_row_count_between(
        self,
        runner: QueryRunner,
        column: Column,
        query_filter: dict,
    ):
        """compute row count for between tests

        Args:
            runner (QueryRunner): runner
            column (Column): column
            query_filter (dict): filter to apply to the query

        Raises:
            SQLAlchemyError:

        Returns:
        """
        try:
            value = dict(
                runner.dispatch_query_select_first(
                    Metrics.ROW_COUNT(column).fn(),
                    query_filter_=query_filter,
                )
            )
            res = value.get(Metrics.ROW_COUNT.name)
        except Exception as exc:
            raise SQLAlchemyError(exc)

        return res

    def _compute_row_count(self, runner: QueryRunner, column: Column, **kwargs):
        """compute row count

        Args:
            runner (QueryRunner): runner to run the test case against)
            column (SQALikeColumn): column to compute row count for
        """
        return self.run_query_results(runner, Metrics.ROW_COUNT, column, **kwargs)
