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
from typing import Any, Dict

from sqlalchemy.orm.session import Session

from metadata.orm_profiler.metrics.core import (
    ComposedMetric,
    CustomMetric,
    Metric,
    StaticMetric,
    TimeMetric,
)
from metadata.orm_profiler.utils import logger

logger = logger()


class Profiler(ABC):
    """
    Basic Profiler
    """

    results: Dict[str, Any] = None

    def __init__(self, session: Session, *metric: Metric):
        self._session = session
        self._metrics = metric

    @property
    def session(self) -> Session:
        return self._session

    @property
    def metrics(self):
        return self._metrics

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

    def build_query(self):
        """
        Build the query with all the metrics
        """
        # TODO: Figure out time and custom metrics run

        query = self.session.query(*[metric.fn() for metric in self.static_metrics])

        return query

    @abstractmethod
    def sql_run(self):
        """
        Run the profiler and obtain the results,
        e.g. build_query().first(), or all()

        Data should be saved under self.results
        """

    def post_run(self):
        """
        Run this after the metrics have been computed

        Data should be saved under self.results
        """

        logger.info("Running post Profiler...")

        for metric in self.composed_metrics:
            # Composed metrics require the results as an argument
            res = metric.fn(self.results)
            self.results[metric.__class__.name()] = res

    def execute(self):
        """
        Run the whole profiling
        """
        self.sql_run()
        self.post_run()

        return self.results


class SingleProfiler(Profiler):
    """
    Basic Profiler.

    Passing a set of metrics, it runs them all.

    Returns a single ROW
    """

    def sql_run(self) -> Dict[str, Any]:
        """
        Run the profiler and store its results
        """
        logger.info("Running SQL Profiler...")

        row = super().build_query().first()
        self.results = dict(row)

        return self.results
