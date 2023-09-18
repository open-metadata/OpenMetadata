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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""

from typing import List

from sqlalchemy.exc import ProgrammingError

from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    OVERFLOW_ERROR_CODES,
    SQAProfilerInterface,
    handle_query_exception,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class SnowflakeProfilerInterface(SQAProfilerInterface):
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """

    def _compute_static_metrics(
        self,
        metrics: List[Metrics],
        runner: QueryRunner,
        column,
        session,
        *args,
        **kwargs,
    ):
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        try:
            row = runner.select_first_from_sample(
                *[
                    metric(column).fn()
                    for metric in metrics
                    if not metric.is_window_metric()
                ],
            )
            return dict(row)
        except ProgrammingError as exc:
            if exc.orig and exc.orig.errno in OVERFLOW_ERROR_CODES.get(
                session.bind.dialect.name
            ):
                logger.info(
                    f"Computing metrics without sum for {runner.table.__tablename__}.{column.name}"
                )
                return self._compute_static_metrics_wo_sum(
                    metrics, runner, session, column
                )

        except Exception as exc:
            msg = f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
            handle_query_exception(msg, exc, session)
        return None

    def _compute_window_metrics(
        self,
        metrics: List[Metrics],
        runner: QueryRunner,
        column,
        session,
        *args,
        **kwargs,
    ):
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """

        if not metrics:
            return None
        try:
            row = runner.select_first_from_sample(
                *[metric(column).fn() for metric in metrics],
            )
        except ProgrammingError as exc:
            if exc.orig and exc.orig.errno in OVERFLOW_ERROR_CODES.get(
                session.bind.dialect.name
            ):
                logger.info(
                    f"Skipping window metrics for {runner.table.__tablename__}.{column.name} due to overflow"
                )
                return None

        except Exception as exc:
            msg = f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
            handle_query_exception(msg, exc, session)
        if row:
            return dict(row)
        return None
