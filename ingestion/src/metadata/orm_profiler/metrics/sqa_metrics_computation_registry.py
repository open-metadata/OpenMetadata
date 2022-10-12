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
OpenMetadata Profiler supported metrics

Use these registries to avoid messy imports.

Note that we are using our own Registry definition
that allows us to directly call our metrics without
having the verbosely pass .value all the time...
"""
# pylint: disable=unused-argument

import traceback
from typing import Dict, List, Optional, Union

from sqlalchemy import Column
from sqlalchemy.engine.row import Row
from sqlalchemy.orm import Session

from metadata.ingestion.api.processor import ProfilerProcessorStatus
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.utils.dispatch import enum_register
from metadata.utils.logger import sqa_interface_registry_logger

logger = sqa_interface_registry_logger()


def get_table_metrics(
    metrics: List[Metrics],
    runner: QueryRunner,
    session: Session,
    *args,
    **kwargs,
):
    """Given a list of metrics, compute the given results
    and returns the values

    Args:
        metrics: list of metrics to compute
    Returns:
        dictionnary of results
    """
    try:
        row = runner.select_first_from_sample(*[metric().fn() for metric in metrics])

        if row:
            return dict(row)
        return None

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(
            f"Error trying to compute profile for {runner.table.__tablename__}: {exc}"
        )
        session.rollback()
        return None


def get_static_metrics(
    metrics: List[Metrics],
    runner: QueryRunner,
    session: Session,
    column: Column,
    processor_status: ProfilerProcessorStatus,
    *args,
    **kwargs,
) -> Optional[Dict[str, Union[str, int]]]:
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
            ]
        )
        return dict(row)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(
            f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
        )
        session.rollback()
        processor_status.failure(f"{column.name}", "Static Metrics", f"{exc}")
        return None


def get_query_metrics(
    metric: Metrics,
    runner: QueryRunner,
    session: Session,
    column: Column,
    sample,
    processor_status: ProfilerProcessorStatus,
    *args,
    **kwargs,
) -> Optional[Dict[str, Union[str, int]]]:
    """Given a list of metrics, compute the given results
    and returns the values

    Args:
        column: the column to compute the metrics against
        metrics: list of metrics to compute
    Returns:
        dictionnary of results
    """
    try:
        col_metric = metric(column)
        metric_query = col_metric.query(sample=sample, session=session)
        if not metric_query:
            return None
        if col_metric.metric_type == dict:
            results = runner.select_all_from_query(metric_query)
            data = {k: [result[k] for result in results] for k in dict(results[0])}
            return {metric.name(): data}

        row = runner.select_first_from_query(metric_query)
        return dict(row)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(
            f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
        )
        session.rollback()
        processor_status.failure(f"{column.name}", "Query Metrics", f"{exc}")
        return None


def get_window_metrics(
    metric: Metrics,
    runner: QueryRunner,
    session: Session,
    column: Column,
    processor_status: ProfilerProcessorStatus,
    *args,
    **kwargs,
) -> Dict[str, Union[str, int]]:
    """Given a list of metrics, compute the given results
    and returns the values

    Args:
        column: the column to compute the metrics against
        metrics: list of metrics to compute
    Returns:
        dictionnary of results
    """
    try:
        row = runner.select_first_from_sample(metric(column).fn())
        if not isinstance(row, Row):
            return {metric.name(): row}
        return dict(row)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(
            f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
        )
        session.rollback()
        processor_status.failure(f"{column.name}", "Window Metrics", f"{exc}")
        return None


compute_metrics_registry = enum_register()
compute_metrics_registry.add("Static")(get_static_metrics)
compute_metrics_registry.add("Table")(get_table_metrics)
compute_metrics_registry.add("Query")(get_query_metrics)
compute_metrics_registry.add("Window")(get_window_metrics)
