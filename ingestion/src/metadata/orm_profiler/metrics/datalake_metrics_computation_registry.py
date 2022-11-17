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

from metadata.ingestion.api.processor import ProfilerProcessorStatus
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.utils.dispatch import enum_register
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


def get_table_metrics(
    metrics: List[Metrics],
    data_frame_list,
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
    import pandas as pd  # pylint: disable=import-outside-toplevel

    try:
        row = []
        for metric in metrics:
            for data_frame in data_frame_list:
                row.append(
                    metric().dl_fn(
                        data_frame.astype(object).where(pd.notnull(data_frame), None)
                    )
                )
        if row:
            if isinstance(row, list):
                row_dict = {}
                for index, table_metric in enumerate(metrics):
                    row_dict[table_metric.name()] = row[index]
                return row_dict
            return dict(row)
        return None

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error trying to compute profile for {exc}")
        return None


def get_static_metrics(
    metrics: Metrics,
    processor_status: ProfilerProcessorStatus,
    column,
    data_frame_list,
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
    import pandas as pd  # pylint: disable=import-outside-toplevel

    try:
        row = []
        for metric in metrics:
            for data_frame in data_frame_list:
                row.append(
                    metric(column).dl_fn(
                        data_frame.astype(object).where(pd.notnull(data_frame), None)
                    )
                )
        row_dict = {}
        for index, table_metric in enumerate(metrics):
            row_dict[table_metric.name()] = row[index]
        return row_dict
    except Exception as exc:
        logger.debug(
            f"{traceback.format_exc()}\nError trying to compute profile for {exc}"
        )
        processor_status.failure(f"{column.name}", "Static Metrics", exc)
        return None


def get_query_metrics(
    metrics: Metrics,
    column,
    data_frame_list,
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
    for data_frame in data_frame_list:
        col_metric = metrics(column).dl_query(data_frame)
    if not col_metric:
        return None
    return {metrics.name(): col_metric}


def get_window_metrics(*args, **kwargs):
    """
    TODO: Add Functionality for Window Metric
    """
    return None


compute_metrics_registry = enum_register()
compute_metrics_registry.add("Table")(get_table_metrics)
compute_metrics_registry.add("Static")(get_static_metrics)
compute_metrics_registry.add("Query")(get_query_metrics)
compute_metrics_registry.add("Window")(get_window_metrics)
