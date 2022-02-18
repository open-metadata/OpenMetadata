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
Main Profile definition and queries to execute
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple

from sqlalchemy.orm import DeclarativeMeta, Query
from sqlalchemy.orm.session import Session

from metadata.orm_profiler.metrics.core import (
    ComposedMetric,
    CustomMetric,
    Metric,
    StaticMetric,
    TimeMetric,
)
from metadata.orm_profiler.orm.registry import NOT_COMPUTE
from metadata.orm_profiler.utils import logger

logger = logger()


class Profiler(ABC):
    """
    Core Profiler.

    A profiler is composed of:
    - A session, used to run the queries against.
    - An ORM Table. One profiler attacks one table at a time.
    - A tuple of metrics, from which we will construct queries.
    """

    def __init__(self, *metrics: Metric, session: Session, table):

        if not isinstance(table, DeclarativeMeta):
            raise ValueError(f"Table {table} should be a DeclarativeMeta.")

        self._session = session
        self._table = table
        self._metrics = metrics
        self._results: Optional[Dict[str, Any]] = None

    @property
    def session(self) -> Session:
        return self._session

    @property
    def table(self) -> DeclarativeMeta:
        return self._table

    @property
    def metrics(self) -> Tuple[Metric]:
        return self._metrics

    @property
    def results(self) -> Optional[Dict[str, Any]]:
        """
        Iterate over the _metrics to pick up
        all values from _results dict.

        Note that if some Metric does not run against
        a specific column (e.g., STDDEV only runs against
        numerical columns), then the metric won't appear
        in _results. However, we still want that
        result to be available, even if it is `None`.

        Here we prepare the logic to being able to have
        the complete suite of computed metrics.
        """
        if not self._results:
            return None

        results = {
            metric.name(): self._results.get(metric.name()) for metric in self.metrics
        }

        return results

    @results.setter
    def results(self, value: Dict[str, Any]):
        """
        If we have not yet computed any result, use the
        incoming value, otherwise, update the dict.
        """

        if not isinstance(value, dict):
            raise ValueError(
                f"Trying to set value {value} to profiler results, but value should be a dict."
            )

        if not self._results:
            self._results = value
        else:
            self._results.update(value)

    def _filter_metrics(self, _type: type):  # Type of class is `type`
        """
        Filter metrics by type
        """
        return [metric for metric in self.metrics if isinstance(metric, _type)]

    @property
    def static_metrics(self):
        return self._filter_metrics(StaticMetric)

    @property
    def time_metrics(self):
        return self._filter_metrics(TimeMetric)

    @property
    def composed_metrics(self):
        return self._filter_metrics(ComposedMetric)

    @property
    def custom_metrics(self):
        return self._filter_metrics(CustomMetric)

    def build_col_query(self) -> Optional[Query]:
        """
        Build the query with all the column static metrics.

        Can return None if no metric has an allowed
        type. In that case, we cannot build an empty
        query.
        """

        allowed_metrics = [
            metric.fn()
            for metric in self.static_metrics
            if metric.col and metric.col.type.__class__ not in NOT_COMPUTE
        ]

        if not allowed_metrics:
            return

        query = self.session.query(*allowed_metrics)

        return query

    @abstractmethod
    def sql_col_run(self):
        """
        Run the profiler and obtain the results,
        e.g. build_query().first(), or all()

        Data should be saved under self.results
        """

    def sql_table_run(self):
        """
        Run Table Static metrics
        """
        # Table metrics do not have column informed
        table_metrics = [metric for metric in self.static_metrics if not metric.col]

        for metric in table_metrics:
            row = self.session.query(metric.fn()).select_from(self.table).first()
            self.results = dict(row)

    def post_run(self):
        """
        Run this after the metrics have been computed

        Data should be saved under self.results
        """

        logger.info("Running post Profiler...")

        if not self._results:
            return

        for metric in self.composed_metrics:
            # Composed metrics require the results as an argument
            self._results[metric.name()] = metric.fn(self.results)

    def execute(self) -> Optional[Dict[str, Any]]:
        """
        Run the whole profiling
        """
        self.sql_table_run()
        self.sql_col_run()
        self.post_run()

        return self.results


class SingleProfiler(Profiler):
    """
    Basic Profiler.

    Passing a set of metrics, it runs them all.

    Returns a single ROW
    """

    def sql_col_run(self) -> Dict[str, Any]:
        """
        Run the profiler and store its results

        This should only execute column metrics.
        """
        logger.info("Running SQL Profiler...")

        query = self.build_col_query()

        if query:
            row = query.first()
            self.results = dict(row)

        return self.results
