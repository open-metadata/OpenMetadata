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
Unique Count Metric definition
"""
import json
from collections import Counter
from typing import TYPE_CHECKING, Optional

from sqlalchemy import column, func
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import QueryMetric
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.profiler.orm.functions.unique_count import _unique_count_query_mapper
from metadata.profiler.orm.registry import NOT_COMPUTE, Dialects
from metadata.utils.logger import profiler_logger

if TYPE_CHECKING:
    import pandas as pd

logger = profiler_logger()


class UniqueCount(QueryMetric):
    """
    UNIQUE_COUNT Metric

    Given a column, count the number of values appearing only once
    """

    @classmethod
    def name(cls):
        return MetricType.uniqueCount.value

    @property
    def metric_type(self):
        return int

    def query(
        self, sample: Optional[DeclarativeMeta], session: Optional[Session] = None
    ):
        """
        Build the Unique Count metric
        """
        if not session:
            raise AttributeError(
                "We are missing the session attribute to compute the UniqueCount."
            )

        if self.col.type.__class__.__name__ in NOT_COMPUTE:
            return None

        # Run all queries on top of the sampled data
        col = column(self.col.name, self.col.type)

        # TODO: Move all connectors from subquery to COUNT(IF) or COUNTIF for peformance
        if session.bind.dialect.name == Dialects.BigQuery:
            return func.countif(col == 1).label(self.name())

        unique_count_query = _unique_count_query_mapper[session.bind.dialect.name](
            col, session, sample
        )
        only_once_sub = unique_count_query.subquery("only_once")
        return session.query(func.count().label(self.name())).select_from(only_once_sub)

    def df_fn(self, dfs=None):
        """
        Build the Unique Count metric
        """
        try:
            computation = self.get_pandas_computation()
            accumulator = computation.create_accumulator()
            for df in dfs:
                accumulator = computation.update_accumulator(accumulator, df)
            return computation.aggregate_accumulator(accumulator)
        except Exception as err:
            logger.debug(
                f"Don't know how to process type {self.col.type}"
                f" when computing Unique Count.\n Error: {err}"
            )
            return 0

    def get_pandas_computation(self):
        """Returns the logic to compute this metrics using Pandas"""
        return PandasComputation[Counter, int](
            create_accumulator=Counter,
            update_accumulator=lambda counter, df: UniqueCount.update_accumulator(
                counter, df, self.col
            ),
            aggregate_accumulator=UniqueCount.aggregate_accumulator,
        )

    @staticmethod
    def update_accumulator(counter: Counter, df: "pd.DataFrame", column):
        """Computes one DataFrame chunk and updates the accumulator"""
        values = df[column.name].dropna().to_list()
        try:
            counter.update(values)
        except TypeError as err:
            if isinstance(values, list):
                for value in values:
                    counter.update([json.dumps(value)])
            else:
                raise err
        return counter

    @staticmethod
    def aggregate_accumulator(counter: Counter) -> int:
        """Aggregates the accumulated values to calculate final metric"""
        return len([k for k, v in counter.items() if v == 1])
