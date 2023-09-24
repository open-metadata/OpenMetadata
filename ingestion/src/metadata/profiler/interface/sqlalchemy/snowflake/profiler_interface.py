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
        try:
            return super()._compute_static_metrics(
                metrics, runner, column, session, *args, **kwargs
            )
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
        try:
            return super()._compute_window_metrics(
                metrics, runner, column, session, *args, **kwargs
            )
        except ProgrammingError as exc:
            if exc.orig and exc.orig.errno in OVERFLOW_ERROR_CODES.get(
                session.bind.dialect.name
            ):
                logger.info(
                    f"Skipping window metrics for {runner.table.__tablename__}.{column.name} due to overflow"
                )
        return None
